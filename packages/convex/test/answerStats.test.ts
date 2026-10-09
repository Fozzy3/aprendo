import { describe, expect, test } from 'bun:test'
import {
  MAX_TIME_SAMPLE,
  MIN_STATS_SAMPLE,
  addToTally,
  countsTowardStats,
  summarizeAnswerStats,
  tallyAnswers,
  type AnswerTally,
} from '../src/answerStats'

const LABELS = ['A', 'B', 'C', 'D']

const tallyOf = (answers: { selectedOption: string; timeSpentMs?: number; responseTimeMs?: number }[]) =>
  answers.reduce<AnswerTally | null>((tally, answer) => addToTally(tally, answer), null)

describe('summarizeAnswerStats', () => {
  test('needs 20 answers before showing percentages', () => {
    expect(MIN_STATS_SAMPLE).toBe(20)
  })

  test('share of answers per option, in booklet order, with the median time', () => {
    const tally = tallyOf([
      ...Array.from({ length: 10 }, (_, index) => ({ selectedOption: 'B', timeSpentMs: 60_000 + index * 1000 })),
      ...Array.from({ length: 6 }, () => ({ selectedOption: 'A', timeSpentMs: 30_000 })),
      ...Array.from({ length: 4 }, () => ({ selectedOption: 'D', timeSpentMs: 90_000 })),
    ])
    expect(summarizeAnswerStats(tally, LABELS)).toEqual({
      sampleSize: 20,
      hasEnoughData: true,
      options: [
        { label: 'A', percent: 30 },
        { label: 'B', percent: 50 },
        { label: 'C', percent: 0 },
        { label: 'D', percent: 20 },
      ],
      medianTimeMs: 63_500,
    })
  })

  test('below the minimum sample it only says how many there are', () => {
    const tally = tallyOf([{ selectedOption: 'B', timeSpentMs: 1000 }, { selectedOption: 'A', timeSpentMs: 2000 }])
    expect(summarizeAnswerStats(tally, LABELS)).toEqual({
      sampleSize: 2,
      hasEnoughData: false,
      options: LABELS.map((label) => ({ label, percent: null })),
      medianTimeMs: null,
    })
  })

  test('a question nobody answered yet', () => {
    expect(summarizeAnswerStats(null, LABELS)).toEqual({
      sampleSize: 0,
      hasEnoughData: false,
      options: LABELS.map((label) => ({ label, percent: null })),
      medianTimeMs: null,
    })
  })

  test('no timed answers means no median', () => {
    const tally = tallyOf(Array.from({ length: 20 }, () => ({ selectedOption: 'C' })))
    expect(summarizeAnswerStats(tally, LABELS).medianTimeMs).toBeNull()
  })
})

describe('addToTally', () => {
  test('counts the option and falls back to the time to answer', () => {
    const tally = addToTally(addToTally(null, { selectedOption: 'B', responseTimeMs: 40_000 }), {
      selectedOption: 'B',
      timeSpentMs: 50_000,
      responseTimeMs: 1,
    })
    expect(tally).toEqual({ answerCount: 2, optionCounts: { B: 2 }, timeSampleMs: [40_000, 50_000] })
  })

  test('keeps a bounded sample of times for the median', () => {
    const tally = tallyOf(Array.from({ length: MAX_TIME_SAMPLE + 5 }, () => ({ selectedOption: 'A', timeSpentMs: 1000 })))
    expect(tally?.answerCount).toBe(MAX_TIME_SAMPLE + 5)
    expect(tally?.timeSampleMs).toHaveLength(MAX_TIME_SAMPLE)
  })

  test('does not mutate the tally it is given', () => {
    const before = addToTally(null, { selectedOption: 'A', timeSpentMs: 1000 })
    addToTally(before, { selectedOption: 'A', timeSpentMs: 2000 })
    expect(before).toEqual({ answerCount: 1, optionCounts: { A: 1 }, timeSampleMs: [1000] })
  })
})

describe('countsTowardStats', () => {
  const answer = { answeredAt: 100, completedAt: 200 }

  test('the first settled answer of a student who never saw the key counts', () => {
    expect(countsTowardStats(answer, [])).toBe(true)
    // An open session's row says nothing yet.
    expect(countsTowardStats(answer, [{ completedAt: undefined }])).toBe(true)
  })

  test('not after an earlier completed session showed the question and its key', () => {
    expect(countsTowardStats(answer, [{ completedAt: 150 }])).toBe(false)
  })

  test('a later sitting does not undo the first one', () => {
    expect(countsTowardStats(answer, [{ completedAt: 300 }])).toBe(true)
  })

  test('not when "Ver respuesta" showed the key before the answer', () => {
    expect(countsTowardStats(answer, [{ checkedAt: 50 }])).toBe(false)
    expect(countsTowardStats(answer, [{ checkedAt: 150 }])).toBe(true)
  })
})

describe('tallyAnswers', () => {
  test('one answer per student: the first settled one, before the key was revealed', () => {
    // Four students miss Q with B (the key is C), read the review, then nail
    // it in a repaso and a retry. Only the four unprimed Bs count.
    const answers = ['s1', 's2', 's3', 's4'].flatMap((studentId) => [
      { studentId, selectedOption: 'B', answeredAt: 10, completedAt: 20, timeSpentMs: 30_000 },
      { studentId, selectedOption: 'C', answeredAt: 30, completedAt: 40, timeSpentMs: 5_000 },
      { studentId, selectedOption: 'C', answeredAt: 50, completedAt: 60, timeSpentMs: 4_000 },
    ])
    expect(tallyAnswers(answers)).toEqual({
      answerCount: 4,
      optionCounts: { B: 4 },
      timeSampleMs: [30_000, 30_000, 30_000, 30_000],
    })
  })

  test('skips answers of open or abandoned sessions and rows without an answer', () => {
    const answers = [
      { studentId: 's1', selectedOption: 'A', answeredAt: 10, completedAt: undefined },
      { studentId: 's2', selectedOption: undefined, answeredAt: undefined, completedAt: 20 },
      { studentId: 's3', selectedOption: 'D', answeredAt: 10, completedAt: 20 },
    ]
    expect(tallyAnswers(answers)).toEqual({ answerCount: 1, optionCounts: { D: 1 }, timeSampleMs: [] })
  })

  test('a blank in a completed sitting still showed the key', () => {
    const answers = [
      { studentId: 's1', selectedOption: undefined, answeredAt: undefined, completedAt: 20 },
      { studentId: 's1', selectedOption: 'C', answeredAt: 30, completedAt: 40 },
    ]
    expect(tallyAnswers(answers)).toBeNull()
  })
})
