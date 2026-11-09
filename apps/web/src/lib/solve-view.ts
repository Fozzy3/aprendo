/**
 * What the solve screen shows for one question, as pure rules: the guided path
 * of F56 and the seals of the kinds that disclose nothing before the end. The
 * server is what keeps the key away; this is what keeps the screen honest about
 * it, on a stale cache or a slow query.
 */

/** `guides.getGuideStep`: the path, one step at a time. */
export type GuideView =
  | { phase: 'step'; stepIndex: number; stepCount: number; prompt: string; choices: string[]; canReveal: boolean }
  | { phase: 'why'; prompt: string; choices: string[] }
  | { phase: 'retry'; canReveal: boolean }
  | {
      phase: 'ended'
      outcome: 'self_corrected' | 'revealed'
      correctOption: string
      solutionMarkdown: string | null
      distractorRationales: { label: string; rationaleMarkdown: string }[]
      explanationSource: 'icfes' | 'ai_generated' | 'human' | null
      reveal: string | null
    }

export type SolveMoment = 'answering' | 'waiting' | 'guiding' | 'why' | 'retry' | 'closed'

/**
 * Where a question stands. `guide` is undefined while its query loads: a verdict
 * then could be replaced a moment later by a "¿por qué?". A sealed session never
 * leaves `answering`, whatever the cache holds.
 */
export function solveMoment(input: {
  immediate: boolean
  isChecked: boolean
  hasKey: boolean
  guide: GuideView | null | undefined
}): SolveMoment {
  const { immediate, isChecked, hasKey, guide } = input
  if (!immediate || !isChecked) return 'answering'
  if (guide === undefined) return 'waiting'
  if (guide === null) return hasKey ? 'closed' : 'waiting'
  if (guide.phase === 'step') return 'guiding'
  if (guide.phase === 'why') return 'why'
  if (guide.phase === 'retry') return 'retry'
  return hasKey ? 'closed' : 'waiting'
}

export type OptionMark = 'none' | 'selected' | 'eliminated' | 'wrong' | 'correct'

/** How one option reads. While a path is open only the student's own pick is marked. */
export function optionMark(input: {
  moment: SolveMoment
  label: string
  selectedOption: string | null
  correctOption: string | null
  isEliminated: boolean
}): OptionMark {
  const { moment, label, selectedOption, correctOption, isEliminated } = input
  const isPick = label === selectedOption
  if (moment === 'answering') {
    if (isPick) return 'selected'
    return isEliminated ? 'eliminated' : 'none'
  }
  if (moment === 'closed' || moment === 'why') {
    if (correctOption == null) return isPick ? 'wrong' : 'none'
    if (label === correctOption) return 'correct'
    return isPick ? 'wrong' : 'none'
  }
  return isPick && label !== correctOption ? 'wrong' : 'none'
}

/** Whether a reopened session can move past this question: answered and, in practice, closed. */
export function isSettled(input: { immediate: boolean; isAnswered: boolean; isChecked: boolean; hasKey: boolean }) {
  if (!input.isAnswered) return false
  return !input.immediate || (input.isChecked && input.hasKey)
}

/** The args of `getGuideStep`, or 'skip': never for a sealed session, never before the check. */
export function guideQueryArgs(input: {
  immediate: boolean
  isChecked: boolean
  sessionId: string
  sessionQuestionId: string
}) {
  const { immediate, isChecked, sessionId, sessionQuestionId } = input
  return immediate && isChecked ? { sessionId, sessionQuestionId } : ('skip' as const)
}

/** "Muéstrame": only after the first step, and at a retry that had a ladder before it. */
export function canRevealNow(guide: GuideView | null | undefined): boolean {
  return guide != null && (guide.phase === 'step' || guide.phase === 'retry') && guide.canReveal
}

/** The small line above the prompt. It answers the last tap; it never judges the student. */
export function guideEyebrow(guide: GuideView, lastCorrect: boolean | null): string {
  if (guide.phase === 'why') return 'Correcta'
  if (guide.phase === 'retry') return 'Elige de nuevo'
  if (guide.phase === 'step' && guide.stepIndex === 0) return 'Todavía no'
  if (lastCorrect === true) return 'Eso es'
  return lastCorrect === false ? 'Míralo otra vez' : 'Sigue pensando'
}

/** Past this many questions (an exam) a bead per question stops being readable. */
const MAX_BEADS = 15

export type BeadState = 'done' | 'current' | 'todo'

/** One bead per question, or null for an exam, which gets a plain bar. */
export function beadStates(answered: boolean[], currentIndex: number): BeadState[] | null {
  if (answered.length > MAX_BEADS) return null
  return answered.map((isAnswered, index) => {
    if (index === currentIndex) return 'current'
    return isAnswered ? 'done' : 'todo'
  })
}

/**
 * A school test stays sealed for the student until its round closes: the whole
 * grade sits the same form, so a key out early is a key passed around.
 */
export function reviewIsSealed(kind: string, questions: { question: { answerCorrectOption?: string } }[]) {
  return kind === 'prueba' && questions.length > 0 && questions.every((item) => item.question.answerCorrectOption == null)
}

/**
 * Whether the review shows the key of an item. A wrong one offers "Descúbrelo"
 * first, with the answer one tap away (ADR 0002); with no guide there is nothing
 * to discover. Undefined is the guide still loading: the key must not flash.
 */
export function reviewShowsAnswer(input: { isWrong: boolean; guide: object | null | undefined; revealed: boolean }) {
  if (!input.isWrong || input.guide === null) return true
  return input.guide !== undefined && input.revealed
}
