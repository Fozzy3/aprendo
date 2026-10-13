import { describe, expect, it } from 'vitest'
import { dateInputValue, endOfDayFromInput } from '../lib/date-input'

describe('license dates', () => {
  it('a license "until" a day runs to the last second of that day in Colombia', () => {
    // 2027-06-30 23:59:59 in Bogotá (UTC-5) is 2027-07-01 04:59:59 UTC.
    expect(endOfDayFromInput('2027-06-30')).toBe(Date.UTC(2027, 6, 1, 4, 59, 59))
  })

  it('shows that same moment back as the Colombian day it ends', () => {
    expect(dateInputValue(endOfDayFromInput('2027-06-30'))).toBe('2027-06-30')
    expect(dateInputValue(Date.UTC(2027, 0, 1, 3, 0, 0))).toBe('2026-12-31')
  })

  it('an empty or broken input is not a date', () => {
    expect(Number.isNaN(endOfDayFromInput(''))).toBe(true)
    expect(Number.isNaN(endOfDayFromInput('30/06/2027'))).toBe(true)
  })
})
