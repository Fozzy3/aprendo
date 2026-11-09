/**
 * Review copy decisions: which option explanations to show and in what order,
 * how many questions a retry would serve, and how the student's time compares
 * with everyone else's.
 */

/**
 * Every distractor's rationale, the student's wrong pick first (the turn that
 * teaches most), then the rest in option order. The key is explained by the
 * solution, which the screen renders after these.
 */
export function optionExplanations(input: {
  options: { label: string }[]
  selectedOption: string | null
  correctOption: string | null | undefined
  rationales: { label: string; rationaleMarkdown: string }[] | null | undefined
}): { label: string; rationaleMarkdown: string; isPicked: boolean }[] {
  const byLabel = new Map(
    (input.rationales ?? [])
      .filter((rationale) => rationale.rationaleMarkdown.trim().length > 0)
      .map((rationale) => [rationale.label, rationale.rationaleMarkdown]),
  )
  const items = input.options.flatMap((option) => {
    const rationaleMarkdown = byLabel.get(option.label)
    if (rationaleMarkdown == null || option.label === input.correctOption) return []
    return [{ label: option.label, rationaleMarkdown, isPicked: option.label === input.selectedOption }]
  })
  return [...items.filter((item) => item.isPicked), ...items.filter((item) => !item.isPicked)]
}

type GradedAttempt = { isCorrect?: boolean | null; selectedOption?: string | null }

/** Answered, but its grade is still sealed (`sealAttempt`): neither right nor wrong yet. */
export function isSealedAttempt(attempt: GradedAttempt | null | undefined) {
  return attempt?.selectedOption != null && attempt.isCorrect == null
}

/** Wrong or blank: what "Repetir las que fallé" would serve. A sealed answer is neither. */
export function missedCount(questions: { attempt: GradedAttempt | null }[]) {
  return questions.filter((question) => question.attempt?.isCorrect !== true && !isSealedAttempt(question.attempt)).length
}

/** Which dot the question map shows: a sealed answer is answered, never marked. */
export function reviewDotStatus(attempt: GradedAttempt | null | undefined) {
  if (attempt == null) return 'pending'
  if (isSealedAttempt(attempt)) return 'answered'
  return attempt.isCorrect ? 'correct' : 'incorrect'
}

/** How one question went, for the report. A sealed answer is handed in, not blank. */
export function reportItemOutcome(item: { isCorrect: boolean | null; answered?: boolean }) {
  if (item.isCorrect === true) return 'Acertaste'
  if (item.isCorrect === false) return 'Fallaste'
  return item.answered === true ? 'Entregada' : 'En blanco'
}

/** The chip of a session with no score to show: completed means it was handed in and is still sealed. */
export function sessionOutcomeChip(status: string) {
  return status === 'completed' ? 'Entregada' : 'Sin terminar'
}

/** Within 20% of the median reads as "similar". */
export function timeVersusMedian(
  yourMs: number | null | undefined,
  medianMs: number | null | undefined,
): 'faster' | 'slower' | 'similar' | null {
  if (yourMs == null || medianMs == null || medianMs <= 0) return null
  const ratio = yourMs / medianMs
  if (ratio < 0.8) return 'faster'
  if (ratio > 1.2) return 'slower'
  return 'similar'
}
