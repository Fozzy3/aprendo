import { ConvexError, v } from 'convex/values'
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { assertIsStudent } from './auth'
import { masteryLevelOf, type MasteryLevel } from './mastery'
import { canCheckAnswers, canRevealQuestion, isPastDeadline } from './sessionIntegrity'
import { loadLiveExamQuestionIds, loadOpenSessionQuestion, writeAttemptTools } from './sessions'
import { hash } from './simulacroForm'

/**
 * The guided path (F56): after a wrong answer the app asks instead of telling.
 * "Todavía no", then why they picked it (the diagnosis), then a ladder of
 * questions, then one retry. The answer shows at the end, or on the "Muéstrame"
 * that appears after the first step. Only where `canCheckAnswers` is true:
 * exams and the reto keep their seals.
 *
 * Progress lives on the attempt (`guidedStep`, `guidedOutcome`), so a reload
 * resumes the path and no step can be requested out of turn. Only the first
 * answer is evidence: nothing here writes `selectedOption` or `isCorrect`.
 */

type GuideStep = Doc<'questionGuides'>['byOption'][string]['diagnose']
type OptionPath = Doc<'questionGuides'>['byOption'][string]

/**
 * Whether a guide may reach a student. A teacher has to approve it first (G1:
 * a guide on a wrong key teaches the error); the only exception is a pending
 * guide on a seed item opened for the demo (`seedBank.publishSeedForDemo`), so
 * it works for rectors before any teacher has reviewed the seed bank. Every
 * other authored guide waits, like the rest.
 */
export function isGuideServable(guide: { status: string }, question: { eligibilityReasons?: string[] }) {
  return guide.status === 'approved' || (guide.status === 'pending' && question.eligibilityReasons?.includes('seed_demo') === true)
}

/** Help fades with mastery: the whole ladder while it is low, one question at `competente`, none at `dominado`. */
export function ladderLength(level: MasteryLevel, available: number) {
  if (level === 'dominado') return 0
  return level === 'competente' ? Math.min(1, available) : available
}

/** The steps of a path, opening with the diagnosis. An empty ladder has no path at all, only the retry. */
export function pathSteps(entry: OptionPath, level: MasteryLevel): GuideStep[] {
  const length = ladderLength(level, entry.steps.length)
  return length === 0 ? [] : [entry.diagnose, ...entry.steps.slice(0, length)]
}

/**
 * Tests a right answer given without confidence. A guide only has paths for the
 * wrong options, each ending in that option's contradiction, so this asks about
 * the student's own reasoning instead: no tap is wrong and nothing depends on the item.
 */
/**
 * Guides are written with the right choice first, so the order is seeded per
 * question and step before it reaches a student. Stable, because a tap comes
 * back as an index into this same order.
 */
export function shuffledChoices(entry: OptionPath, questionId: string): OptionPath {
  const shuffle = (step: GuideStep, stepIndex: number): GuideStep => ({
    ...step,
    choices: step.choices
      .map((choice, position) => ({ choice, rank: hash(`${position}:${questionId}:${stepIndex}`) }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ choice }) => choice),
  })
  return { diagnose: shuffle(entry.diagnose, 0), steps: entry.steps.map((step, index) => shuffle(step, index + 1)) }
}

const WHY_STEP: GuideStep = {
  prompt: '¿Cómo llegaste a esa respuesta?',
  choices: [{ text: 'La razoné con el enunciado' }, { text: 'Descarté las otras opciones' }, { text: 'Fue una corazonada' }],
}

async function loadServableGuide(ctx: QueryCtx, question: Doc<'questions'>) {
  const guide = await ctx.db
    .query('questionGuides')
    .withIndex('by_questionId', (q) => q.eq('questionId', question._id))
    .first()
  return guide != null && isGuideServable(guide, question) ? guide : null
}

type GuidedPath = {
  attempt: Doc<'questionAttempts'>
  question: Doc<'questions'>
  guide: Doc<'questionGuides'> | null
  steps: GuideStep[]
  stepIndex: number
  isWhy: boolean
}

/**
 * The path of a checked answer, or null when none applies: not checked yet, a
 * sealed kind, or an item a live exam of this student asks (the bank is shared).
 */
async function loadPath(
  ctx: QueryCtx,
  open: Awaited<ReturnType<typeof loadOpenSessionQuestion>>,
): Promise<GuidedPath | null> {
  const { session, sessionQuestion, attempt } = open
  if (!canCheckAnswers(session) || attempt?.checkedAt == null || attempt.selectedOption == null) return null
  if ((await loadLiveExamQuestionIds(ctx, session.studentId, { askingSessionId: session._id })).has(sessionQuestion.questionId)) return null
  const question = await ctx.db.get('questions', sessionQuestion.questionId)
  if (question?.answerCorrectOption == null) return null

  const guide = await loadServableGuide(ctx, question)
  const stepIndex = attempt.guidedStep ?? 0
  if (attempt.isCorrect === true) {
    // Right but unsure: one "why" question tests a lucky guess. Right and sure moves on.
    const asksWhy = guide != null && (attempt.confidence === 'unsure' || attempt.confidence === 'guess')
    return asksWhy ? { attempt, question, guide, steps: [WHY_STEP], stepIndex, isWhy: true } : null
  }
  const entry = guide?.byOption[attempt.selectedOption]
  const aggregate = question.primarySubtopicId == null
    ? null
    : await ctx.db
        .query('learnerSubtopicAggregates')
        .withIndex('by_studentId_subtopicId', (q) =>
          q.eq('studentId', session.studentId).eq('subtopicId', question.primarySubtopicId))
        .first()
  const level = aggregate == null ? 'sin_empezar' : masteryLevelOf(aggregate)
  const steps = entry == null ? [] : pathSteps(shuffledChoices(entry, question._id), level)
  return { attempt, question, guide, steps, stepIndex, isWhy: false }
}

function endedView(path: GuidedPath, outcome: 'self_corrected' | 'revealed') {
  return {
    phase: 'ended' as const,
    outcome,
    correctOption: path.question.answerCorrectOption!,
    solutionMarkdown: path.question.answerSolutionMarkdown ?? null,
    distractorRationales: path.question.answerDistractorRationales ?? [],
    explanationSource: path.question.explanationSource ?? null,
    reveal: path.guide?.reveal ?? null,
  }
}

/** What the student may see now. Text only: the right choice stays on the server until the tap. */
function viewOf(path: GuidedPath) {
  if (path.isWhy && path.stepIndex >= path.steps.length) return null
  if (path.attempt.guidedOutcome != null) return endedView(path, path.attempt.guidedOutcome)
  const step = path.steps[path.stepIndex]
  if (step != null) {
    const choices = step.choices.map((choice) => choice.text)
    return path.isWhy
      ? { phase: 'why' as const, prompt: step.prompt, choices }
      : {
          phase: 'step' as const,
          stepIndex: path.stepIndex,
          stepCount: path.steps.length,
          prompt: step.prompt,
          choices,
          // "Muéstrame" only appears after the first step (F56).
          canReveal: path.stepIndex >= 1,
        }
  }
  return { phase: 'retry' as const, canReveal: path.steps.length > 0 }
}

const pathArgs = {
  sessionId: v.id('sessions'),
  sessionQuestionId: v.id('sessionQuestions'),
}

/** The next step of the path (reactive: the screen re-reads it after each tap). */
export const getGuideStep = query({
  args: pathArgs,
  handler: async (ctx, args) => {
    const session = await ctx.db.get('sessions', args.sessionId)
    if (session == null) return null
    await assertIsStudent(ctx, session.studentId)
    if (session.status === 'completed' || session.status === 'abandoned' || isPastDeadline(session, Date.now())) return null
    const path = await loadPath(ctx, await loadOpenSessionQuestion(ctx, args.sessionId, args.sessionQuestionId))
    return path == null ? null : viewOf(path)
  },
})

async function requirePath(ctx: MutationCtx, args: { sessionId: Id<'sessions'>; sessionQuestionId: Id<'sessionQuestions'> }) {
  const path = await loadPath(ctx, await loadOpenSessionQuestion(ctx, args.sessionId, args.sessionQuestionId))
  if (path == null) throw new ConvexError('Esta pregunta no tiene un camino guiado abierto.')
  return path
}

/**
 * One tap on the current step. Returns whether it was the right choice, null
 * on the diagnosis and the "why", which have no wrong answer; either way the path advances.
 */
export const answerGuideStep = mutation({
  args: { ...pathArgs, choiceIndex: v.number() },
  handler: async (ctx, args) => {
    const path = await requirePath(ctx, args)
    const view = viewOf(path)
    if (view?.phase !== 'step' && view?.phase !== 'why') throw new ConvexError('Este camino ya no tiene más pasos.')
    const choice = path.steps[path.stepIndex]!.choices[args.choiceIndex]
    if (choice == null) throw new ConvexError('Esa opción no existe en este paso.')
    await ctx.db.patch('questionAttempts', path.attempt._id, { guidedStep: path.stepIndex + 1 })
    const hasNoWrongTap = view.phase === 'why' || path.stepIndex === 0
    return { correct: hasNoWrongTap ? null : choice.correct === true }
  },
})

/**
 * The retry at the end of the path. Never changes the first answer: it only
 * records how the path ended, and ends it.
 */
export const retryGuidedAnswer = mutation({
  args: { ...pathArgs, selectedOption: v.string() },
  handler: async (ctx, args) => {
    const path = await requirePath(ctx, args)
    if (viewOf(path)?.phase !== 'retry') throw new ConvexError('Termina el camino antes de elegir de nuevo.')
    if (!path.question.options.some((option) => option.label === args.selectedOption)) {
      throw new ConvexError('Esa opción no existe en esta pregunta.')
    }
    const outcome = args.selectedOption === path.question.answerCorrectOption ? 'self_corrected' as const : 'revealed' as const
    await ctx.db.patch('questionAttempts', path.attempt._id, { guidedOutcome: outcome })
    return endedView(path, outcome)
  },
})

/**
 * "Muéstrame": ends the path with the answer. Only after the first step; before
 * the end of the ladder it counts as a skip, which earns no XP for the path.
 * A question with no ladder has no "Muéstrame": its one retry comes first.
 */
export const revealGuidedAnswer = mutation({
  args: pathArgs,
  handler: async (ctx, args) => {
    const path = await requirePath(ctx, args)
    const view = viewOf(path)
    if ((view?.phase !== 'step' && view?.phase !== 'retry') || !view.canReveal) {
      throw new ConvexError('Primero responde el paso.')
    }
    const skipped = view.phase === 'step'
    await ctx.db.patch('questionAttempts', path.attempt._id, { guidedOutcome: 'revealed', ...(skipped ? { guidedSkipped: true } : {}) })
    return endedView(path, 'revealed')
  },
})

/** "Pista": a guiding question before answering; it never removes an option. */
export const takeGuideHint = mutation({
  args: pathArgs,
  handler: async (ctx, args) => {
    const open = await loadOpenSessionQuestion(ctx, args.sessionId, args.sessionQuestionId)
    if (!canCheckAnswers(open.session)) throw new ConvexError('Esta sesión no tiene pistas.')
    if ((await loadLiveExamQuestionIds(ctx, open.session.studentId, { askingSessionId: open.session._id })).has(open.sessionQuestion.questionId)) {
      throw new ConvexError('Esta pregunta está en un examen o reto que tienes en curso. La verás al terminarlo.')
    }
    const question = await ctx.db.get('questions', open.sessionQuestion.questionId)
    if (question == null || open.attempt?.checkedAt != null) return { hint: null }
    const guide = await loadServableGuide(ctx, question)
    if (guide == null) return { hint: null }
    await writeAttemptTools(ctx, open, { usedHint: true, hintCount: (open.attempt?.hintCount ?? 0) + 1 })
    return { hint: guide.hint }
  },
})

/**
 * "Descúbrelo" in the review: the whole path of the option the student picked.
 * Every key of a completed session is out already, so the steps go at once,
 * with their right choices, and the screen walks them locally.
 */
export const getReviewGuide = query({
  args: pathArgs,
  handler: async (ctx, args) => {
    const session = await ctx.db.get('sessions', args.sessionId)
    if (session == null) return null
    await assertIsStudent(ctx, session.studentId)
    const sessionQuestion = await ctx.db.get('sessionQuestions', args.sessionQuestionId)
    if (sessionQuestion == null || sessionQuestion.sessionId !== args.sessionId) return null
    if (!canRevealQuestion(session, sessionQuestion.questionId, await loadLiveExamQuestionIds(ctx, session.studentId))) return null

    const attempt = await ctx.db
      .query('questionAttempts')
      .withIndex('by_sessionQuestionId', (q) => q.eq('sessionQuestionId', args.sessionQuestionId))
      .unique()
    if (attempt?.isCorrect !== false || attempt.selectedOption == null) return null
    const question = await ctx.db.get('questions', sessionQuestion.questionId)
    if (question == null) return null
    const guide = await loadServableGuide(ctx, question)
    const entry = guide?.byOption[attempt.selectedOption]
    if (entry == null) return null
    return { steps: pathSteps(shuffledChoices(entry, question._id), 'sin_empezar'), reveal: guide!.reveal }
  },
})
