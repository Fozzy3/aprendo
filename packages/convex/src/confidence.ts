/**
 * Declared confidence, and what it reveals that correctness alone cannot.
 *
 * A right answer and a lucky guess are the same row in `questionAttempts`. So
 * are a careful mistake and a careless one. Asking the student one question —
 * "¿seguro, dudaste o adivinaste?" — splits each of those pairs apart and turns
 * a binary signal into a diagnosis.
 *
 * The state that matters most is `misconception`: confident **and** wrong. That
 * is not a gap in knowledge, it is knowledge that is incorrect, and it is the
 * only quadrant a student will never fix on their own — they have no reason to
 * revisit something they are sure of.
 */

export const CONFIDENCE_LEVELS = ['sure', 'unsure', 'guess'] as const
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

export type LearningState =
  /** Confident and right: genuinely mastered. */
  | 'mastered'
  /** Unsure or guessing but right: got there, but it will not survive pressure. */
  | 'fragile'
  /** Confident and wrong: a misconception. The most urgent state. */
  | 'misconception'
  /** Unsure or guessing and wrong: an ordinary, honest gap. */
  | 'gap'

export function classifyAttempt(args: {
  confidence: ConfidenceLevel | null | undefined
  isCorrect: boolean
}): LearningState | null {
  // Without a declaration there is nothing to diagnose — correctness alone is
  // exactly the ambiguous signal this module exists to disambiguate.
  if (args.confidence == null) return null

  const wasConfident = args.confidence === 'sure'
  if (args.isCorrect) return wasConfident ? 'mastered' : 'fragile'
  return wasConfident ? 'misconception' : 'gap'
}

/**
 * How urgently a state should be resurfaced by spaced review.
 *
 * Higher comes back sooner. A misconception outranks a plain gap because the
 * student does not know they have it; a lucky guess outranks a mastered item
 * because the next encounter is a coin flip.
 */
export function reviewPriority(state: LearningState): number {
  switch (state) {
    case 'misconception':
      return 3
    case 'gap':
      return 2
    case 'fragile':
      return 1
    case 'mastered':
      return 0
  }
}

export interface ConfidenceBreakdown {
  mastered: number
  fragile: number
  misconception: number
  gap: number
  /** Attempts with a declaration — the denominator for every rate below. */
  declaredCount: number
  /** Attempts with no declaration, for honesty about coverage. */
  undeclaredCount: number
}

export function summarizeConfidence(
  attempts: Array<{ confidence?: ConfidenceLevel | null; isCorrect?: boolean | null }>,
): ConfidenceBreakdown {
  const breakdown: ConfidenceBreakdown = {
    mastered: 0,
    fragile: 0,
    misconception: 0,
    gap: 0,
    declaredCount: 0,
    undeclaredCount: 0,
  }

  for (const attempt of attempts) {
    if (attempt.isCorrect == null) continue
    const state = classifyAttempt({
      confidence: attempt.confidence,
      isCorrect: attempt.isCorrect,
    })
    if (state == null) {
      breakdown.undeclaredCount += 1
      continue
    }
    breakdown[state] += 1
    breakdown.declaredCount += 1
  }

  return breakdown
}

/**
 * Share of declared attempts that are outright misconceptions.
 *
 * Returned as null rather than 0 when nothing was declared, so the UI can say
 * "aún no hay datos" instead of the actively misleading "0% de errores
 * confiados".
 */
export function misconceptionRate(breakdown: ConfidenceBreakdown): number | null {
  if (breakdown.declaredCount === 0) return null
  return breakdown.misconception / breakdown.declaredCount
}

/**
 * Share of correct answers that the student did not actually stand behind.
 *
 * This is the number that explains a good accuracy which collapses on exam day:
 * a student at 70% accuracy with half of it fragile is not a 70% student.
 */
export function fragileRate(breakdown: ConfidenceBreakdown): number | null {
  const correct = breakdown.mastered + breakdown.fragile
  if (correct === 0) return null
  return breakdown.fragile / correct
}
