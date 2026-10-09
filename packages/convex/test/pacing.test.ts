import { describe, expect, test } from 'bun:test'
import {
  MAX_QUESTION_VISIT_MS,
  accumulateQuestionTime,
  averagePace,
  officialMsPerQuestion,
  paceStatus,
  questionTimeMs,
  slowestQuestions,
} from '../src/pacing'
import { SIMULACRO_MS_PER_QUESTION } from '../src/sessionKinds'

describe('officialMsPerQuestion', () => {
  test('Sesión 1 is 4h30 for 120 questions: 135 s each', () => {
    expect(officialMsPerQuestion({ kind: 'simulacro', simulacroSessionNumber: 1 })).toBe(135_000)
  })

  test('Sesión 2 packs 134 questions in the same 4h30: about 121 s each', () => {
    expect(officialMsPerQuestion({ kind: 'simulacro', simulacroSessionNumber: 2 })).toBe(120_896)
  })

  test('a per-area simulacro runs at the official exam pace', () => {
    expect(officialMsPerQuestion({ kind: 'simulacro', subjectId: 'matematicas' })).toBe(
      SIMULACRO_MS_PER_QUESTION,
    )
  })

  test('nivelación follows its own clock: 30 min for 15 questions', () => {
    expect(officialMsPerQuestion({ kind: 'nivelacion', subjectId: 'matematicas' })).toBe(120_000)
  })

  test('untimed practice is measured against the exam pace', () => {
    expect(officialMsPerQuestion({ kind: 'topic', subjectId: 'matematicas' })).toBe(
      SIMULACRO_MS_PER_QUESTION,
    )
    expect(officialMsPerQuestion({ kind: 'repaso' })).toBe(SIMULACRO_MS_PER_QUESTION)
  })
})

describe('paceStatus', () => {
  const pace = 100_000

  test('on time while within one question of the official pace', () => {
    expect(paceStatus({ msPerQuestion: pace, elapsedMs: 0, answeredCount: 0 })).toEqual({
      status: 'a_tiempo',
      deltaQuestions: 0,
    })
    expect(paceStatus({ msPerQuestion: pace, elapsedMs: 550_000, answeredCount: 5 })).toEqual({
      status: 'a_tiempo',
      deltaQuestions: 0,
    })
  })

  test('behind once a whole question is owed', () => {
    expect(paceStatus({ msPerQuestion: pace, elapsedMs: 1_000_000, answeredCount: 7 })).toEqual({
      status: 'atrasado',
      deltaQuestions: -3,
    })
  })

  test('ahead once a whole question is banked', () => {
    expect(paceStatus({ msPerQuestion: pace, elapsedMs: 300_000, answeredCount: 5 })).toEqual({
      status: 'adelantado',
      deltaQuestions: 2,
    })
  })
})

describe('questionTimeMs', () => {
  test('prefers the time accumulated across visits', () => {
    expect(questionTimeMs({ timeSpentMs: 90_000, responseTimeMs: 10_000 })).toBe(90_000)
  })

  test('falls back to the last visit for older attempts', () => {
    expect(questionTimeMs({ responseTimeMs: 40_000 })).toBe(40_000)
  })

  test('no time at all is null, not zero', () => {
    expect(questionTimeMs(null)).toBeNull()
    expect(questionTimeMs({})).toBeNull()
    expect(questionTimeMs({ timeSpentMs: 0 })).toBeNull()
  })
})

describe('accumulateQuestionTime', () => {
  test('adds a visit to what was already spent', () => {
    expect(accumulateQuestionTime(undefined, 30_000)).toBe(30_000)
    expect(accumulateQuestionTime(30_000, 12_400.6)).toBe(42_401)
  })

  test('ignores garbage and caps a visit left open for hours', () => {
    expect(accumulateQuestionTime(5_000, -20)).toBe(5_000)
    expect(accumulateQuestionTime(5_000, Number.NaN)).toBe(5_000)
    expect(accumulateQuestionTime(0, 6 * 60 * 60_000)).toBe(MAX_QUESTION_VISIT_MS)
  })
})

describe('averagePace', () => {
  test('averages only timed questions against their official pace', () => {
    expect(
      averagePace([
        { timeMs: 130_000, officialMs: 135_000 },
        { timeMs: 140_000, officialMs: 135_000 },
        { timeMs: null, officialMs: 135_000 },
      ]),
    ).toEqual({ timedCount: 2, averageMs: 135_000, officialMs: 135_000, status: 'a_tiempo' })
  })

  test('slower than the pace by more than a tenth is behind', () => {
    expect(averagePace([{ timeMs: 200_000, officialMs: 135_000 }])?.status).toBe('atrasado')
  })

  test('faster than the pace by more than a tenth is ahead', () => {
    expect(averagePace([{ timeMs: 60_000, officialMs: 135_000 }])?.status).toBe('adelantado')
  })

  test('mixed sittings compare against the mean official pace', () => {
    expect(
      averagePace([
        { timeMs: 135_000, officialMs: 135_000 },
        { timeMs: 121_000, officialMs: 121_000 },
      ]),
    ).toMatchObject({ averageMs: 128_000, officialMs: 128_000, status: 'a_tiempo' })
  })

  test('nothing timed is null', () => {
    expect(averagePace([{ timeMs: null, officialMs: 135_000 }])).toBeNull()
    expect(averagePace([])).toBeNull()
  })
})

describe('slowestQuestions', () => {
  test('only questions over the pace, slowest first, up to the limit', () => {
    const items = [
      { id: 'a', timeMs: 300_000, officialMs: 135_000 },
      { id: 'b', timeMs: 100_000, officialMs: 135_000 },
      { id: 'c', timeMs: 500_000, officialMs: 135_000 },
      { id: 'd', timeMs: null, officialMs: 135_000 },
      { id: 'e', timeMs: 200_000, officialMs: 135_000 },
    ]
    expect(slowestQuestions(items, 2).map((item) => item.id)).toEqual(['c', 'a'])
    expect(slowestQuestions(items).map((item) => item.id)).toEqual(['c', 'a', 'e'])
  })
})
