import { describe, expect, test } from 'bun:test'
import {
  MAX_GLOBAL_SCORE,
  REQUIRED_SUBJECT_IDS,
  SUBJECT_WEIGHTS,
  areaStandardError,
  estimateGlobalScore,
  highestLeverageSubject,
} from '../src/globalScore'

function allAreas(score: number, attemptCount = 100) {
  return REQUIRED_SUBJECT_IDS.map((subjectId) => ({ subjectId, score, attemptCount }))
}

describe('the official weighting', () => {
  test('four core areas weigh 3 and English weighs 1, summing to 13', () => {
    expect(SUBJECT_WEIGHTS).toEqual({
      lectura_critica: 3,
      matematicas: 3,
      ciencias_naturales: 3,
      sociales_ciudadanas: 3,
      ingles: 1,
    })
    const total = Object.values(SUBJECT_WEIGHTS).reduce((sum, weight) => sum + weight, 0)
    expect(total).toBe(13)
  })
})

describe('estimateGlobalScore', () => {
  test('a perfect exam is 500 and a blank one is 0', () => {
    expect(estimateGlobalScore(allAreas(100))?.score).toBe(MAX_GLOBAL_SCORE)
    expect(estimateGlobalScore(allAreas(0))?.score).toBe(0)
  })

  test('all areas at 50 lands at the midpoint', () => {
    expect(estimateGlobalScore(allAreas(50))?.score).toBe(250)
  })

  // Worked by hand from the official formula: (3·60 + 3·55 + 3·48 + 3·52 + 1·40) / 13 × 5
  // = (180 + 165 + 144 + 156 + 40) / 13 × 5 = 685 / 13 × 5 = 263.46… → 263.
  test('matches the official formula on a worked example', () => {
    const estimate = estimateGlobalScore([
      { subjectId: 'lectura_critica', score: 60, attemptCount: 100 },
      { subjectId: 'matematicas', score: 55, attemptCount: 100 },
      { subjectId: 'ciencias_naturales', score: 48, attemptCount: 100 },
      { subjectId: 'sociales_ciudadanas', score: 52, attemptCount: 100 },
      { subjectId: 'ingles', score: 40, attemptCount: 100 },
    ])
    expect(estimate?.score).toBe(263)
  })

  test('English moves the global score a third as much as a core area', () => {
    const base = allAreas(50)
    const withBetterEnglish = base.map((entry) =>
      entry.subjectId === 'ingles' ? { ...entry, score: 80 } : entry,
    )
    const withBetterMath = base.map((entry) =>
      entry.subjectId === 'matematicas' ? { ...entry, score: 80 } : entry,
    )

    const baseline = estimateGlobalScore(base)!.score
    const englishGain = estimateGlobalScore(withBetterEnglish)!.score - baseline
    const mathGain = estimateGlobalScore(withBetterMath)!.score - baseline

    // Both ends are rounded to whole points, so 3× can only hold to within 1.
    expect(Math.abs(mathGain - englishGain * 3)).toBeLessThanOrEqual(1)
  })

  test('returns null when any area is missing rather than inventing one', () => {
    const missingEnglish = allAreas(50).filter((entry) => entry.subjectId !== 'ingles')
    expect(estimateGlobalScore(missingEnglish)).toBeNull()
    expect(estimateGlobalScore([])).toBeNull()
  })

  test('ignores unknown areas instead of letting them skew the total', () => {
    const withNoise = [...allAreas(50), { subjectId: 'filosofia', score: 100, attemptCount: 10 }]
    expect(estimateGlobalScore(withNoise)?.score).toBe(250)
  })

  test('clamps out-of-range area scores onto the 0-100 scale', () => {
    expect(estimateGlobalScore(allAreas(140))?.score).toBe(MAX_GLOBAL_SCORE)
    expect(estimateGlobalScore(allAreas(-40))?.score).toBe(0)
  })

  test('the band narrows as evidence accumulates', () => {
    const thin = estimateGlobalScore(allAreas(50, 10))!
    const thick = estimateGlobalScore(allAreas(50, 1000))!
    expect(thick.margin).toBeLessThan(thin.margin)
  })

  test('the band never runs off the 0-500 scale', () => {
    const estimate = estimateGlobalScore(allAreas(50, 1))!
    expect(estimate.low).toBeGreaterThanOrEqual(0)
    expect(estimate.high).toBeLessThanOrEqual(MAX_GLOBAL_SCORE)
    expect(estimate.low).toBeLessThanOrEqual(estimate.score)
    expect(estimate.high).toBeGreaterThanOrEqual(estimate.score)
  })

  test('sums the evidence behind the estimate', () => {
    expect(estimateGlobalScore(allAreas(50, 20))?.attemptCount).toBe(100)
  })
})

describe('areaStandardError', () => {
  test('shrinks with more attempts', () => {
    expect(areaStandardError(50, 400)).toBeLessThan(areaStandardError(50, 25))
  })

  test('is widest at 50 and narrowest at the extremes', () => {
    expect(areaStandardError(50, 100)).toBeGreaterThan(areaStandardError(5, 100))
    expect(areaStandardError(50, 100)).toBeGreaterThan(areaStandardError(95, 100))
  })

  test('reports maximum uncertainty with no evidence instead of a fake zero', () => {
    expect(areaStandardError(50, 0)).toBe(50)
    expect(areaStandardError(50, -3)).toBe(50)
  })
})

describe('highestLeverageSubject', () => {
  test('prefers a core area over English at the same score', () => {
    const result = highestLeverageSubject([
      { subjectId: 'ingles', score: 40, attemptCount: 50 },
      { subjectId: 'matematicas', score: 40, attemptCount: 50 },
    ])
    expect(result?.subjectId).toBe('matematicas')
  })

  test('a slightly weaker English still loses to a core area — weight beats the gap', () => {
    const result = highestLeverageSubject([
      { subjectId: 'ingles', score: 30, attemptCount: 50 },
      { subjectId: 'matematicas', score: 45, attemptCount: 50 },
    ])
    expect(result?.subjectId).toBe('matematicas')
  })

  test('skips areas with no headroom left', () => {
    const result = highestLeverageSubject([
      { subjectId: 'matematicas', score: 100, attemptCount: 50 },
      { subjectId: 'lectura_critica', score: 70, attemptCount: 50 },
    ])
    expect(result?.subjectId).toBe('lectura_critica')
  })

  test('returns null when nothing can be improved', () => {
    expect(highestLeverageSubject([])).toBeNull()
    expect(
      highestLeverageSubject([{ subjectId: 'matematicas', score: 100, attemptCount: 50 }]),
    ).toBeNull()
    expect(
      highestLeverageSubject([{ subjectId: 'filosofia', score: 10, attemptCount: 50 }]),
    ).toBeNull()
  })
})
