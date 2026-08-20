/**
 * Elo-style difficulty calibration.
 *
 * Every question carries a difficulty rating and every student carries an
 * ability rating per area. Answering is treated as a match: the student "wins"
 * by answering correctly. Both ratings move toward whatever the outcome implies.
 *
 * Why this instead of raw accuracy: raw accuracy conflates "this student is
 * weak" with "these questions were hard". A student who only ever sees easy
 * questions and a student who only sees hard ones can share an accuracy of 0.6
 * and be nowhere near each other. Elo separates the two because every attempt
 * is scored against the *specific* question's rating.
 *
 * Deliberately free of any `convex/*` import: this is arithmetic, and it is
 * tested as arithmetic.
 */

/**
 * Starting rating for an unseen question and an unmeasured student.
 *
 * The scale is arbitrary (as in chess); only differences carry meaning. 1200 is
 * the conventional origin and keeps ratings comfortably positive in practice.
 */
export const DEFAULT_RATING = 1200

/**
 * Probability that a player rated `rating` beats one rated `opponentRating`.
 *
 * The 400 is the Elo scale constant: a 400-point edge means a ~10:1 expected
 * win ratio. For us, "winning" is the student answering correctly, so this is
 * literally the model's predicted probability of a correct answer.
 */
export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400))
}

/**
 * How far a single result is allowed to move a rating.
 *
 * Shrinks with evidence: the first attempts should move a rating fast (it starts
 * at a placeholder), later ones should barely nudge it. Without the decay a
 * well-measured question would still swing on every answer and the ratings would
 * never settle; with a decay that is too aggressive, a question mis-rated by its
 * first three answers could never recover.
 */
export function kFactor(attemptCount: number): number {
  if (attemptCount < 10) return 48
  if (attemptCount < 30) return 32
  if (attemptCount < 100) return 20
  return 12
}

export interface RatingUpdate {
  questionRating: number
  abilityRating: number
}

/**
 * Apply one attempt to both ratings.
 *
 * The two ratings move in opposite directions by design: a correct answer means
 * the student was stronger than the question, so ability goes up and difficulty
 * goes down. The size of the move is the surprise — an expected result barely
 * moves anything, an upset moves a lot.
 */
export function updateRatings(args: {
  questionRating: number
  questionAttemptCount: number
  abilityRating: number
  abilityAttemptCount: number
  isCorrect: boolean
}): RatingUpdate {
  const expectedStudent = expectedScore(args.abilityRating, args.questionRating)
  const actual = args.isCorrect ? 1 : 0
  const surprise = actual - expectedStudent

  return {
    abilityRating: args.abilityRating + kFactor(args.abilityAttemptCount) * surprise,
    // Mirror image: the question's outcome is the complement of the student's.
    questionRating: args.questionRating - kFactor(args.questionAttemptCount) * surprise,
  }
}

/**
 * Fold a run of attempts into a starting pair of ratings, in order.
 *
 * Order matters (each update feeds the next), so callers must pass attempts
 * chronologically.
 */
export function applyAttempts(args: {
  abilityRating: number
  abilityAttemptCount: number
  attempts: Array<{
    questionRating: number
    questionAttemptCount: number
    isCorrect: boolean
  }>
}) {
  let abilityRating = args.abilityRating
  let abilityAttemptCount = args.abilityAttemptCount
  const questionRatings: number[] = []

  for (const attempt of args.attempts) {
    const next = updateRatings({
      questionRating: attempt.questionRating,
      questionAttemptCount: attempt.questionAttemptCount,
      abilityRating,
      abilityAttemptCount,
      isCorrect: attempt.isCorrect,
    })
    abilityRating = next.abilityRating
    abilityAttemptCount += 1
    questionRatings.push(next.questionRating)
  }

  return { abilityRating, abilityAttemptCount, questionRatings }
}

/**
 * Turn a difficulty rating into the 1-5 bucket shown to a student ("Difícil").
 *
 * Buckets rather than the raw number: the rating is only meaningful relative to
 * the pool, and a bare "1247" means nothing to a 16-year-old.
 */
export function difficultyBucket(rating: number): 1 | 2 | 3 | 4 | 5 {
  if (rating < DEFAULT_RATING - 200) return 1
  if (rating < DEFAULT_RATING - 70) return 2
  if (rating < DEFAULT_RATING + 70) return 3
  if (rating < DEFAULT_RATING + 200) return 4
  return 5
}

/**
 * Expected accuracy of a student against a pool of questions.
 *
 * This is the bridge from Elo to the 0-100 area score the ICFES levels are
 * defined over: "against a representative pool, this student answers ~62%".
 * Unlike raw accuracy it is comparable across students who saw different
 * questions, which is the entire point of calibrating.
 */
export function expectedAccuracyAgainstPool(
  abilityRating: number,
  poolRatings: number[],
): number | null {
  if (poolRatings.length === 0) return null
  const total = poolRatings.reduce(
    (sum, rating) => sum + expectedScore(abilityRating, rating),
    0,
  )
  return total / poolRatings.length
}
