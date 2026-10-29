/**
 * Mastery per subtopic, Khan-style: five levels that move on evidence.
 *
 * Accuracy alone overstates readiness: ten right answers in a block of the same
 * subtopic say less than two right answers among other topics, which is how
 * Saber 11 asks. So focused practice can raise a subtopic up to `competente`,
 * and only a mixed session (exam, nivelación, reto, recommended practice over
 * three or more subtopics) reaches `dominado` — or takes a level away. Time
 * alone never lowers a level; it only decides what the reto re-tests.
 *
 * Applied once per completed session (`sessions.completeSession`), stored on
 * `learnerSubtopicAggregates`. Pure, and free of `convex/*` imports so the web
 * can use it too.
 */
import type { PracticeSource } from './practiceBuilder'
import type { FeedbackMode, SessionKind } from './sessionKinds'

export const MASTERY_LEVELS = ['sin_empezar', 'intentado', 'familiar', 'competente', 'dominado'] as const
export type MasteryLevel = (typeof MASTERY_LEVELS)[number]

export const MASTERY_LEVEL_LABELS: Record<MasteryLevel, string> = {
  sin_empezar: 'Sin empezar',
  intentado: 'Intentado',
  familiar: 'Familiar',
  competente: 'Competente',
  dominado: 'Dominado',
}

/** Khan's points per subtopic; a course's % is points over 100 per subtopic. */
export const MASTERY_POINTS: Record<MasteryLevel, number> = {
  sin_empezar: 0,
  intentado: 0,
  familiar: 50,
  competente: 80,
  dominado: 100,
}

/** A perfect practice reaches `competente` only over at least this many questions. */
export const MIN_QUESTIONS_FOR_COMPETENTE = 4
/** Share of right answers that makes a practice `familiar`. */
export const FAMILIAR_ACCURACY = 0.7
/** Subtopics a reto tests, two questions each (Khan's Mastery Challenge). */
export const RETO_SUBTOPIC_COUNT = 3
export const RETO_QUESTIONS_PER_SUBTOPIC = 2
/** Distinct subtopics that turn a recommended practice into mixed evidence. */
export const MIXED_MIN_SUBTOPICS = 3

/**
 * How a session's answers count: `practica` raises up to `competente` and never
 * lowers; `mixta` raises one level when all right and lowers one on any miss;
 * `reto` raises when all right, lowers when all wrong, else leaves it; `repaso`
 * (builder sources of seen items) leaves it: their keys were shown, so a right
 * answer is memory.
 */
export type MasteryContext = 'practica' | 'mixta' | 'reto' | 'repaso'

const MIXED_KINDS: readonly SessionKind[] = ['diagnostic', 'nivelacion', 'simulacro']
/** Builder sources made of items the student already saw graded, keys included. */
const SEEN_KEY_SOURCES: readonly PracticeSource[] = ['falladas', 'marcadas']

export function masteryContext(
  session: { kind: SessionKind; feedbackMode?: FeedbackMode; practiceSource?: PracticeSource },
  subtopicCount: number,
): MasteryContext {
  if (session.kind === 'reto') return 'reto'
  // The spaced repaso serves unseen siblings (F34); its originals are already
  // excluded as revealed (`revealedQuestionIds`), so what remains is real evidence.
  if (session.kind === 'repaso') return 'practica'
  if (session.practiceSource != null && SEEN_KEY_SOURCES.includes(session.practiceSource)) return 'repaso'
  // Seeing the key after each answer is learning, not an assessment.
  if (session.feedbackMode === 'inmediata') return 'practica'
  if (MIXED_KINDS.includes(session.kind)) return 'mixta'
  if (session.kind === 'recommended' && subtopicCount >= MIXED_MIN_SUBTOPICS) return 'mixta'
  return 'practica'
}

/**
 * Questions whose key the student was already shown outside `exceptSessionId`:
 * any served in a completed session (its review discloses every key) or checked
 * in an immediate-feedback practice. A right answer on one is memory, so it is
 * not mastery evidence.
 */
export function revealedQuestionIds(
  attempts: { questionId: string; sessionId: string; checkedAt?: number }[],
  sessions: { _id: string; status: string }[],
  exceptSessionId: string,
): Set<string> {
  const completedIds = new Set(sessions.filter((session) => session.status === 'completed').map((session) => session._id))
  return new Set(
    attempts
      .filter((attempt) =>
        attempt.sessionId !== exceptSessionId
        && (completedIds.has(attempt.sessionId) || attempt.checkedAt != null))
      .map((attempt) => attempt.questionId),
  )
}

/** One subtopic's answers in one completed session. Blanks count as misses. */
export interface SubtopicEvidence {
  questionCount: number
  answeredCount: number
  correctCount: number
  /** Answers given after asking the tutor: right counts, but not as independent mastery. */
  tutorAssistedCount?: number
}

const rank = (level: MasteryLevel) => MASTERY_LEVELS.indexOf(level)
const atLeast = (level: MasteryLevel, floor: MasteryLevel) => (rank(level) >= rank(floor) ? level : floor)

function promote(level: MasteryLevel): MasteryLevel {
  // All right is at least 70%: below `familiar` lands on it.
  if (rank(level) < rank('familiar')) return 'familiar'
  return MASTERY_LEVELS[Math.min(rank(level) + 1, MASTERY_LEVELS.length - 1)] ?? level
}

function demote(level: MasteryLevel): MasteryLevel {
  if (rank(level) <= rank('intentado')) return 'intentado'
  return MASTERY_LEVELS[rank(level) - 1] ?? level
}

export function nextMasteryLevel(
  current: MasteryLevel,
  evidence: SubtopicEvidence,
  context: MasteryContext,
): MasteryLevel {
  // A session left blank on this subtopic says nothing about it.
  if (evidence.answeredCount === 0 || evidence.questionCount === 0 || context === 'repaso') return current
  const allRight = evidence.correctCount === evidence.questionCount

  if (context === 'practica') {
    // Competente means "can do it alone" (Khan): help from the tutor caps the session at familiar.
    const independent = (evidence.tutorAssistedCount ?? 0) === 0
    const earned: MasteryLevel = allRight && independent && evidence.questionCount >= MIN_QUESTIONS_FOR_COMPETENTE
      ? 'competente'
      : evidence.correctCount / evidence.questionCount >= FAMILIAR_ACCURACY
        ? 'familiar'
        : 'intentado'
    return atLeast(current, earned)
  }

  if (allRight) return promote(current)
  if (context === 'reto' && evidence.correctCount > 0) return current
  return demote(current)
}

/**
 * The level of an aggregate. Aggregates built before levels existed carry none:
 * they get a conservative one from their accuracy, never above `familiar`,
 * because nothing says that evidence came from a perfect or mixed session.
 */
export function masteryLevelOf(aggregate: {
  masteryLevel?: MasteryLevel
  attemptCount: number
  correctCount: number
}): MasteryLevel {
  if (aggregate.masteryLevel != null) return aggregate.masteryLevel
  if (aggregate.attemptCount === 0) return 'sin_empezar'
  return aggregate.correctCount / aggregate.attemptCount >= FAMILIAR_ACCURACY ? 'familiar' : 'intentado'
}

/**
 * A subject's or course's mastery, count-based: points over 100 per subtopic.
 * `subtopicCount` is every subtopic of the scope, practiced or not, so the %
 * does not inflate by leaving the hard ones untouched.
 */
export function summarizeMastery(levels: MasteryLevel[], subtopicCount: number) {
  const points = levels.reduce((sum, level) => sum + MASTERY_POINTS[level], 0)
  const maxPoints = subtopicCount * MASTERY_POINTS.dominado
  return {
    points,
    maxPoints,
    percent: maxPoints === 0 ? 0 : Math.round((points / maxPoints) * 100),
    competenteOrAbove: levels.filter((level) => rank(level) >= rank('competente')).length,
    subtopicCount,
  }
}

/**
 * Subtopics the reto may test, best first: practiced ones only, `familiar` and
 * `competente` before the rest (they have a level to win), and within each the
 * one reviewed longest ago. The caller takes the first three that still have
 * two questions to ask.
 */
export function orderRetoCandidates<T extends {
  masteryLevel?: MasteryLevel
  masteryUpdatedAt?: number
  attemptCount: number
  correctCount: number
}>(aggregates: T[]): T[] {
  const tier = (level: MasteryLevel) => (level === 'familiar' || level === 'competente' ? 0 : 1)
  return aggregates
    .map((aggregate) => ({ aggregate, level: masteryLevelOf(aggregate) }))
    .filter((item) => item.level !== 'sin_empezar')
    .sort((a, b) =>
      tier(a.level) - tier(b.level)
      || (a.aggregate.masteryUpdatedAt ?? 0) - (b.aggregate.masteryUpdatedAt ?? 0))
    .map((item) => item.aggregate)
}

/**
 * Round-robin over per-subtopic blocks so the reto mixes them, as the exam does.
 * Questions sharing a text (`groupId`) move as one unit and stay together.
 */
export function interleaveBlocks<T extends { groupId?: string }>(blocks: T[][]): T[] {
  const units = blocks.map((block) => {
    const result: T[][] = []
    for (const item of block) {
      const last = result.at(-1)
      if (item.groupId != null && last?.[0]?.groupId === item.groupId) last.push(item)
      else result.push([item])
    }
    return result
  })
  const ordered: T[] = []
  for (let round = 0; units.some((list) => round < list.length); round += 1) {
    for (const list of units) ordered.push(...(list[round] ?? []))
  }
  return ordered
}

/**
 * Spaced review per subtopic: Leitner boxes over days (F34). A session that
 * gets every question of a subtopic right moves it up a box and lets it rest
 * longer; any miss puts it back in the first box, due tomorrow. Spacing is one
 * of the most robust effects in learning research, and "a subtopic" rather than
 * "a question" is what comes back, so the repaso can serve an unseen sibling
 * instead of an item whose key the student already saw.
 */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 21, 60] as const
const DAY_MS = 86_400_000

export function nextReviewState(box: number | undefined, allRight: boolean, now: number, dueAt?: number) {
  // Cramming does not space: all right before the date keeps the box and the date.
  if (allRight && dueAt != null && dueAt > now) return { reviewBox: box ?? 0, reviewDueAt: dueAt }
  const reviewBox = allRight ? Math.min((box ?? 0) + 1, REVIEW_INTERVAL_DAYS.length - 1) : 0
  return { reviewBox, reviewDueAt: now + REVIEW_INTERVAL_DAYS[reviewBox]! * DAY_MS }
}

/** Aggregates from before spacing carry no date: any miss on them makes them due now. */
export function isReviewDue(
  aggregate: { reviewDueAt?: number; attemptCount: number; correctCount: number },
  now: number,
) {
  if (aggregate.reviewDueAt != null) return aggregate.reviewDueAt <= now
  return aggregate.attemptCount > 0 && aggregate.correctCount < aggregate.attemptCount
}
