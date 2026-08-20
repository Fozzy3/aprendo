import { describe, expect, test } from 'bun:test'
import {
  CONFIDENCE_LEVELS,
  classifyAttempt,
  fragileRate,
  misconceptionRate,
  reviewPriority,
  summarizeConfidence,
} from '../src/confidence'

describe('classifyAttempt', () => {
  test('splits the four quadrants of confidence × correctness', () => {
    expect(classifyAttempt({ confidence: 'sure', isCorrect: true })).toBe('mastered')
    expect(classifyAttempt({ confidence: 'sure', isCorrect: false })).toBe('misconception')
    expect(classifyAttempt({ confidence: 'unsure', isCorrect: true })).toBe('fragile')
    expect(classifyAttempt({ confidence: 'unsure', isCorrect: false })).toBe('gap')
    expect(classifyAttempt({ confidence: 'guess', isCorrect: true })).toBe('fragile')
    expect(classifyAttempt({ confidence: 'guess', isCorrect: false })).toBe('gap')
  })

  // The whole point: a lucky guess and real mastery must not collapse together.
  test('a lucky guess is not mastery, even though both are correct', () => {
    expect(classifyAttempt({ confidence: 'guess', isCorrect: true })).not.toBe(
      classifyAttempt({ confidence: 'sure', isCorrect: true }),
    )
  })

  test('a confident mistake is not the same as an honest gap', () => {
    expect(classifyAttempt({ confidence: 'sure', isCorrect: false })).not.toBe(
      classifyAttempt({ confidence: 'guess', isCorrect: false }),
    )
  })

  test('returns null when nothing was declared', () => {
    expect(classifyAttempt({ confidence: null, isCorrect: true })).toBeNull()
    expect(classifyAttempt({ confidence: undefined, isCorrect: false })).toBeNull()
  })

  test('every declared level classifies to something', () => {
    for (const confidence of CONFIDENCE_LEVELS) {
      expect(classifyAttempt({ confidence, isCorrect: true })).not.toBeNull()
      expect(classifyAttempt({ confidence, isCorrect: false })).not.toBeNull()
    }
  })
})

describe('reviewPriority', () => {
  test('ranks a misconception above a gap above a lucky guess above mastery', () => {
    expect(reviewPriority('misconception')).toBeGreaterThan(reviewPriority('gap'))
    expect(reviewPriority('gap')).toBeGreaterThan(reviewPriority('fragile'))
    expect(reviewPriority('fragile')).toBeGreaterThan(reviewPriority('mastered'))
  })
})

describe('summarizeConfidence', () => {
  test('counts each quadrant and tracks declaration coverage', () => {
    const breakdown = summarizeConfidence([
      { confidence: 'sure', isCorrect: true },
      { confidence: 'sure', isCorrect: true },
      { confidence: 'sure', isCorrect: false },
      { confidence: 'guess', isCorrect: true },
      { confidence: 'unsure', isCorrect: false },
      { confidence: null, isCorrect: true },
    ])

    expect(breakdown).toEqual({
      mastered: 2,
      fragile: 1,
      misconception: 1,
      gap: 1,
      declaredCount: 5,
      undeclaredCount: 1,
    })
  })

  test('ignores unanswered attempts entirely', () => {
    const breakdown = summarizeConfidence([
      { confidence: 'sure', isCorrect: null },
      { confidence: null, isCorrect: undefined },
    ])
    expect(breakdown.declaredCount).toBe(0)
    expect(breakdown.undeclaredCount).toBe(0)
  })

  test('handles an empty history', () => {
    expect(summarizeConfidence([]).declaredCount).toBe(0)
  })
})

describe('misconceptionRate', () => {
  test('is the share of declared attempts that were confidently wrong', () => {
    const breakdown = summarizeConfidence([
      { confidence: 'sure', isCorrect: false },
      { confidence: 'sure', isCorrect: true },
      { confidence: 'guess', isCorrect: false },
      { confidence: 'guess', isCorrect: true },
    ])
    expect(misconceptionRate(breakdown)).toBeCloseTo(0.25, 10)
  })

  // "0% de errores confiados" reads as a clean bill of health. With no data at
  // all it would be a lie, so the caller has to distinguish the two.
  test('is null with no declarations, not a reassuring zero', () => {
    expect(misconceptionRate(summarizeConfidence([]))).toBeNull()
    expect(
      misconceptionRate(summarizeConfidence([{ confidence: null, isCorrect: true }])),
    ).toBeNull()
  })
})

describe('fragileRate', () => {
  test('is the share of correct answers the student did not stand behind', () => {
    const breakdown = summarizeConfidence([
      { confidence: 'sure', isCorrect: true },
      { confidence: 'guess', isCorrect: true },
      { confidence: 'unsure', isCorrect: true },
      { confidence: 'sure', isCorrect: false },
    ])
    // 2 of the 3 correct answers were fragile.
    expect(fragileRate(breakdown)).toBeCloseTo(2 / 3, 10)
  })

  test('is null when there are no correct answers to qualify', () => {
    expect(
      fragileRate(summarizeConfidence([{ confidence: 'sure', isCorrect: false }])),
    ).toBeNull()
    expect(fragileRate(summarizeConfidence([]))).toBeNull()
  })
})
