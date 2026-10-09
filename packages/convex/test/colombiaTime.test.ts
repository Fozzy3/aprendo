import { describe, expect, test } from 'bun:test'
import { colombiaWeekIndex, colombiaWeekStartMs } from '../src/colombiaTime'

/** A wall-clock time in Bogotá (UTC-5, no DST) as a UTC timestamp. */
function bogota(date: string, time = '00:00:00') {
  return Date.parse(`${date}T${time}-05:00`)
}

describe('colombiaWeekIndex', () => {
  // 5 Oct 2026 is a Monday; 8 Oct is a Thursday, 11 Oct a Sunday.
  test('a week runs Monday 00:00 to Sunday 23:59 in Bogotá', () => {
    const monday = colombiaWeekIndex(bogota('2026-10-05'))
    expect(colombiaWeekIndex(bogota('2026-10-08', '07:00:00'))).toBe(monday)
    expect(colombiaWeekIndex(bogota('2026-10-11', '23:59:59'))).toBe(monday)
    expect(colombiaWeekIndex(bogota('2026-10-12'))).toBe(monday + 1)
  })

  // The epoch was a Thursday: buckets aligned to it rolled over on Thursdays,
  // so studying Mon-Wed and opening "Hoy" on Thursday read as an empty week.
  test('Thursday does not start a new week', () => {
    expect(colombiaWeekIndex(bogota('2026-10-08'))).toBe(
      colombiaWeekIndex(bogota('2026-10-07', '23:59:59')),
    )
  })

  test('rolls over at Bogotá midnight, not UTC midnight', () => {
    // Sunday 22:00 in Bogotá is already Monday 03:00 UTC.
    expect(colombiaWeekIndex(bogota('2026-10-11', '22:00:00'))).toBe(
      colombiaWeekIndex(bogota('2026-10-05')),
    )
  })
})

describe('colombiaWeekStartMs', () => {
  test('labels a week with its Monday at Bogotá midnight', () => {
    const week = colombiaWeekIndex(bogota('2026-10-08', '15:30:00'))
    expect(colombiaWeekStartMs(week)).toBe(bogota('2026-10-05'))
  })
})
