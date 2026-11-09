import { describe, expect, it } from 'vitest'
import {
  isSealedAttempt,
  missedCount,
  optionExplanations,
  reportItemOutcome,
  reviewDotStatus,
  sessionOutcomeChip,
  timeVersusMedian,
} from '../lib/review-explanations'

const options = [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }]
const rationales = [
  { label: 'A', rationaleMarkdown: 'por A' },
  { label: 'C', rationaleMarkdown: 'por C' },
  { label: 'D', rationaleMarkdown: 'por D' },
]

describe('optionExplanations', () => {
  it('puts the wrong pick first, then the other distractors in option order', () => {
    expect(
      optionExplanations({ options, selectedOption: 'D', correctOption: 'B', rationales }),
    ).toEqual([
      { label: 'D', rationaleMarkdown: 'por D', isPicked: true },
      { label: 'A', rationaleMarkdown: 'por A', isPicked: false },
      { label: 'C', rationaleMarkdown: 'por C', isPicked: false },
    ])
  })

  it('lists every distractor when the pick was right or blank', () => {
    const right = optionExplanations({ options, selectedOption: 'B', correctOption: 'B', rationales })
    const blank = optionExplanations({ options, selectedOption: null, correctOption: 'B', rationales })
    expect(right.map((item) => item.label)).toEqual(['A', 'C', 'D'])
    expect(blank.map((item) => item.isPicked)).toEqual([false, false, false])
  })

  it('never explains the key as a distractor and skips options without a rationale', () => {
    const result = optionExplanations({
      options,
      selectedOption: 'A',
      correctOption: 'C',
      rationales: [...rationales, { label: 'B', rationaleMarkdown: '   ' }],
    })
    expect(result.map((item) => item.label)).toEqual(['A', 'D'])
  })

  it('returns nothing without rationales', () => {
    expect(optionExplanations({ options, selectedOption: 'A', correctOption: 'B', rationales: null })).toEqual([])
  })
})

describe('missedCount', () => {
  it('counts wrong and blank questions', () => {
    expect(
      missedCount([
        { attempt: { isCorrect: true } },
        { attempt: { isCorrect: false } },
        { attempt: null },
        { attempt: {} },
      ]),
    ).toBe(3)
  })

  it('does not count a sealed answer as missed', () => {
    expect(missedCount([{ attempt: { selectedOption: 'A' } }, { attempt: { selectedOption: 'A', isCorrect: null } }])).toBe(0)
  })
})

describe('isSealedAttempt', () => {
  it('is an answer with no grade yet, not a blank', () => {
    expect(isSealedAttempt({ selectedOption: 'A' })).toBe(true)
    expect(isSealedAttempt({ selectedOption: 'A', isCorrect: null })).toBe(true)
    expect(isSealedAttempt({ selectedOption: 'A', isCorrect: false })).toBe(false)
    expect(isSealedAttempt({ isCorrect: false })).toBe(false)
    expect(isSealedAttempt({})).toBe(false)
    expect(isSealedAttempt(null)).toBe(false)
  })
})

describe('reviewDotStatus', () => {
  it('keeps a sealed answer neutral', () => {
    expect(reviewDotStatus({ selectedOption: 'A' })).toBe('answered')
  })

  it('still marks graded answers and empty questions', () => {
    expect(reviewDotStatus({ selectedOption: 'A', isCorrect: true })).toBe('correct')
    expect(reviewDotStatus({ selectedOption: 'A', isCorrect: false })).toBe('incorrect')
    expect(reviewDotStatus({ isCorrect: false })).toBe('incorrect')
    expect(reviewDotStatus(null)).toBe('pending')
  })
})

describe('reportItemOutcome', () => {
  it('names each state of a report item', () => {
    expect(reportItemOutcome({ isCorrect: true })).toBe('Acertaste')
    expect(reportItemOutcome({ isCorrect: false })).toBe('Fallaste')
    expect(reportItemOutcome({ isCorrect: null, answered: true })).toBe('Entregada')
    expect(reportItemOutcome({ isCorrect: null, answered: false })).toBe('En blanco')
  })
})

describe('sessionOutcomeChip', () => {
  it('a handed-in session still sealed is handed in, an open one is not', () => {
    expect(sessionOutcomeChip('completed')).toBe('Entregada')
    expect(sessionOutcomeChip('in_progress')).toBe('Sin terminar')
    expect(sessionOutcomeChip('abandoned')).toBe('Sin terminar')
  })
})

describe('timeVersusMedian', () => {
  it('compares the student time with the median within a 20% band', () => {
    expect(timeVersusMedian(60_000, 100_000)).toBe('faster')
    expect(timeVersusMedian(150_000, 100_000)).toBe('slower')
    expect(timeVersusMedian(110_000, 100_000)).toBe('similar')
  })

  it('says nothing without both times', () => {
    expect(timeVersusMedian(null, 100_000)).toBeNull()
    expect(timeVersusMedian(60_000, null)).toBeNull()
  })
})
