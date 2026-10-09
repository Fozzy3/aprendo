import { internal } from './_generated/api'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { assertOwnsStudent, requireAuthenticatedStudentId } from './auth'
import { SUBJECT_IDS, getSubjectIdForSubtopic, getSubjectLabel } from './taxonomy'
import {
  getSimulacroSubjectTarget,
  getSimulacroSubjectTargets,
  getSessionKindConfig,
  type QuestionEligibilityPool,
  type SessionKind,
  type SessionKindConfig,
  type SimulacroSessionConfig,
  type SubjectQuestionTarget,
} from './sessionKinds'
import {
  collectUsableQuestionsBySubject,
  collectUsableQuestionsBySubtopic,
  expandToGroups,
  hasUsableMetadata,
  isInEligibilityPool,
} from './questionPool'
import {
  confidenceLevelValidator,
  feedbackModeValidator,
  practiceDifficultyValidator,
  practiceSourceValidator,
  sessionKindValidator,
} from './validators'
import { DEFAULT_RATING, updateRatings } from './elo'
import { classifyAttempt, reviewPriority, type ConfidenceLevel } from './confidence'
import {
  COMPLETION_GRACE_MS,
  canCheckAnswers,
  canRevealAnswers,
  canRevealQuestion,
  canRevealSessionQuestion,
  canSettleSession,
  isOutsideLiveExam,
  isPastDeadline,
  sealAttempt,
  sealQuestion,
  sealsItsQuestions,
  settledAttempts,
} from './sessionIntegrity'
import { pickSimulacroForm, scoreSimulacroSubjects } from './simulacroForm'
import { accumulateQuestionTime, officialMsPerQuestion, questionTimeMs } from './pacing'
import {
  buildNivelacionResult,
  buildSimulacroReport,
  isFirstPlacement,
  latestSimulacroExam,
  resolveSimulacroExam,
  type ReportItem,
} from './examReport'
import { orderByDesirableDifficulty } from './adaptive'
import {
  RETO_QUESTIONS_PER_SUBTOPIC,
  RETO_SUBTOPIC_COUNT,
  interleaveBlocks,
  masteryContext,
  masteryLevelOf,
  nextMasteryLevel,
  orderRetoCandidates,
  revealedQuestionIds,
  type SubtopicEvidence,
} from './mastery'
import {
  MAX_PRACTICE_QUESTIONS,
  filterPracticeQuestions,
  practiceBuilderCounts,
  practiceCountError,
  resolvePracticeScope,
  type PracticeFilters,
  type PracticeHistory,
} from './practiceBuilder'
import { addToTally, countsTowardStats, summarizeAnswerStats, tallyAnswers } from './answerStats'

type SelectionReason =
  | 'balanced_diagnostic'
  | 'balanced_coverage'
  | 'weak_subtopic'
  | 'recent_mistake'
  | 'reinforcement'
  | 'confidence_building'
  | 'topic_focus'

type Selection = {
  questionId: Id<'questions'>
  selectionReason: SelectionReason
  selectionMetadata: string
}

/** Whether a new session may take a question: false for a live exam's items (`loadLiveExamSeal`). */
type IsFree = (question: Doc<'questions'>) => boolean

function stableQuestionOrder<T extends { _creationTime: number; sequence: number }>(questions: T[]) {
  return [...questions].sort((a, b) => {
    if (a._creationTime !== b._creationTime) {
      return a._creationTime - b._creationTime
    }
    return a.sequence - b.sequence
  })
}

/**
 * Whether the student has been placed at all.
 *
 * Placement is either a per-area `nivelacion` (the current entry point) or the
 * legacy 20-question `diagnostic` — students who completed one before the
 * change keep their access. Mirrors the gate in `students.computeStudentAppState`.
 */
async function hasCompletedPlacement(ctx: QueryCtx, studentId: Id<'students'>) {
  const [diagnostics, nivelaciones] = await Promise.all([
    ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind', (q) => q.eq('studentId', studentId).eq('kind', 'diagnostic'))
      .collect(),
    ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind', (q) => q.eq('studentId', studentId).eq('kind', 'nivelacion'))
      .collect(),
  ])
  return [...diagnostics, ...nivelaciones].some((session) => session.status === 'completed')
}

function recommendationSourceForKind(kind: SessionKind) {
  switch (kind) {
    case 'diagnostic':
    case 'nivelacion':
      return 'diagnostic_plan' as const
    case 'topic':
    case 'personalizada':
      return 'manual' as const
    case 'repaso':
      return 'review_mistakes' as const
    default:
      return 'rule_based' as const
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Selection strategies — each returns an ordered list of question selections.
// ─────────────────────────────────────────────────────────────────────────

/** Even spread across all five subjects (diagnostic, simulacro). */
async function selectBalancedBySubject(
  ctx: QueryCtx,
  config: SessionKindConfig,
  isFree: IsFree,
): Promise<Selection[]> {
  const perSubject = config.questionsPerSubject ?? 4
  const reason: SelectionReason =
    config.kind === 'diagnostic' ? 'balanced_diagnostic' : 'balanced_coverage'
  const selected: Selection[] = []

  for (const subjectId of SUBJECT_IDS) {
    const pooled = await collectUsableQuestionsBySubject(ctx, subjectId, config.eligibilityPools)
    const ordered = stableQuestionOrder(pooled.filter(isFree))
    const usable = await expandToGroups(ctx, ordered, ordered, perSubject)
    for (const question of usable) {
      selected.push({ questionId: question._id, selectionReason: reason, selectionMetadata: subjectId })
    }
  }

  return selected
}

/**
 * A simulacro form for this student (see `simulacroForm.ts`): never-shown
 * questions first, then least recently shown, seeded by student and attempt.
 * Sesión 2 of the full exam never repeats the latest Sesión 1.
 *
 * ponytail: reads every past session's items to know what was shown — a few
 * thousand rows for a heavy user. If that grows, keep a per-student "seen"
 * table instead.
 */
async function selectSimulacroForm(
  ctx: QueryCtx,
  config: SessionKindConfig,
  studentId: Id<'students'>,
  subjectTargets: SubjectQuestionTarget[],
  simulacroSessionNumber: number | undefined,
  isFree: IsFree,
): Promise<Selection[]> {
  const pastSessions = await ctx.db
    .query('sessions')
    .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
    .collect()
  const latestSesion1 = simulacroSessionNumber === 2
    ? pastSessions
        .filter((session) =>
          session.kind === 'simulacro'
          && session.subjectId == null
          && session.simulacroSessionNumber === 1)
        .sort((a, b) => b.startedAt - a.startedAt)[0]
    : undefined

  // "Seen" means shown, not answered: the review of a completed session
  // discloses every key, the unanswered questions' included.
  const lastSeenAt = new Map<string, number>()
  const exclude = new Set<string>()
  for (const session of pastSessions) {
    const items = await ctx.db
      .query('sessionQuestions')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
      .collect()
    for (const item of items) {
      lastSeenAt.set(item.questionId, Math.max(lastSeenAt.get(item.questionId) ?? 0, session.startedAt))
      if (session._id === latestSesion1?._id) exclude.add(item.questionId)
    }
  }
  const attemptNumber = pastSessions.filter((session) => session.kind === 'simulacro').length + 1
  const seed = `${studentId}:${attemptNumber}`

  const selected: Selection[] = []
  for (const target of subjectTargets) {
    const pooled = await collectUsableQuestionsBySubject(ctx, target.subjectId, config.eligibilityPools)
    // The target counts MEMBERS and groups stay whole — a Lectura Crítica
    // simulacro is mostly shared-text questions.
    const form = pickSimulacroForm({
      questions: stableQuestionOrder(pooled.filter(isFree)),
      limit: target.questionCount,
      seed,
      lastSeenAt,
      exclude,
    })
    for (const question of form) {
      selected.push({
        questionId: question._id,
        selectionReason: 'balanced_coverage',
        selectionMetadata: target.subjectId,
      })
    }
  }

  return selected
}

function getSimulacroSessionConfig(
  config: SessionKindConfig,
  sessionNumber: number | undefined,
): SimulacroSessionConfig {
  const sessions = config.simulacroSessions ?? []
  const targetSessionNumber = sessionNumber ?? 1
  const simulacroSession = sessions.find(
    (candidate) => candidate.sessionNumber === targetSessionNumber,
  )
  if (simulacroSession == null) {
    throw new ConvexError('Selecciona una sesión válida del simulacro.')
  }
  return simulacroSession
}

function getSessionTimeLimitMs(
  config: SessionKindConfig,
  simulacroSessionNumber: number | undefined,
  subjectId: string | undefined,
) {
  if (config.kind !== 'simulacro') return config.timeLimitMs
  // A single-area simulacro is timed at the official pace for that area's
  // question count instead of the full 4h30 sitting.
  if (subjectId != null) {
    return getSimulacroSubjectTarget(subjectId)?.timeLimitMs ?? config.timeLimitMs
  }
  return getSimulacroSessionConfig(config, simulacroSessionNumber).timeLimitMs
}

/**
 * Concentrated in a single requested subject (topic practice). When a
 * `subtopicId` is given (topic practice launched from the syllabus) the pool is
 * narrowed to that subtopic via the `by_primarySubtopicId_eligibility` index.
 */
async function selectTopic(
  ctx: QueryCtx,
  config: SessionKindConfig,
  studentId: Id<'students'>,
  subjectId: string,
  subtopicId: string | undefined,
  isFree: IsFree,
): Promise<Selection[]> {
  const total = config.totalQuestions ?? 10

  const pooled = subtopicId != null
    ? await collectUsableQuestionsBySubtopic(ctx, subtopicId, config.eligibilityPools)
    : await collectUsableQuestionsBySubject(ctx, subjectId, config.eligibilityPools)
  const usable = stableQuestionOrder(pooled.filter(isFree))

  const attempts = await ctx.db
    .query('questionAttempts')
    .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
    .collect()
  const seen = new Set(attempts.map((attempt) => attempt.questionId))

  // Topic practice aims at ~70% expected success (`adaptive.ts`). Nivelación
  // shares this strategy but measures: it keeps the plain bank order.
  const student = await ctx.db.get('students', studentId)
  const adapt = (list: Doc<'questions'>[]) =>
    config.kind === 'topic' ? orderByDesirableDifficulty(list, student?.abilityBySubject) : list

  // Prefer unseen questions, then fall back to already-seen ones to fill.
  const unseen = adapt(usable.filter((question) => !seen.has(question._id)))
  const seenOnly = adapt(usable.filter((question) => seen.has(question._id)))
  // A grouped question comes with its siblings even if some were already seen —
  // the alternative is a question whose text the student can't read.
  const ordered = await expandToGroups(ctx, [...unseen, ...seenOnly], usable, total)

  return ordered.map((question) => ({
    questionId: question._id,
    selectionReason: 'topic_focus' as const,
    selectionMetadata: subtopicId ?? subjectId,
  }))
}

/** Rule-based selection targeting weak areas (recommended practice). */
async function selectRecommended(
  ctx: QueryCtx,
  config: SessionKindConfig,
  studentId: Id<'students'>,
  isFree: IsFree,
): Promise<Selection[]> {
  const total = config.totalQuestions ?? 10

  const attempts = await ctx.db
    .query('questionAttempts')
    .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
    .collect()
  const attemptedQuestionIds = new Set(attempts.map((attempt) => attempt.questionId))

  const allQuestions = await ctx.db.query('questions').collect()
  const eligibleQuestions = stableQuestionOrder(
    allQuestions.filter(
      (question) =>
        isInEligibilityPool(question, config.eligibilityPools)
        && hasUsableMetadata(question)
        && isFree(question)
        && !attemptedQuestionIds.has(question._id),
    ),
  )

  const subtopicAggregates = await ctx.db
    .query('learnerSubtopicAggregates')
    .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
    .collect()
  const subjectAggregates = await ctx.db
    .query('learnerSubjectAggregates')
    .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
    .collect()

  const selected: Selection[] = []
  const selectedIds = new Set<Id<'questions'>>()

  // Candidates are gathered as documents (not yet as Selections) so the group
  // expansion at the end can pull in siblings; `reasonByQuestionId` remembers
  // why each one was picked, and a sibling inherits the reason of the member
  // that dragged it in.
  const candidateOrder: Doc<'questions'>[] = []
  const reasonByQuestionId = new Map<
    Id<'questions'>,
    { selectionReason: SelectionReason; selectionMetadata: string }
  >()

  // Within each step, the questions closest to ~70% expected success first.
  const student = await ctx.db.get('students', studentId)
  const fill = (
    candidates: Doc<'questions'>[],
    selectionReason: SelectionReason,
    selectionMetadata: string,
  ) => {
    for (const question of orderByDesirableDifficulty(stableQuestionOrder(candidates), student?.abilityBySubject)) {
      if (candidateOrder.length >= total) return
      if (selectedIds.has(question._id)) continue
      candidateOrder.push(question)
      reasonByQuestionId.set(question._id, { selectionReason, selectionMetadata })
      selectedIds.add(question._id)
    }
  }

  // 1. Weakest subtopics first.
  for (const aggregate of [...subtopicAggregates].sort((a, b) => a.masteryScore - b.masteryScore)) {
    fill(
      eligibleQuestions.filter((question) => question.primarySubtopicId === aggregate.subtopicId),
      'weak_subtopic',
      aggregate.subtopicId ?? aggregate.subjectId,
    )
  }

  // 2. Reinforcement from the medium-strength subjects.
  const subjectsByAscendingMastery = [...subjectAggregates]
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .map((aggregate) => aggregate.subjectId)
  const reinforcementSubjectIds = subjectsByAscendingMastery.length > 2
    ? subjectsByAscendingMastery.slice(1, -1)
    : subjectsByAscendingMastery
  for (const subjectId of reinforcementSubjectIds) {
    fill(
      eligibleQuestions.filter((question) => question.subjectId === subjectId),
      'reinforcement',
      subjectId,
    )
  }

  // 3. Confidence building from the strongest subjects.
  const subjectsByDescendingMastery = [...subjectAggregates]
    .sort((a, b) => b.masteryScore - a.masteryScore)
    .map((aggregate) => aggregate.subjectId)
  for (const subjectId of subjectsByDescendingMastery) {
    fill(
      eligibleQuestions.filter((question) => question.subjectId === subjectId),
      'confidence_building',
      subjectId,
    )
  }

  // 4. Fallback pool to guarantee a full session.
  fill(eligibleQuestions, 'confidence_building', 'fallback_pool')

  const ordered = await expandToGroups(ctx, candidateOrder, eligibleQuestions, total)
  for (const question of ordered) {
    const reason = reasonByQuestionId.get(question._id) ?? {
      selectionReason: 'reinforcement' as const,
      selectionMetadata: question.primarySubtopicId ?? question.subjectId ?? 'group_sibling',
    }
    selected.push({ questionId: question._id, ...reason })
  }

  return selected
}

/**
 * The questions due for spaced review: those whose most recent attempt was
 * incorrect (still "unlearned"), oldest mistakes first so the most overdue
 * resurface. Returns the ordered list of due question ids.
 */
/**
 * Launchable review questions for a student: those whose latest attempt was
 * wrong AND that are still usable + in one of the given eligibility pools,
 * oldest miss first. This is the single definition of "due for review" — both
 * the `getReviewQueue` count and the `repaso` session selection draw from it, so
 * the "Hoy" card can never advertise more review questions than a session can
 * actually launch (the same invariant `questionPool` enforces for the syllabus).
 */
async function collectDueReviewQuestions(
  ctx: QueryCtx,
  studentId: Id<'students'>,
  eligibilityPools: QuestionEligibilityPool[],
): Promise<Doc<'questions'>[]> {
  // Only finished sittings count: a miss in an open simulacro showing up here
  // would grade it answer by answer, and a repaso would then reveal the key.
  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
    .collect()
  const attempts = settledAttempts(
    await ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
      .collect(),
    sessions,
  )

  const latestByQuestion = new Map<
    Id<'questions'>,
    { isCorrect: boolean; answeredAt: number; confidence: ConfidenceLevel | undefined }
  >()
  for (const attempt of attempts) {
    if (attempt.answeredAt == null || attempt.isCorrect == null) continue
    const previous = latestByQuestion.get(attempt.questionId)
    if (previous == null || attempt.answeredAt > previous.answeredAt) {
      latestByQuestion.set(attempt.questionId, {
        isCorrect: attempt.isCorrect,
        answeredAt: attempt.answeredAt,
        confidence: attempt.confidence,
      })
    }
  }

  // Misconceptions first, then oldest-first within the same urgency. A question
  // the student got wrong *while sure* is the one they will never revisit on
  // their own, so it earns the front of the queue over an equally old miss they
  // already knew they did not understand.
  const dueQuestionIds = [...latestByQuestion.entries()]
    .filter(([, latest]) => !latest.isCorrect)
    .sort((a, b) => {
      const priority = (entry: (typeof a)[1]) => {
        const state = classifyAttempt({
          confidence: entry.confidence,
          isCorrect: entry.isCorrect,
        })
        // Undeclared misses keep their historical place: between a known
        // misconception and a self-aware gap.
        return state == null ? reviewPriority('gap') : reviewPriority(state)
      }
      const byPriority = priority(b[1]) - priority(a[1])
      if (byPriority !== 0) return byPriority
      return a[1].answeredAt - b[1].answeredAt
    })
    .map(([questionId]) => questionId)

  const due: Doc<'questions'>[] = []
  for (const questionId of dueQuestionIds) {
    const question = await ctx.db.get('questions', questionId)
    if (question == null || !hasUsableMetadata(question) || !isInEligibilityPool(question, eligibilityPools)) {
      continue
    }
    due.push(question)
  }
  return due
}

/** Previously-missed questions resurfaced for spaced review (repaso). */
async function selectReviewMistakes(
  ctx: QueryCtx,
  config: SessionKindConfig,
  studentId: Id<'students'>,
  isFree: IsFree,
): Promise<Selection[]> {
  const total = config.totalQuestions ?? 10
  const due = (await collectDueReviewQuestions(ctx, studentId, config.eligibilityPools)).filter(isFree)
  const ordered = await expandToGroups(ctx, due, due, total)

  return ordered.map((question) => ({
    questionId: question._id,
    selectionReason: 'recent_mistake' as const,
    selectionMetadata: question.primarySubtopicId ?? question.subjectId ?? 'review',
  }))
}

/**
 * "Reintentar las incorrectas": the misses and blanks of one completed session
 * the student owns, in its order, groups kept whole among them.
 */
async function selectRetryMistakes(
  ctx: QueryCtx,
  config: SessionKindConfig,
  studentId: Id<'students'>,
  sourceSessionId: Id<'sessions'>,
  isFree: IsFree,
): Promise<Selection[]> {
  const source = await ctx.db.get('sessions', sourceSessionId)
  if (source == null || source.studentId !== studentId) {
    throw new ConvexError('No encontramos esa sesión.')
  }
  // Its grades are sealed until it ends: "which ones did I miss" is the key.
  if (!canRevealAnswers(source)) {
    throw new ConvexError('Termina esa sesión antes de reintentar sus incorrectas.')
  }
  const [sessionQuestions, attempts] = await Promise.all([
    ctx.db
      .query('sessionQuestions')
      .withIndex('by_sessionId_position', (q) => q.eq('sessionId', sourceSessionId))
      .collect(),
    ctx.db
      .query('questionAttempts')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sourceSessionId))
      .collect(),
  ])
  const correctIds = new Set(
    attempts.filter((attempt) => attempt.isCorrect === true).map((attempt) => attempt.sessionQuestionId),
  )
  const missed: Doc<'questions'>[] = []
  for (const sessionQuestion of sessionQuestions) {
    if (correctIds.has(sessionQuestion._id)) continue
    const question = await ctx.db.get('questions', sessionQuestion.questionId)
    if (question == null || !hasUsableMetadata(question) || !isInEligibilityPool(question, config.eligibilityPools)) {
      continue
    }
    missed.push(question)
  }
  if (missed.length === 0) {
    throw new ConvexError('No fallaste ninguna pregunta en esa sesión.')
  }
  const free = missed.filter(isFree)
  if (free.length === 0) {
    throw new ConvexError('Esas preguntas están en un examen o reto que tienes en curso. Termínalo primero.')
  }
  const ordered = await expandToGroups(ctx, free, free, MAX_PRACTICE_QUESTIONS)
  return ordered.map((question) => ({
    questionId: question._id,
    selectionReason: 'recent_mistake' as const,
    selectionMetadata: question.primarySubtopicId ?? question.subjectId ?? 'review',
  }))
}

/** The usable questions of a builder scope: its subtopics, its area, or the whole bank. */
async function loadPracticeBank(
  ctx: QueryCtx,
  scope: { subjectId: string | null; subtopicIds: string[] | null },
  pools: QuestionEligibilityPool[],
): Promise<Doc<'questions'>[]> {
  if (scope.subtopicIds != null) {
    const bySubtopic = await Promise.all(
      scope.subtopicIds.map((subtopicId) => collectUsableQuestionsBySubtopic(ctx, subtopicId, pools)),
    )
    return stableQuestionOrder(bySubtopic.flat())
  }
  if (scope.subjectId != null) {
    return stableQuestionOrder(await collectUsableQuestionsBySubject(ctx, scope.subjectId, pools))
  }
  const all = await ctx.db.query('questions').collect()
  return stableQuestionOrder(
    all.filter((question) => isInEligibilityPool(question, pools) && hasUsableMetadata(question)),
  )
}

/**
 * What the builder's source filter reads. "Vista" is any attempt row: visiting
 * a question writes one (`recordQuestionTime`), as `selectTopic` counts it.
 * "Fallada" is a latest settled answer that was wrong — an open sitting's
 * grades stay sealed (`settledAttempts`).
 */
async function loadPracticeHistory(ctx: QueryCtx, studentId: Id<'students'>): Promise<PracticeHistory> {
  const [attempts, sessions] = await Promise.all([
    ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
      .collect(),
    ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
      .collect(),
  ])
  const latest = new Map<string, { answeredAt: number; isCorrect: boolean }>()
  for (const attempt of settledAttempts(attempts, sessions)) {
    if (attempt.answeredAt == null || attempt.isCorrect == null) continue
    const previous = latest.get(attempt.questionId)
    if (previous == null || attempt.answeredAt > previous.answeredAt) {
      latest.set(attempt.questionId, { answeredAt: attempt.answeredAt, isCorrect: attempt.isCorrect })
    }
  }
  return {
    seen: new Set(attempts.map((attempt) => attempt.questionId)),
    wrong: new Set([...latest].filter(([, entry]) => !entry.isCorrect).map(([questionId]) => questionId)),
    flagged: new Set(attempts.filter((attempt) => attempt.flagged === true).map((attempt) => attempt.questionId)),
  }
}

type PracticeRequest = PracticeFilters & { count: number; timed: boolean }

/** "Práctica a tu medida" (see `practiceBuilder.ts`): unseen first, groups whole. */
async function selectCustom(
  ctx: QueryCtx,
  config: SessionKindConfig,
  studentId: Id<'students'>,
  practice: PracticeRequest,
  isFree: IsFree,
): Promise<Selection[]> {
  const scope = resolvePracticeScope(practice)
  if ('error' in scope) throw new ConvexError(scope.error)
  const bank = (await loadPracticeBank(ctx, scope, config.eligibilityPools)).filter(isFree)
  const history = await loadPracticeHistory(ctx, studentId)
  const matching = filterPracticeQuestions(bank, practice, history)
  if (matching.length < practice.count) {
    const available = matching.length
    throw new ConvexError({
      code: 'not_enough_questions',
      available,
      message: available === 0
        ? 'No hay preguntas con esos filtros. Prueba con otros.'
        : `Solo hay ${available} ${available === 1 ? 'pregunta' : 'preguntas'} con esos filtros: elige menos o cambia los filtros.`,
    })
  }
  const ordered = await expandToGroups(
    ctx,
    [
      ...matching.filter((question) => !history.seen.has(question._id)),
      ...matching.filter((question) => history.seen.has(question._id)),
    ],
    matching,
    practice.count,
  )
  if (ordered.length === 0) throw new ConvexError('No hay preguntas con esos filtros. Prueba con otros.')
  return ordered.map((question) => ({
    questionId: question._id,
    selectionReason: 'topic_focus' as const,
    selectionMetadata: question.primarySubtopicId ?? question.subjectId ?? 'personalizada',
  }))
}

/**
 * Khan's Mastery Challenge: two unseen questions from each of three practiced
 * subtopics (`orderRetoCandidates`), interleaved so it is mixed. Never a seen
 * one: its key was shown in a review, and a reto of known keys would promote.
 */
async function selectReto(
  ctx: QueryCtx,
  config: SessionKindConfig,
  studentId: Id<'students'>,
  isFree: IsFree,
): Promise<Selection[]> {
  const [aggregates, attempts] = await Promise.all([
    ctx.db
      .query('learnerSubtopicAggregates')
      .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
      .collect(),
    ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
      .collect(),
  ])
  const seen = new Set<string>(attempts.map((attempt) => attempt.questionId))

  const blocks: Doc<'questions'>[][] = []
  for (const candidate of orderRetoCandidates(aggregates)) {
    if (blocks.length === RETO_SUBTOPIC_COUNT) break
    if (candidate.subtopicId == null) continue
    const pool = stableQuestionOrder(
      (await collectUsableQuestionsBySubtopic(ctx, candidate.subtopicId, config.eligibilityPools)).filter(isFree),
    )
    const unseen = pool.filter((question) => !seen.has(question._id))
    const picked = await expandToGroups(ctx, unseen, unseen, RETO_QUESTIONS_PER_SUBTOPIC)
    if (picked.length === RETO_QUESTIONS_PER_SUBTOPIC) blocks.push(picked)
  }
  if (blocks.length < RETO_SUBTOPIC_COUNT) {
    throw new ConvexError('Practica al menos tres subtemas antes del reto de dominio.')
  }

  return interleaveBlocks(blocks).map((question) => ({
    questionId: question._id,
    selectionReason: 'reinforcement' as const,
    selectionMetadata: question.primarySubtopicId ?? 'reto',
  }))
}

async function buildSelection(
  ctx: QueryCtx,
  config: SessionKindConfig,
  studentId: Id<'students'>,
  subjectId: string | undefined,
  subtopicId: string | undefined,
  simulacroSessionNumber: number | undefined,
  isFree: IsFree,
  extra: { retryFromSessionId?: Id<'sessions'>; practice?: PracticeRequest } = {},
): Promise<Selection[]> {
  switch (config.strategy) {
    case 'balanced_by_subject':
      return selectBalancedBySubject(ctx, config, isFree)
    case 'simulacro_by_session': {
      // A simulacro scoped to one area: the official total for that area, in
      // one sitting, instead of the two full mixed sittings.
      if (subjectId != null) {
        const target = getSimulacroSubjectTarget(subjectId)
        if (target == null) throw new ConvexError('Selecciona un área válida para el simulacro.')
        return selectSimulacroForm(
          ctx,
          config,
          studentId,
          [{ subjectId: target.subjectId, questionCount: target.questionCount }],
          undefined,
          isFree,
        )
      }
      const simulacroSession = getSimulacroSessionConfig(config, simulacroSessionNumber)
      return selectSimulacroForm(
        ctx,
        config,
        studentId,
        simulacroSession.subjectTargets,
        simulacroSession.sessionNumber,
        isFree,
      )
    }
    case 'topic':
      if (subjectId == null) throw new ConvexError('Topic practice requires a subject.')
      return selectTopic(ctx, config, studentId, subjectId, subtopicId, isFree)
    case 'recommended':
      return selectRecommended(ctx, config, studentId, isFree)
    case 'review_mistakes':
      return extra.retryFromSessionId != null
        ? selectRetryMistakes(ctx, config, studentId, extra.retryFromSessionId, isFree)
        : selectReviewMistakes(ctx, config, studentId, isFree)
    case 'custom':
      if (extra.practice == null) throw new ConvexError('Elige los filtros de tu práctica.')
      return selectCustom(ctx, config, studentId, extra.practice, isFree)
    case 'mastery_challenge':
      return selectReto(ctx, config, studentId, isFree)
    default:
      return []
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Mutations / queries
// ─────────────────────────────────────────────────────────────────────────

/** The builder's filters (see `practiceBuilder.ts`), shared by the counts query and `createSession`. */
const practiceFilterFields = {
  subjectId: v.optional(v.string()),
  subtopicIds: v.optional(v.array(v.string())),
  difficulty: v.optional(practiceDifficultyValidator),
  source: practiceSourceValidator,
}

export const createSession = mutation({
  args: {
    studentId: v.id('students'),
    kind: sessionKindValidator,
    subjectId: v.optional(v.string()),
    // Optional for `topic` practice launched from the syllabus by subtopic.
    subtopicId: v.optional(v.string()),
    simulacroSessionNumber: v.optional(v.number()),
    /** Practice kinds only (`allowsImmediateFeedback`); absent means `al_final`. */
    feedbackMode: v.optional(feedbackModeValidator),
    /** `repaso` only: retry the misses and blanks of this completed session. */
    retryFromSessionId: v.optional(v.id('sessions')),
    /** `personalizada` only: the builder's choice. */
    practice: v.optional(v.object({
      ...practiceFilterFields,
      count: v.number(),
      timed: v.boolean(),
    })),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const config = getSessionKindConfig(args.kind)
    const feedbackMode = args.feedbackMode ?? 'al_final'
    if (feedbackMode === 'inmediata' && !config.allowsImmediateFeedback) {
      throw new ConvexError('Esta sesión muestra las respuestas solo al final.')
    }
    if (args.retryFromSessionId != null && args.kind !== 'repaso') {
      throw new ConvexError('Solo un repaso puede reintentar las incorrectas de una sesión.')
    }
    if (args.practice != null && args.kind !== 'personalizada') {
      throw new ConvexError('Los filtros son solo para la práctica a tu medida.')
    }
    if (args.kind === 'personalizada') {
      if (args.practice == null) throw new ConvexError('Elige los filtros de tu práctica.')
      const countError = practiceCountError(args.practice.count)
      if (countError != null) throw new ConvexError(countError)
    }

    const timeLimitMs = getSessionTimeLimitMs(
      config,
      args.simulacroSessionNumber,
      args.kind === 'simulacro' ? args.subjectId : undefined,
    )

    if (config.requiresDiagnostic && !(await hasCompletedPlacement(ctx, args.studentId))) {
      throw new ConvexError('Nivélate en al menos un área antes de iniciar esta práctica.')
    }

    // A subtopic is only meaningful for topic practice. When given, validate it
    // and derive the parent subject so callers may pass just the subtopic.
    const subtopicId = args.kind === 'topic' ? args.subtopicId : undefined
    let subjectId = args.subjectId
    if (subtopicId != null) {
      const parentSubjectId = getSubjectIdForSubtopic(subtopicId)
      if (parentSubjectId == null) {
        throw new ConvexError('Selecciona un subtema válido para esta práctica.')
      }
      if (subjectId != null && subjectId !== parentSubjectId) {
        throw new ConvexError('El subtema no pertenece a la asignatura seleccionada.')
      }
      subjectId = parentSubjectId
    }

    // A simulacro is either the full two-sitting exam or one area; passing both
    // a subject and a sitting number is contradictory.
    if (args.kind === 'simulacro' && subjectId != null) {
      if (!SUBJECT_IDS.includes(subjectId)) {
        throw new ConvexError('Selecciona un área válida para el simulacro.')
      }
      if (args.simulacroSessionNumber != null) {
        throw new ConvexError('Un simulacro por área no tiene sesiones 1 y 2.')
      }
    }

    if (config.requiresSubject) {
      if (subjectId == null || !SUBJECT_IDS.includes(subjectId)) {
        throw new ConvexError('Selecciona una asignatura válida para esta práctica.')
      }
    }

    // The full exam is Sesión 1 or 2; a per-area simulacro is neither.
    const simulacroSessionNumber = args.kind === 'simulacro' && subjectId == null
      ? (args.simulacroSessionNumber ?? 1)
      : undefined

    // Reuse an in-progress session of the same kind (and subject/subtopic, for
    // topic practice) instead of starting a duplicate.
    const now = Date.now()
    const active = await ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind_status', (q) =>
        q.eq('studentId', args.studentId).eq('kind', args.kind).eq('status', 'in_progress'),
      )
      .collect()
    // A timed session whose clock ran out while the student was away is over,
    // not resumable: reopening it auto-submits on load, and 2 answers out of 15
    // would become their placement. It is closed as abandoned — every count of
    // completed sessions already ignores that status — and a fresh one starts.
    for (const session of active) {
      if (isPastDeadline(session, now)) {
        await ctx.db.patch('sessions', session._id, { status: 'abandoned' })
      }
    }
    // Keyed on whatever makes a session of this kind distinct: any
    // subject-scoped kind (topic practice, nivelación) must match on subject, or
    // levelling Matemáticas would resume an unfinished Lectura Crítica session.
    // A builder session is a fresh choice every time: never reused.
    const reusable = args.kind === 'personalizada' ? undefined : active.find(
      (session) =>
        !isPastDeadline(session, now)
        && (session.feedbackMode ?? 'al_final') === feedbackMode
        && session.sourceSessionId === args.retryFromSessionId
        && (!config.requiresSubject
          || (session.subjectId === subjectId && session.subtopicId === subtopicId))
        && (args.kind !== 'simulacro'
          || (session.subjectId === subjectId
            && session.simulacroSessionNumber === simulacroSessionNumber)),
    )
    if (reusable) {
      return reusable._id
    }

    // Nothing new takes an item a live exam asks: grading it elsewhere would
    // leak its key. Exams too, so two sittings never share one.
    const selected = await buildSelection(
      ctx,
      config,
      args.studentId,
      subjectId,
      subtopicId,
      simulacroSessionNumber,
      await loadLiveExamSeal(ctx, args.studentId),
      { retryFromSessionId: args.retryFromSessionId, practice: args.practice },
    )
    if (selected.length === 0) {
      // Naming the area matters: "no hay preguntas" reads as "the app is
      // broken", while "no hay preguntas de Matemáticas todavía" reads as
      // "this part isn't loaded yet", which is what is actually true.
      const areaLabel = subjectId == null ? null : getSubjectLabel(subjectId)
      throw new ConvexError(
        areaLabel == null
          ? 'Todavía no hay preguntas cargadas. Vuelve a intentarlo más tarde.'
          : `Todavía no hay preguntas de ${areaLabel} cargadas. Prueba con otra área.`,
      )
    }

    // A timed builder session runs at the official pace for what it got.
    const sessionTimeLimitMs = args.kind === 'personalizada' && args.practice?.timed === true
      ? selected.length * officialMsPerQuestion({ kind: args.kind })
      : timeLimitMs
    const practiceScope = args.practice == null ? null : resolvePracticeScope(args.practice)

    const sessionId = await ctx.db.insert('sessions', {
      studentId: args.studentId,
      kind: args.kind,
      status: 'in_progress',
      recommendationSource: recommendationSourceForKind(args.kind),
      // A per-area simulacro keeps its area, or it reads as the full exam's
      // Sesión 1 in the hub, the history filter and the whole-exam score.
      subjectId: config.requiresSubject || args.kind === 'simulacro'
        ? subjectId
        : practiceScope != null && 'subjectId' in practiceScope
          ? practiceScope.subjectId ?? undefined
          : undefined,
      subtopicId,
      simulacroSessionNumber,
      startedAt: now,
      timeLimitMs: sessionTimeLimitMs ?? undefined,
      expiresAt: sessionTimeLimitMs != null ? now + sessionTimeLimitMs : undefined,
      questionCount: selected.length,
      currentPosition: 1,
      feedbackMode: args.feedbackMode == null ? undefined : feedbackMode,
      sourceSessionId: args.retryFromSessionId,
      practiceSource: args.practice?.source,
    })

    let position = 1
    for (const item of selected) {
      await ctx.db.insert('sessionQuestions', {
        sessionId,
        questionId: item.questionId,
        position,
        selectionReason: item.selectionReason,
        selectionMetadata: item.selectionMetadata,
      })
      position += 1
    }

    return sessionId
  },
})

export const getActiveSession = query({
  args: {
    studentId: v.id('students'),
    kind: v.optional(sessionKindValidator),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    // A session whose clock ran out can no longer be completed (see
    // `completeSession`), so "Continúa donde quedaste" must not lead to it.
    const now = Date.now()
    return sessions
      .filter((session) => session.status === 'in_progress' || session.status === 'created')
      .filter((session) => !isPastDeadline(session, now, COMPLETION_GRACE_MS))
      .filter((session) => args.kind == null || session.kind === args.kind)
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  },
})

export const getReviewQueue = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    // Count against the same eligibility pools `repaso` draws from, so the count
    // matches what a review session can actually launch.
    const config = getSessionKindConfig('repaso')
    const due = await collectDueReviewQuestions(ctx, args.studentId, config.eligibilityPools)
    return { dueCount: due.length }
  },
})

export const listSessions = query({
  args: {
    studentId: v.id('students'),
    kind: v.optional(sessionKindValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()

    return sessions
      .filter((session) => args.kind == null || session.kind === args.kind)
      // The diagnostic gate is an onboarding step, not part of the practice
      // history students browse.
      .filter((session) => session.kind !== 'diagnostic')
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, args.limit ?? 50)
  },
})

export const getLatestDiagnostic = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind', (q) =>
        q.eq('studentId', args.studentId).eq('kind', 'diagnostic'),
      )
      .collect()

    return sessions
      .filter((session) => session.status === 'completed')
      .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))[0] ?? null
  },
})

export const getLatestSimulacroScore = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind', (q) =>
        q.eq('studentId', args.studentId).eq('kind', 'simulacro'),
      )
      .collect()
    // Paired exactly as `getSimulacroReport` pairs it, so the hub never shows
    // a whole-exam score built from two different exams.
    const sittings = latestSimulacroExam(sessions)?.sittings ?? []
    const sessionNumbers = sittings.map((session) => session.simulacroSessionNumber ?? 1)

    const subjectTotals = getSimulacroSubjectTargets()
    const subjectScores = scoreSimulacroSubjects(
      subjectTotals,
      sittings.map((session) => session.summary?.subjectScores ?? []),
    )

    return {
      isComplete: sessionNumbers.includes(1) && sessionNumbers.includes(2),
      completedSessionNumbers: sessionNumbers.sort(),
      questionCount: subjectTotals.reduce((sum, target) => sum + target.questionCount, 0),
      subjectScores,
    }
  },
})

export const getSession = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get('sessions', args.sessionId)
    if (session == null) return null

    // This query returns correct answers and explanations once a session is
    // completed, so the owner check has to happen before anything is read.
    await assertOwnsStudent(ctx, session.studentId)

    const sessionQuestions = await ctx.db
      .query('sessionQuestions')
      .withIndex('by_sessionId_position', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    const attempts = await ctx.db
      .query('questionAttempts')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    const attemptBySessionQuestionId = new Map(
      attempts.map((attempt) => [attempt.sessionQuestionId, attempt]),
    )

    const questions = await Promise.all(
      sessionQuestions.map((sessionQuestion) => ctx.db.get('questions', sessionQuestion.questionId)),
    )

    // Shared stimuli for grouped questions, fetched once per group even when
    // four questions in this session point at the same text.
    const groupIds = [
      ...new Set(
        questions
          .map((question) => question?.groupId)
          .filter((groupId): groupId is Id<'questionGroups'> => groupId != null),
      ),
    ]
    const groupDocs = await Promise.all(groupIds.map((groupId) => ctx.db.get('questionGroups', groupId)))
    const groupById = new Map(
      groupDocs
        .filter((group): group is Doc<'questionGroups'> => group != null)
        .map((group) => [group._id, group]),
    )

    // Storage ids are not URLs, so they are resolved here rather than leaving
    // the client to make a round trip per question.
    const stemImageUrls = new Map<string, string>()
    await Promise.all(
      questions.map(async (question) => {
        const id = question?.renderedStemImageId
        if (id == null) return
        const url = await ctx.storage.getUrl(id)
        if (url != null) stemImageUrls.set(id, url)
      }),
    )
    const contextImageUrls = new Map<string, string>()
    await Promise.all(
      [...groupById.values()].map(async (group) => {
        const id = group.renderedContextImageId
        if (id == null) return
        const url = await ctx.storage.getUrl(id)
        if (url != null) contextImageUrls.set(id, url)
      }),
    )

    // Answers, and anything they can be inferred from, are only disclosed once
    // the session is complete — or, in an immediate-feedback practice, once that
    // question is checked — and never for a question a live exam is asking
    // (see `sessionIntegrity.ts`).
    const liveExamQuestionIds = canRevealAnswers(session) || canCheckAnswers(session)
      ? await loadLiveExamQuestionIds(ctx, session.studentId)
      : new Set<string>()

    return {
      session,
      /** The official clock per question, for the live "¿voy a tiempo?" (see `pacing.ts`). */
      officialMsPerQuestion: officialMsPerQuestion(session),
      questions: sessionQuestions
        .map((sessionQuestion, index) => {
          const question = questions[index]
          if (question == null) return null
          const attempt = attemptBySessionQuestionId.get(sessionQuestion._id) ?? null
          const canReviewAnswers = canRevealSessionQuestion(session, attempt, question._id, liveExamQuestionIds)
          const displayQuestion = canReviewAnswers ? question : sealQuestion(question)

          const group = question.groupId == null ? null : groupById.get(question.groupId) ?? null

          return {
            sessionQuestionId: sessionQuestion._id,
            position: sessionQuestion.position,
            selectionReason: sessionQuestion.selectionReason,
            selectionMetadata: sessionQuestion.selectionMetadata ?? null,
            question: displayQuestion,
            // The stem as printed, figure included. Null for questions whose
            // text layer already carries everything.
            stemImageUrl:
              question.renderedStemImageId == null
                ? null
                : stemImageUrls.get(question.renderedStemImageId) ?? null,
            // The shared text this question depends on, plus where it sits in
            // the group ("Pregunta 2 de 4 de este texto").
            group:
              group == null
                ? null
                : {
                    id: group._id,
                    contextMarkdown: group.contextMarkdown,
                    imageUrl:
                      group.renderedContextImageId == null
                        ? null
                        : contextImageUrls.get(group.renderedContextImageId) ?? null,
                    memberCount: group.memberCount,
                    position: (question.groupPosition ?? 0) + 1,
                  },
            // Null until answered: a row holding only a flag or crossed-out
            // options is not an answer.
            attempt:
              attempt?.selectedOption == null
                ? null
                : canReviewAnswers
                  ? attempt
                  : sealAttempt(attempt),
            // Exam tools reveal nothing, so they are returned while solving too.
            flagged: attempt?.flagged === true,
            eliminatedOptions: attempt?.eliminatedOptions ?? [],
            timeSpentMs: attempt?.timeSpentMs ?? null,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item != null),
    }
  },
})

export const submitAnswer = mutation({
  args: {
    sessionId: v.id('sessions'),
    sessionQuestionId: v.id('sessionQuestions'),
    selectedOption: v.string(),
    responseTimeMs: v.number(),
    // Optional so answering never depends on declaring. A student who ignores
    // the prompt still gets a graded attempt; they just get no diagnosis.
    confidence: v.optional(confidenceLevelValidator),
  },
  handler: async (ctx, args) => {
    const { session, sessionQuestion, attempt: existing } = await loadOpenSessionQuestion(
      ctx,
      args.sessionId,
      args.sessionQuestionId,
    )
    assertNotChecked(existing)

    const question = await ctx.db.get('questions', sessionQuestion.questionId)
    if (question == null || question.answerCorrectOption == null) {
      throw new ConvexError('La respuesta correcta no está disponible.')
    }

    const now = Date.now()
    const isCorrect = args.selectedOption === question.answerCorrectOption

    if (existing) {
      await ctx.db.patch('questionAttempts', existing._id, {
        selectedOption: args.selectedOption,
        isCorrect,
        answeredAt: now,
        responseTimeMs: args.responseTimeMs,
        wasSkipped: false,
        // Changing the answer invalidates the old declaration: "seguro" about
        // option B says nothing about the C they just switched to.
        confidence: args.confidence,
      })
    } else {
      await ctx.db.insert('questionAttempts', {
        studentId: session.studentId,
        sessionId: session._id,
        questionId: question._id,
        sessionQuestionId: sessionQuestion._id,
        attemptType: session.kind,
        selectedOption: args.selectedOption,
        isCorrect,
        answeredAt: now,
        responseTimeMs: args.responseTimeMs,
        usedHint: false,
        usedTutor: false,
        hintCount: 0,
        tutorMessageCount: 0,
        wasSkipped: false,
        confidence: args.confidence,
      })
    }

    await ctx.db.patch('sessions', session._id, {
      currentPosition: Math.min(session.questionCount, sessionQuestion.position + 1),
    })

    return { answered: true }
  },
})

export const clearAnswer = mutation({
  args: {
    sessionId: v.id('sessions'),
    sessionQuestionId: v.id('sessionQuestions'),
  },
  handler: async (ctx, args) => {
    const { attempt } = await loadOpenSessionQuestion(ctx, args.sessionId, args.sessionQuestionId)
    assertNotChecked(attempt)
    // Cleared, not deleted: the row also holds the flag, the crossed-out
    // options and the time spent, which outlive the answer.
    if (attempt != null) {
      await ctx.db.patch('questionAttempts', attempt._id, {
        selectedOption: undefined,
        isCorrect: undefined,
        answeredAt: undefined,
        responseTimeMs: undefined,
        confidence: undefined,
      })
    }
    return { cleared: true }
  },
})

/** A checked answer has seen its key: changing it would turn the check into a lookup. */
function assertNotChecked(attempt: Doc<'questionAttempts'> | null) {
  if (attempt?.checkedAt != null) {
    throw new ConvexError('Ya revisaste esta respuesta; no se puede cambiar.')
  }
}

/**
 * "Ver respuesta": in an immediate-feedback practice, grade one answered
 * question now and lock it. Returns that question's key, solution and every
 * option's rationale — nothing about any other question. Never available in an
 * exam or a reto (`canCheckAnswers`), nor for an item a live exam is asking.
 */
export const checkAnswer = mutation({
  args: {
    sessionId: v.id('sessions'),
    sessionQuestionId: v.id('sessionQuestions'),
  },
  handler: async (ctx, args) => {
    const { session, sessionQuestion, attempt } = await loadOpenSessionQuestion(
      ctx,
      args.sessionId,
      args.sessionQuestionId,
    )
    if (!canCheckAnswers(session)) {
      throw new ConvexError('Esta sesión muestra las respuestas solo al final.')
    }
    if (attempt?.selectedOption == null || attempt.isCorrect == null) {
      throw new ConvexError('Elige una respuesta antes de revisarla.')
    }
    const question = await ctx.db.get('questions', sessionQuestion.questionId)
    if (question?.answerCorrectOption == null) {
      throw new ConvexError('La respuesta correcta no está disponible.')
    }
    const liveExamQuestionIds = await loadLiveExamQuestionIds(ctx, session.studentId)
    if (liveExamQuestionIds.has(question._id)) {
      throw new ConvexError('Esta pregunta está en un examen o reto que tienes en curso. La verás al terminarlo.')
    }

    if (attempt.checkedAt == null) {
      await ctx.db.patch('questionAttempts', attempt._id, { checkedAt: Date.now() })
    }
    return {
      selectedOption: attempt.selectedOption,
      isCorrect: attempt.isCorrect,
      correctOption: question.answerCorrectOption,
      solutionMarkdown: question.answerSolutionMarkdown ?? null,
      distractorRationales: question.answerDistractorRationales ?? [],
      explanationSource: question.explanationSource ?? null,
    }
  },
})

/**
 * The session question a student acts on, checked like an answer: their own
 * session, still open, inside its clock. Every write during solve goes through
 * here, so a stale tab cannot edit a sitting that is already scored.
 */
async function loadOpenSessionQuestion(
  ctx: MutationCtx,
  sessionId: Id<'sessions'>,
  sessionQuestionId: Id<'sessionQuestions'>,
) {
  const session = await ctx.db.get('sessions', sessionId)
  if (session == null) {
    throw new ConvexError('Sesión no encontrada.')
  }
  // The id travels in the URL; holding it must not be enough to answer.
  await assertOwnsStudent(ctx, session.studentId)
  if (session.status === 'completed' || session.status === 'abandoned') {
    throw new ConvexError('La sesión ya no está activa.')
  }
  if (isPastDeadline(session, Date.now())) {
    throw new ConvexError('Se acabó el tiempo de esta sesión.')
  }

  const sessionQuestion = await ctx.db.get('sessionQuestions', sessionQuestionId)
  if (sessionQuestion == null || sessionQuestion.sessionId !== sessionId) {
    throw new ConvexError('Pregunta de la sesión no encontrada.')
  }

  const attempt = await ctx.db
    .query('questionAttempts')
    .withIndex('by_sessionQuestionId', (q) => q.eq('sessionQuestionId', sessionQuestionId))
    .unique()
  return { session, sessionQuestion, attempt }
}

/**
 * Writes exam-tool state on the question's attempt. Before an answer exists it
 * creates an unanswered row — no `selectedOption`, no `isCorrect` — which every
 * count of answers already skips.
 */
async function writeAttemptTools(
  ctx: MutationCtx,
  open: Awaited<ReturnType<typeof loadOpenSessionQuestion>>,
  tools: Partial<Pick<Doc<'questionAttempts'>, 'flagged' | 'eliminatedOptions' | 'timeSpentMs'>>,
) {
  if (open.attempt != null) {
    await ctx.db.patch('questionAttempts', open.attempt._id, tools)
    return
  }
  await ctx.db.insert('questionAttempts', {
    studentId: open.session.studentId,
    sessionId: open.session._id,
    questionId: open.sessionQuestion.questionId,
    sessionQuestionId: open.sessionQuestion._id,
    attemptType: open.session.kind,
    usedHint: false,
    usedTutor: false,
    hintCount: 0,
    tutorMessageCount: 0,
    wasSkipped: false,
    ...tools,
  })
}

/** "Marcar para revisar": independent of whether the question is answered. */
export const setQuestionFlag = mutation({
  args: {
    sessionId: v.id('sessions'),
    sessionQuestionId: v.id('sessionQuestions'),
    flagged: v.boolean(),
  },
  handler: async (ctx, args) => {
    const open = await loadOpenSessionQuestion(ctx, args.sessionId, args.sessionQuestionId)
    await writeAttemptTools(ctx, open, { flagged: args.flagged })
    return { flagged: args.flagged }
  },
})

/** Crossed-out options: the full set each time (an empty array restores them all). */
export const setEliminatedOptions = mutation({
  args: {
    sessionId: v.id('sessions'),
    sessionQuestionId: v.id('sessionQuestions'),
    options: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const open = await loadOpenSessionQuestion(ctx, args.sessionId, args.sessionQuestionId)
    const question = await ctx.db.get('questions', open.sessionQuestion.questionId)
    // In booklet order, without repeats; a label the question lacks is refused.
    const eliminatedOptions = (question?.options ?? [])
      .map((option) => option.label)
      .filter((label) => args.options.includes(label))
    if (eliminatedOptions.length !== new Set(args.options).size) {
      throw new ConvexError('Esa opción no existe en esta pregunta.')
    }
    await writeAttemptTools(ctx, open, { eliminatedOptions })
    return { eliminatedOptions }
  },
})

/**
 * Adds one visit's time to the question. The client calls it whenever the
 * question stops being on screen (next, previous, jump, submit, tab hidden),
 * whether or not the answer changed, so `timeSpentMs` is the real total.
 */
export const recordQuestionTime = mutation({
  args: {
    sessionId: v.id('sessions'),
    sessionQuestionId: v.id('sessionQuestions'),
    elapsedMs: v.number(),
  },
  handler: async (ctx, args) => {
    const open = await loadOpenSessionQuestion(ctx, args.sessionId, args.sessionQuestionId)
    const previous = open.attempt?.timeSpentMs ?? 0
    const timeSpentMs = accumulateQuestionTime(previous, args.elapsedMs)
    if (timeSpentMs !== previous) {
      await writeAttemptTools(ctx, open, { timeSpentMs })
    }
    return { timeSpentMs }
  },
})

/**
 * The questions of the student's open sealing sessions — exams and retos, see
 * `sealsItsQuestions` — other than `exceptSessionId`. The bank is shared, so
 * these stay sealed in every other session until that one ends.
 */
async function loadLiveExamQuestionIds(
  ctx: QueryCtx,
  studentId: Id<'students'>,
  exceptSessionId?: Id<'sessions'>,
) {
  const now = Date.now()
  const openSessions = await ctx.db
    .query('sessions')
    .withIndex('by_studentId_status', (q) => q.eq('studentId', studentId).eq('status', 'in_progress'))
    .collect()
  const liveRows = await Promise.all(
    openSessions
      .filter((session) => session._id !== exceptSessionId && sealsItsQuestions(session, now))
      .map((session) =>
        ctx.db
          .query('sessionQuestions')
          .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
          .collect()),
  )
  return new Set<Id<'questions'>>(liveRows.flat().map((row) => row.questionId))
}

/** `isOutsideLiveExam` over the student's live exams, texts included. */
async function loadLiveExamSeal(ctx: QueryCtx, studentId: Id<'students'>): Promise<IsFree> {
  const questionIds = await loadLiveExamQuestionIds(ctx, studentId)
  const questions = await Promise.all([...questionIds].map((questionId) => ctx.db.get('questions', questionId)))
  const groupIds = new Set<string>(questions.flatMap((question) => question?.groupId ?? []))
  return (question) => isOutsideLiveExam(question, { questionIds, groupIds })
}

/** Every served question of a session in report form (see `examReport.ts`). */
async function loadReportItems(
  ctx: QueryCtx,
  session: Doc<'sessions'>,
  liveExamQuestionIds: ReadonlySet<string>,
): Promise<ReportItem[]> {
  const [sessionQuestions, attempts] = await Promise.all([
    ctx.db
      .query('sessionQuestions')
      .withIndex('by_sessionId_position', (q) => q.eq('sessionId', session._id))
      .collect(),
    ctx.db
      .query('questionAttempts')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', session._id))
      .collect(),
  ])
  const questions = await Promise.all(
    sessionQuestions.map((sessionQuestion) => ctx.db.get('questions', sessionQuestion.questionId)),
  )
  const attemptBySessionQuestionId = new Map(
    attempts.map((attempt) => [attempt.sessionQuestionId, attempt]),
  )
  const officialMs = officialMsPerQuestion(session)

  return sessionQuestions.flatMap((sessionQuestion, index) => {
    const question = questions[index]
    if (question?.subjectId == null) return []
    const attempt = attemptBySessionQuestionId.get(sessionQuestion._id)
    return [{
      sessionId: session._id,
      sessionQuestionId: sessionQuestion._id,
      position: sessionQuestion.position,
      subjectId: question.subjectId,
      subtopicId: question.primarySubtopicId ?? null,
      isCorrect: canRevealQuestion(session, question._id, liveExamQuestionIds)
        ? attempt?.isCorrect ?? null
        : null,
      confidence: attempt?.confidence,
      flagged: attempt?.flagged === true,
      timeMs: questionTimeMs(attempt),
      officialMs,
    }]
  })
}

/**
 * The level reveal after a nivelación (see `examReport.buildNivelacionResult`).
 * Null unless it is the caller's completed nivelación: the result is built from
 * correctness, which stays sealed while the sitting is open.
 */
export const getNivelacionResult = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get('sessions', args.sessionId)
    if (session == null) return null
    await assertOwnsStudent(ctx, session.studentId)
    if (
      session.kind !== 'nivelacion'
      || session.subjectId == null
      || session.summary == null
      || !canRevealAnswers(session)
    ) {
      return null
    }

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', session.studentId))
      .collect()
    return {
      sessionId: session._id,
      ...buildNivelacionResult({
        subjectId: session.subjectId,
        summary: session.summary,
        items: await loadReportItems(ctx, session, await loadLiveExamQuestionIds(ctx, session.studentId)),
        isFirstPlacement: isFirstPlacement(sessions, session._id),
      }),
    }
  },
})

/**
 * The post-simulacro report (see `examReport.buildSimulacroReport`). A full
 * exam combines the completed Sesión 1 and 2 of the same exam; a per-area
 * simulacro stands alone. Null unless it is the caller's completed simulacro.
 */
export const getSimulacroReport = query({
  args: {
    sessionId: v.id('sessions'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get('sessions', args.sessionId)
    if (session == null) return null
    await assertOwnsStudent(ctx, session.studentId)
    if (session.kind !== 'simulacro' || !canRevealAnswers(session)) return null

    const simulacros = await ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind', (q) =>
        q.eq('studentId', session.studentId).eq('kind', 'simulacro'))
      .collect()
    const exam = resolveSimulacroExam(simulacros, session)
    const liveExamQuestionIds = await loadLiveExamQuestionIds(ctx, session.studentId)
    const items = (await Promise.all(
      exam.sittings.map((sitting) => loadReportItems(ctx, sitting, liveExamQuestionIds)),
    )).flat()
    const subjectScores = (sittings: Doc<'sessions'>[]) =>
      sittings.map((sitting) => sitting.summary?.subjectScores ?? [])

    return {
      /** The area of a per-area simulacro; null for the full exam. */
      subjectId: session.subjectId ?? null,
      sessionIds: exam.sittings.map((sitting) => sitting._id),
      ...buildSimulacroReport({
        sittings: subjectScores(exam.sittings),
        previousSittings: exam.previous.length === 0 ? null : subjectScores(exam.previous),
        items,
        missingSessionNumbers: exam.missingSessionNumbers,
      }),
    }
  },
})

export const completeSession = mutation({
  args: {
    sessionId: v.id('sessions'),
    // Set when the client completes the session because the timer expired.
    expired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get('sessions', args.sessionId)
    if (session == null) {
      throw new ConvexError('Sesión no encontrada.')
    }
    await assertOwnsStudent(ctx, session.studentId)
    if (session.status === 'completed') {
      return summarize(session)
    }
    // An abandoned session stays abandoned — a stale tab must not score it.
    if (session.status === 'abandoned') {
      throw new ConvexError('La sesión ya no está activa.')
    }
    // The client completes a session the moment its clock runs out, and that
    // time-out is scored even if it arrives a few minutes late. One arriving
    // long after is a student reopening a sitting they left: scoring it would
    // make 2 answers out of 15 their placement. Not patched to abandoned here —
    // a throwing mutation rolls back its writes; `createSession` closes it.
    if (isPastDeadline(session, Date.now(), COMPLETION_GRACE_MS)) {
      throw new ConvexError('Se acabó el tiempo de esta sesión.')
    }

    const sessionQuestions = await ctx.db
      .query('sessionQuestions')
      .withIndex('by_sessionId_position', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    // Scoring grades every item: one a live exam asks would hand over its key.
    const otherLiveExamQuestionIds = await loadLiveExamQuestionIds(ctx, session.studentId, session._id)
    if (!canSettleSession(sessionQuestions.map((item) => item.questionId), otherLiveExamQuestionIds)) {
      throw new ConvexError('Termina el examen o reto que tienes en curso antes de cerrar esta práctica.')
    }
    const attempts = await ctx.db
      .query('questionAttempts')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    const questions = await Promise.all(
      sessionQuestions.map((sessionQuestion) => ctx.db.get('questions', sessionQuestion.questionId)),
    )
    const attemptBySessionQuestionId = new Map(
      attempts.map((attempt) => [attempt.sessionQuestionId, attempt]),
    )
    const answeredAttempts = attempts.filter((attempt) => attempt.isCorrect != null)
    const correctCount = answeredAttempts.filter((attempt) => attempt.isCorrect).length
    const answeredCount = answeredAttempts.length
    const completedAt = Date.now()
    const rawDurationMs = completedAt - session.startedAt
    // For timed sessions, never report a duration beyond the allotted limit.
    const durationMs = session.timeLimitMs != null
      ? Math.min(rawDurationMs, session.timeLimitMs)
      : rawDurationMs

    const subjectBuckets = new Map<
      string,
      { correctCount: number; answeredCount: number; questionCount: number }
    >()
    sessionQuestions.forEach((sessionQuestion, index) => {
      const question = questions[index]
      if (question?.subjectId == null) return
      const bucket = subjectBuckets.get(question.subjectId) ?? {
        correctCount: 0,
        answeredCount: 0,
        questionCount: 0,
      }
      const attempt = attemptBySessionQuestionId.get(sessionQuestion._id)
      bucket.questionCount += 1
      if (attempt?.isCorrect != null) {
        bucket.answeredCount += 1
      }
      if (attempt?.isCorrect === true) {
        bucket.correctCount += 1
      }
      subjectBuckets.set(question.subjectId, bucket)
    })
    const subjectScores = [...subjectBuckets.entries()]
      .map(([subjectId, bucket]) => ({
        subjectId,
        correctCount: bucket.correctCount,
        answeredCount: bucket.answeredCount,
        questionCount: bucket.questionCount,
        score: bucket.questionCount === 0
          ? 0
          : Math.round((bucket.correctCount / bucket.questionCount) * 100),
      }))
      .sort((a, b) => a.subjectId.localeCompare(b.subjectId))

    const summary = {
      correctCount,
      answeredCount,
      questionCount: session.questionCount,
      accuracy: session.questionCount === 0 ? 0 : correctCount / session.questionCount,
      durationMs,
      subjectScores,
    }

    await ctx.db.patch('sessions', args.sessionId, {
      status: 'completed',
      completedAt,
      currentPosition: session.questionCount,
      summary,
    })

    await calibrateDifficulty(ctx, {
      studentId: session.studentId,
      attempts: answeredAttempts,
      questionById: new Map(
        questions
          .filter((question): question is Doc<'questions'> => question != null)
          .map((question) => [question._id, question]),
      ),
    })

    await tallyAnswerStats(ctx, { session, attempts: answeredAttempts, completedAt })

    await ctx.runMutation(internal.progress.rebuildStudentProgress, {
      studentId: session.studentId,
    })

    // After the rebuild, so a subtopic answered for the first time has its row.
    await applyMastery(ctx, {
      session,
      sessionQuestions,
      questions,
      attemptBySessionQuestionId,
      now: completedAt,
    })

    return { sessionId: args.sessionId, ...summary }
  },
})

/**
 * Fold a finished session's attempts into the Elo ratings (see `elo.ts`).
 *
 * Runs at completion rather than on every `submitAnswer` for two reasons: an
 * answer can be changed any number of times before the session ends (only the
 * final one is evidence), and updating a shared question document on every
 * keystroke-speed answer would make popular questions a write-contention
 * hotspot. `completeSession` early-returns when already completed, so each
 * attempt is folded in exactly once.
 *
 * ponytail: O(questions in session) document writes, inline in the completing
 * mutation. Fine at 250 questions (the biggest simulacro); if sessions ever get
 * much larger, move this to a scheduled action.
 */
async function calibrateDifficulty(
  ctx: MutationCtx,
  args: {
    studentId: Id<'students'>
    attempts: Doc<'questionAttempts'>[]
    questionById: Map<Id<'questions'>, Doc<'questions'>>
  },
) {
  const student = await ctx.db.get('students', args.studentId)
  if (student == null) return

  const abilityBySubject = { ...(student.abilityBySubject ?? {}) }
  const abilityAttemptsBySubject = { ...(student.abilityAttemptsBySubject ?? {}) }
  const now = Date.now()

  // Chronological: each update feeds the next, so order is part of the result.
  const ordered = [...args.attempts].sort(
    (a, b) => (a.answeredAt ?? 0) - (b.answeredAt ?? 0),
  )

  for (const attempt of ordered) {
    if (attempt.isCorrect == null) continue
    const question = args.questionById.get(attempt.questionId)
    // An untagged question has no area to attribute ability to, so it can
    // calibrate nothing — skip rather than inventing a bucket for it.
    if (question?.subjectId == null) continue

    const subjectId = question.subjectId
    const questionRating = question.difficultyRating ?? DEFAULT_RATING
    const questionAttemptCount = question.difficultyAttemptCount ?? 0

    const next = updateRatings({
      questionRating,
      questionAttemptCount,
      abilityRating: abilityBySubject[subjectId] ?? DEFAULT_RATING,
      abilityAttemptCount: abilityAttemptsBySubject[subjectId] ?? 0,
      isCorrect: attempt.isCorrect,
    })

    abilityBySubject[subjectId] = next.abilityRating
    abilityAttemptsBySubject[subjectId] = (abilityAttemptsBySubject[subjectId] ?? 0) + 1

    await ctx.db.patch('questions', question._id, {
      difficultyRating: next.questionRating,
      difficultyAttemptCount: questionAttemptCount + 1,
      difficultyUpdatedAt: now,
    })
  }

  await ctx.db.patch('students', args.studentId, {
    abilityBySubject,
    abilityAttemptsBySubject,
    updatedAt: now,
  })
}

/**
 * Add this session's answers to each question's "% eligió cada opción" tally
 * (`answerStats.ts`): only a student's first settled answer, given before the
 * key was ever shown to them. Once per session, like the Elo calibration.
 */
async function tallyAnswerStats(
  ctx: MutationCtx,
  args: { session: Doc<'sessions'>; attempts: Doc<'questionAttempts'>[]; completedAt: number },
) {
  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_studentId', (q) => q.eq('studentId', args.session.studentId))
    .collect()
  const completedAtById = new Map(sessions.map((session) => [
    session._id,
    canRevealAnswers(session) ? session.completedAt : undefined,
  ]))

  for (const attempt of args.attempts) {
    if (attempt.selectedOption == null || attempt.answeredAt == null) continue
    const others = await ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId_questionId', (q) =>
        q.eq('studentId', args.session.studentId).eq('questionId', attempt.questionId))
      .collect()
    const counts = countsTowardStats(
      { answeredAt: attempt.answeredAt, completedAt: args.completedAt },
      others
        .filter((other) => other._id !== attempt._id)
        .map((other) => ({ checkedAt: other.checkedAt, completedAt: completedAtById.get(other.sessionId) })),
    )
    if (!counts) continue
    const row = await ctx.db
      .query('questionAnswerStats')
      .withIndex('by_questionId', (q) => q.eq('questionId', attempt.questionId))
      .unique()
    const tally = addToTally(row, { ...attempt, selectedOption: attempt.selectedOption })
    if (row == null) await ctx.db.insert('questionAnswerStats', { questionId: attempt.questionId, ...tally })
    else await ctx.db.patch('questionAnswerStats', row._id, tally)
  }
}

/**
 * One-off: build each question's tally from the answers given before it was
 * kept (`tallyAnswers`), ten questions per run, chaining itself to the end.
 * Replaces each tally, so it can run again; run it right after deploying:
 * `bunx convex run sessions:backfillQuestionAnswerStats`
 */
export const backfillQuestionAnswerStats = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query('questions').paginate({ numItems: 10, cursor: args.cursor ?? null })
    const sessionById = new Map<Id<'sessions'>, Doc<'sessions'> | null>()
    for (const question of page.page) {
      const attempts = await ctx.db
        .query('questionAttempts')
        .withIndex('by_questionId', (q) => q.eq('questionId', question._id))
        .collect()
      for (const sessionId of new Set(attempts.map((attempt) => attempt.sessionId))) {
        if (!sessionById.has(sessionId)) sessionById.set(sessionId, await ctx.db.get('sessions', sessionId))
      }
      const tally = tallyAnswers(attempts.map((attempt) => {
        const session = sessionById.get(attempt.sessionId)
        return { ...attempt, completedAt: session != null && canRevealAnswers(session) ? session.completedAt : undefined }
      }))
      const row = await ctx.db
        .query('questionAnswerStats')
        .withIndex('by_questionId', (q) => q.eq('questionId', question._id))
        .unique()
      if (row != null) await ctx.db.delete('questionAnswerStats', row._id)
      if (tally != null) await ctx.db.insert('questionAnswerStats', { questionId: question._id, ...tally })
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.sessions.backfillQuestionAnswerStats, { cursor: page.continueCursor })
    }
  },
})

/**
 * Move each subtopic's mastery level on this session's evidence (`mastery.ts`).
 * Like the Elo calibration it runs once per session: `completeSession` returns
 * early when the session is already completed.
 */
async function applyMastery(
  ctx: MutationCtx,
  args: {
    session: Doc<'sessions'>
    sessionQuestions: Doc<'sessionQuestions'>[]
    questions: (Doc<'questions'> | null)[]
    attemptBySessionQuestionId: Map<Id<'sessionQuestions'>, Doc<'questionAttempts'>>
    now: number
  },
) {
  // Only questions whose key the student had not been shown count.
  const [studentAttempts, studentSessions] = await Promise.all([
    ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.session.studentId))
      .collect(),
    ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.session.studentId))
      .collect(),
  ])
  const revealed = revealedQuestionIds(studentAttempts, studentSessions, args.session._id)
  const evidenceBySubtopic = new Map<string, SubtopicEvidence>()
  args.sessionQuestions.forEach((sessionQuestion, index) => {
    const subtopicId = args.questions[index]?.primarySubtopicId
    if (subtopicId == null || revealed.has(sessionQuestion.questionId)) return
    const evidence = evidenceBySubtopic.get(subtopicId) ?? { questionCount: 0, answeredCount: 0, correctCount: 0 }
    const attempt = args.attemptBySessionQuestionId.get(sessionQuestion._id)
    evidence.questionCount += 1
    if (attempt?.isCorrect != null) evidence.answeredCount += 1
    if (attempt?.isCorrect === true) evidence.correctCount += 1
    evidenceBySubtopic.set(subtopicId, evidence)
  })
  const context = masteryContext(args.session, evidenceBySubtopic.size)

  for (const [subtopicId, evidence] of evidenceBySubtopic) {
    if (evidence.answeredCount === 0) continue
    const aggregate = await ctx.db
      .query('learnerSubtopicAggregates')
      .withIndex('by_studentId_subtopicId', (q) =>
        q.eq('studentId', args.session.studentId).eq('subtopicId', subtopicId))
      .first()
    if (aggregate == null) continue
    // The rebuilt aggregate already holds this session's answers; a row from
    // before levels existed is judged on the answers that came before them.
    const current = aggregate.masteryLevel ?? masteryLevelOf({
      attemptCount: Math.max(0, aggregate.attemptCount - evidence.answeredCount),
      correctCount: Math.max(0, aggregate.correctCount - evidence.correctCount),
    })
    await ctx.db.patch('learnerSubtopicAggregates', aggregate._id, {
      masteryLevel: nextMasteryLevel(current, evidence, context),
      masteryUpdatedAt: args.now,
    })
  }
}

/**
 * "N preguntas disponibles" for the practice builder, live as the student
 * changes filters. A filter error comes back as `error` instead of throwing, so
 * the sheet keeps rendering.
 */
export const getPracticeBuilderCounts = query({
  args: {
    studentId: v.id('students'),
    filters: v.object(practiceFilterFields),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)
    const scope = resolvePracticeScope(args.filters)
    if ('error' in scope) {
      return { available: 0, byDifficulty: { basico: 0, medio: 0, avanzado: 0 }, error: scope.error }
    }
    const pools = getSessionKindConfig('personalizada').eligibilityPools
    const [bank, history] = await Promise.all([
      loadPracticeBank(ctx, scope, pools),
      loadPracticeHistory(ctx, args.studentId),
    ])
    return { ...practiceBuilderCounts(bank, args.filters, history), error: null }
  },
})

/** Questions per `getQuestionAnswerStats` call: the largest session (a full sitting). */
const MAX_STATS_QUESTIONS = 250

/**
 * "% eligió cada opción" and the median time (`answerStats.ts`), read from the
 * running tally: one row per question, whatever the number of students. Only
 * for questions the caller already saw in one of their completed sessions (or
 * an admin), and never for an item a live exam of theirs is asking: the most
 * chosen option often is the key. Questions the caller may not see are left
 * out of the result.
 */
export const getQuestionAnswerStats = query({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const callerId = await requireAuthenticatedStudentId(ctx)
    if (args.questionIds.length > MAX_STATS_QUESTIONS) {
      throw new ConvexError('Demasiadas preguntas a la vez.')
    }
    const caller = await ctx.db.get('students', callerId)
    const isAdmin = caller?.isAdmin === true
    const callerSessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', callerId))
      .collect()
    const completedIds = new Set<string>(callerSessions.filter(canRevealAnswers).map((session) => session._id))
    const liveExamQuestionIds = await loadLiveExamQuestionIds(ctx, callerId)

    const results = []
    for (const questionId of new Set(args.questionIds)) {
      if (liveExamQuestionIds.has(questionId)) continue
      if (!isAdmin) {
        const own = await ctx.db
          .query('questionAttempts')
          .withIndex('by_studentId_questionId', (q) => q.eq('studentId', callerId).eq('questionId', questionId))
          .collect()
        if (!own.some((attempt) => completedIds.has(attempt.sessionId))) continue
      }
      const question = await ctx.db.get('questions', questionId)
      if (question == null) continue

      const tally = await ctx.db
        .query('questionAnswerStats')
        .withIndex('by_questionId', (q) => q.eq('questionId', questionId))
        .unique()
      results.push({
        questionId,
        ...summarizeAnswerStats(tally, question.options.map((option) => option.label)),
      })
    }
    return results
  },
})

function summarize(session: Doc<'sessions'>) {
  return {
    sessionId: session._id,
    correctCount: session.summary?.correctCount ?? 0,
    answeredCount: session.summary?.answeredCount ?? 0,
    questionCount: session.questionCount,
    accuracy: session.summary?.accuracy ?? 0,
    durationMs: session.summary?.durationMs ?? 0,
    subjectScores: session.summary?.subjectScores ?? [],
  }
}
