import { describe, expect, it } from 'vitest'
import { formatPaceMs, paceLabel } from '../lib/pacing-display'

describe('paceLabel', () => {
  it('names the status and how many questions', () => {
    expect(paceLabel({ status: 'a_tiempo', deltaQuestions: 0 })).toBe('A tiempo')
    expect(paceLabel({ status: 'adelantado', deltaQuestions: 3 })).toBe('Adelantado · 3')
    expect(paceLabel({ status: 'atrasado', deltaQuestions: -4 })).toBe('Atrasado · 4')
  })
})

describe('formatPaceMs', () => {
  it('reads like the official guide', () => {
    expect(formatPaceMs(135_000)).toBe('2 min 15 s')
    expect(formatPaceMs(120_000)).toBe('2 min')
    expect(formatPaceMs(121_000)).toBe('2 min 1 s')
    expect(formatPaceMs(45_000)).toBe('45 s')
  })
})
