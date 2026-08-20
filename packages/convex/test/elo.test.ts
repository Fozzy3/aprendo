import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_RATING,
  applyAttempts,
  difficultyBucket,
  expectedAccuracyAgainstPool,
  expectedScore,
  kFactor,
  updateRatings,
} from '../src/elo'

describe('expectedScore', () => {
  test('equal ratings are a coin flip', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10)
  })

  test('a 400-point edge is the canonical ~10:1 ratio', () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 6)
    expect(expectedScore(1200, 1600)).toBeCloseTo(1 / 11, 6)
  })

  test('the two sides of a match always sum to 1', () => {
    for (const [a, b] of [[1200, 1400], [900, 1500], [1337, 1337]]) {
      expect(expectedScore(a!, b!) + expectedScore(b!, a!)).toBeCloseTo(1, 10)
    }
  })

  test('is monotonic in the rating gap', () => {
    const gaps = [-400, -200, 0, 200, 400].map((gap) => expectedScore(1200 + gap, 1200))
    for (let index = 1; index < gaps.length; index += 1) {
      expect(gaps[index]!).toBeGreaterThan(gaps[index - 1]!)
    }
  })
})

describe('kFactor', () => {
  test('shrinks as evidence accumulates, so ratings settle', () => {
    const steps = [0, 9, 10, 29, 30, 99, 100, 5000].map(kFactor)
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index]!).toBeLessThanOrEqual(steps[index - 1]!)
    }
    expect(kFactor(0)).toBeGreaterThan(kFactor(5000))
  })
})

describe('updateRatings', () => {
  test('a correct answer raises ability and lowers difficulty', () => {
    const next = updateRatings({
      questionRating: DEFAULT_RATING,
      questionAttemptCount: 0,
      abilityRating: DEFAULT_RATING,
      abilityAttemptCount: 0,
      isCorrect: true,
    })
    expect(next.abilityRating).toBeGreaterThan(DEFAULT_RATING)
    expect(next.questionRating).toBeLessThan(DEFAULT_RATING)
  })

  test('a wrong answer lowers ability and raises difficulty', () => {
    const next = updateRatings({
      questionRating: DEFAULT_RATING,
      questionAttemptCount: 0,
      abilityRating: DEFAULT_RATING,
      abilityAttemptCount: 0,
      isCorrect: false,
    })
    expect(next.abilityRating).toBeLessThan(DEFAULT_RATING)
    expect(next.questionRating).toBeGreaterThan(DEFAULT_RATING)
  })

  test('an expected result barely moves anything; an upset moves a lot', () => {
    // Strong student, easy question: getting it right is no news.
    const expectedWin = updateRatings({
      questionRating: 800,
      questionAttemptCount: 0,
      abilityRating: 1600,
      abilityAttemptCount: 0,
      isCorrect: true,
    })
    // Same student, same question, but they got it wrong. That is news.
    const upset = updateRatings({
      questionRating: 800,
      questionAttemptCount: 0,
      abilityRating: 1600,
      abilityAttemptCount: 0,
      isCorrect: false,
    })

    expect(Math.abs(expectedWin.abilityRating - 1600)).toBeLessThan(
      Math.abs(upset.abilityRating - 1600),
    )
  })

  test('is zero-sum on equal K: what one side gains the other loses', () => {
    const next = updateRatings({
      questionRating: 1100,
      questionAttemptCount: 0,
      abilityRating: 1300,
      abilityAttemptCount: 0,
      isCorrect: false,
    })
    const abilityDelta = next.abilityRating - 1300
    const questionDelta = next.questionRating - 1100
    expect(abilityDelta + questionDelta).toBeCloseTo(0, 10)
  })

  test('a well-measured question moves less than a fresh one', () => {
    const fresh = updateRatings({
      questionRating: DEFAULT_RATING,
      questionAttemptCount: 0,
      abilityRating: DEFAULT_RATING,
      abilityAttemptCount: 0,
      isCorrect: true,
    })
    const settled = updateRatings({
      questionRating: DEFAULT_RATING,
      questionAttemptCount: 500,
      abilityRating: DEFAULT_RATING,
      abilityAttemptCount: 0,
      isCorrect: true,
    })
    expect(Math.abs(settled.questionRating - DEFAULT_RATING)).toBeLessThan(
      Math.abs(fresh.questionRating - DEFAULT_RATING),
    )
  })
})

describe('applyAttempts', () => {
  test('separates two students with identical accuracy but different difficulty', () => {
    // Both answer 2 of 4. One did it on hard questions, the other on easy ones.
    const hard = applyAttempts({
      abilityRating: DEFAULT_RATING,
      abilityAttemptCount: 0,
      attempts: [
        { questionRating: 1500, questionAttemptCount: 50, isCorrect: true },
        { questionRating: 1500, questionAttemptCount: 50, isCorrect: true },
        { questionRating: 1500, questionAttemptCount: 50, isCorrect: false },
        { questionRating: 1500, questionAttemptCount: 50, isCorrect: false },
      ],
    })
    const easy = applyAttempts({
      abilityRating: DEFAULT_RATING,
      abilityAttemptCount: 0,
      attempts: [
        { questionRating: 900, questionAttemptCount: 50, isCorrect: true },
        { questionRating: 900, questionAttemptCount: 50, isCorrect: true },
        { questionRating: 900, questionAttemptCount: 50, isCorrect: false },
        { questionRating: 900, questionAttemptCount: 50, isCorrect: false },
      ],
    })

    // This is the whole reason for calibrating: raw accuracy calls these equal.
    expect(hard.abilityRating).toBeGreaterThan(easy.abilityRating)
  })

  test('counts every attempt and returns one rating per attempt', () => {
    const result = applyAttempts({
      abilityRating: DEFAULT_RATING,
      abilityAttemptCount: 3,
      attempts: [
        { questionRating: 1200, questionAttemptCount: 0, isCorrect: true },
        { questionRating: 1200, questionAttemptCount: 0, isCorrect: false },
      ],
    })
    expect(result.abilityAttemptCount).toBe(5)
    expect(result.questionRatings).toHaveLength(2)
  })

  test('an empty run is a no-op', () => {
    const result = applyAttempts({
      abilityRating: 1234,
      abilityAttemptCount: 7,
      attempts: [],
    })
    expect(result).toEqual({
      abilityRating: 1234,
      abilityAttemptCount: 7,
      questionRatings: [],
    })
  })
})

describe('difficultyBucket', () => {
  test('is monotonic and spans 1 to 5', () => {
    const buckets = [800, 1050, 1200, 1350, 1600].map(difficultyBucket)
    expect(buckets).toEqual([1, 2, 3, 4, 5])
  })

  test('an unmeasured question sits in the middle', () => {
    expect(difficultyBucket(DEFAULT_RATING)).toBe(3)
  })
})

describe('expectedAccuracyAgainstPool', () => {
  test('a student at the pool average is expected to get about half', () => {
    expect(expectedAccuracyAgainstPool(1200, [1200, 1200, 1200])).toBeCloseTo(0.5, 10)
  })

  test('rises with ability', () => {
    const pool = [1100, 1200, 1300]
    expect(expectedAccuracyAgainstPool(1400, pool)!).toBeGreaterThan(
      expectedAccuracyAgainstPool(1000, pool)!,
    )
  })

  test('stays within 0-1', () => {
    const pool = [1000, 1200, 1400]
    for (const ability of [-5000, 0, 1200, 9000]) {
      const accuracy = expectedAccuracyAgainstPool(ability, pool)!
      expect(accuracy).toBeGreaterThanOrEqual(0)
      expect(accuracy).toBeLessThanOrEqual(1)
    }
  })

  test('returns null for an empty pool instead of dividing by zero', () => {
    expect(expectedAccuracyAgainstPool(1200, [])).toBeNull()
  })
})
