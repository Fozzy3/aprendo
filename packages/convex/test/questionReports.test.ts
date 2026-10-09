import { describe, expect, test } from 'bun:test'
import {
  DAILY_REPORT_LIMIT,
  MAX_REPORT_NOTE_CHARS,
  hasReportBudget,
  normalizeReportNote,
} from '../src/questionReports'

describe('normalizeReportNote', () => {
  test('stores the note trimmed', () => {
    expect(normalizeReportNote('  la imagen se corta  ')).toBe('la imagen se corta')
  })

  test('an empty note is no note', () => {
    expect(normalizeReportNote(undefined)).toBeUndefined()
    expect(normalizeReportNote('   ')).toBeUndefined()
  })

  test('accepts up to the limit and refuses past it', () => {
    expect(MAX_REPORT_NOTE_CHARS).toBe(500)
    expect(normalizeReportNote('a'.repeat(MAX_REPORT_NOTE_CHARS))).toHaveLength(MAX_REPORT_NOTE_CHARS)
    expect(() => normalizeReportNote('a'.repeat(MAX_REPORT_NOTE_CHARS + 1))).toThrow()
  })
})

describe('hasReportBudget', () => {
  test('a student files reports until the daily limit', () => {
    expect(hasReportBudget(0)).toBe(true)
    expect(hasReportBudget(DAILY_REPORT_LIMIT - 1)).toBe(true)
    expect(hasReportBudget(DAILY_REPORT_LIMIT)).toBe(false)
  })
})
