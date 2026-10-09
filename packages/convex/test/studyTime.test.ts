import { describe, expect, test } from 'bun:test'
import { colombiaWeekIndex, colombiaWeekStartMs } from '../src/colombiaTime'
import {
  DEFAULT_WEEKLY_GOAL_MINUTES,
  MAX_QUESTION_MS,
  isValidWeeklyGoal,
  questionStudyMs,
  weeklyStudyMinutes,
} from '../src/studyTime'

const NOW = Date.UTC(2026, 9, 8, 17) // Thursday, midday in Bogotá
const THIS_WEEK = colombiaWeekIndex(NOW)
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MINUTE = 60_000

describe('questionStudyMs', () => {
  test('prefers the time summed over every visit', () => {
    expect(questionStudyMs({ timeSpentMs: 90_000, responseTimeMs: 30_000 })).toBe(90_000)
  })

  test('falls back to the response time', () => {
    expect(questionStudyMs({ responseTimeMs: 30_000 })).toBe(30_000)
  })

  test('caps a question left open on the screen', () => {
    expect(questionStudyMs({ timeSpentMs: 3 * 60 * MINUTE })).toBe(MAX_QUESTION_MS)
  })

  test('ignores missing or nonsense values', () => {
    expect(questionStudyMs({})).toBe(0)
    expect(questionStudyMs({ timeSpentMs: -5 })).toBe(0)
    expect(questionStudyMs({ responseTimeMs: Number.NaN })).toBe(0)
  })
})

describe('weeklyStudyMinutes', () => {
  test('returns the last six calendar weeks, oldest first, current week last', () => {
    const weeks = weeklyStudyMinutes([], NOW)
    expect(weeks).toHaveLength(6)
    expect(weeks.at(-1)?.weekStartMs).toBe(colombiaWeekStartMs(THIS_WEEK))
    expect(weeks[0]?.weekStartMs).toBe(colombiaWeekStartMs(THIS_WEEK - 5))
    expect(weeks.every((week) => week.minutes === 0)).toBe(true)
  })

  test('sums capped question time into the week it happened, in whole minutes', () => {
    const weeks = weeklyStudyMinutes(
      [
        { at: NOW, timeSpentMs: 2 * MINUTE },
        { at: NOW - MINUTE, responseTimeMs: 90_000 },
        { at: NOW - 2 * MINUTE, timeSpentMs: 60 * MINUTE }, // capped
        { at: NOW - WEEK_MS, timeSpentMs: 10 * MINUTE },
      ],
      NOW,
    )
    expect(weeks.at(-1)?.minutes).toBe(Math.round((2 * MINUTE + 90_000 + MAX_QUESTION_MS) / MINUTE))
    expect(weeks.at(-2)?.minutes).toBe(Math.round(MAX_QUESTION_MS / MINUTE))
  })

  test('drops activity older than the window', () => {
    const weeks = weeklyStudyMinutes([{ at: NOW - 10 * WEEK_MS, timeSpentMs: MINUTE }], NOW)
    expect(weeks.reduce((sum, week) => sum + week.minutes, 0)).toBe(0)
  })
})

describe('isValidWeeklyGoal', () => {
  test('accepts 30 to 1200 minutes', () => {
    expect(isValidWeeklyGoal(30)).toBe(true)
    expect(isValidWeeklyGoal(DEFAULT_WEEKLY_GOAL_MINUTES)).toBe(true)
    expect(isValidWeeklyGoal(1200)).toBe(true)
  })

  test('rejects values outside the range or not finite', () => {
    expect(isValidWeeklyGoal(29)).toBe(false)
    expect(isValidWeeklyGoal(1201)).toBe(false)
    expect(isValidWeeklyGoal(Number.NaN)).toBe(false)
  })
})
