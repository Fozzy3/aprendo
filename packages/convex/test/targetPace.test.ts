import { describe, expect, test } from 'bun:test'
import { targetPace } from '../src/examPlan'
import { REQUIRED_SUBJECT_IDS, globalPointsPerWeek, weeklyGlobalEstimates } from '../src/globalScore'
import { MIN_ATTEMPTS_FOR_LEVEL } from '../src/levels'

/** `count` attempts in every area during `weekIndex`, `correct` of them right. */
function weekOfAttempts(weekIndex: number, count: number, correct: number) {
  return REQUIRED_SUBJECT_IDS.flatMap((subjectId) =>
    Array.from({ length: count }, (_, index) => ({
      subjectId,
      weekIndex,
      isCorrect: index < correct,
    })),
  )
}

describe('weeklyGlobalEstimates', () => {
  test('no point until every area has enough evidence', () => {
    const partial = weekOfAttempts(10, MIN_ATTEMPTS_FOR_LEVEL, 6).filter(
      (attempt) => attempt.subjectId !== 'ingles',
    )
    expect(weeklyGlobalEstimates(partial)).toEqual([])
  })

  test('one cumulative point per active week, in week order', () => {
    const attempts = [
      ...weekOfAttempts(12, MIN_ATTEMPTS_FOR_LEVEL, MIN_ATTEMPTS_FOR_LEVEL),
      ...weekOfAttempts(10, MIN_ATTEMPTS_FOR_LEVEL, 0),
    ]
    const points = weeklyGlobalEstimates(attempts)
    expect(points.map((point) => point.weekIndex)).toEqual([10, 12])
    // Week 10 alone: nothing right. By week 12, half of everything.
    expect(points[0]?.score).toBe(0)
    expect(points[1]?.score).toBe(250)
  })

  test('a week with no activity adds no point', () => {
    const attempts = [
      ...weekOfAttempts(1, MIN_ATTEMPTS_FOR_LEVEL, 6),
      ...weekOfAttempts(4, MIN_ATTEMPTS_FOR_LEVEL, 6),
    ]
    expect(weeklyGlobalEstimates(attempts).map((point) => point.weekIndex)).toEqual([1, 4])
  })
})

describe('globalPointsPerWeek', () => {
  test('null below three weekly points', () => {
    expect(globalPointsPerWeek([])).toBeNull()
    expect(
      globalPointsPerWeek([
        { weekIndex: 1, score: 200 },
        { weekIndex: 2, score: 220 },
      ]),
    ).toBeNull()
  })

  test('least-squares slope in points per week', () => {
    expect(
      globalPointsPerWeek([
        { weekIndex: 1, score: 200 },
        { weekIndex: 2, score: 210 },
        { weekIndex: 3, score: 220 },
      ]),
    ).toBe(10)
  })

  test('uses the real gap between weeks', () => {
    expect(
      globalPointsPerWeek([
        { weekIndex: 0, score: 200 },
        { weekIndex: 2, score: 210 },
        { weekIndex: 4, score: 220 },
      ]),
    ).toBe(5)
  })
})

const RISING = [
  { weekIndex: 1, score: 250 },
  { weekIndex: 2, score: 260 },
  { weekIndex: 3, score: 270 },
]

describe('targetPace', () => {
  test('gap with no verdict while there are fewer than three weekly points', () => {
    expect(
      targetPace({ estimate: 270, target: 300, weeksRemaining: 10, weeklyEstimates: RISING.slice(1) }),
    ).toEqual({ gap: 30, pointsPerWeek: null, onTrack: null })
  })

  test('on track when the observed slope closes the gap before the exam', () => {
    expect(
      targetPace({ estimate: 270, target: 300, weeksRemaining: 3, weeklyEstimates: RISING }),
    ).toEqual({ gap: 30, pointsPerWeek: 10, onTrack: true })
  })

  test('behind when it does not', () => {
    expect(
      targetPace({ estimate: 270, target: 300, weeksRemaining: 2, weeklyEstimates: RISING }).onTrack,
    ).toBe(false)
  })

  test('a flat or falling slope is behind unless the target is already met', () => {
    const flat = RISING.map((point) => ({ ...point, score: 270 }))
    expect(
      targetPace({ estimate: 270, target: 300, weeksRemaining: 20, weeklyEstimates: flat }).onTrack,
    ).toBe(false)
    expect(
      targetPace({ estimate: 310, target: 300, weeksRemaining: 20, weeklyEstimates: flat }),
    ).toEqual({ gap: 0, pointsPerWeek: 0, onTrack: true })
  })

  test('no verdict without a target, an estimate or an exam date', () => {
    expect(
      targetPace({ estimate: 270, target: null, weeksRemaining: 3, weeklyEstimates: RISING }),
    ).toEqual({ gap: null, pointsPerWeek: 10, onTrack: null })
    expect(
      targetPace({ estimate: null, target: 300, weeksRemaining: 3, weeklyEstimates: RISING }).onTrack,
    ).toBeNull()
    expect(
      targetPace({ estimate: 270, target: 300, weeksRemaining: null, weeklyEstimates: RISING }).onTrack,
    ).toBeNull()
  })
})
