import { describe, expect, test } from 'bun:test'
import { colombiaDayNumber } from '../src/colombiaTime'
import { summarizeActivity } from '../src/history'

const NOW = Date.UTC(2026, 9, 8, 17) // midday in Bogotá
const TODAY = colombiaDayNumber(NOW)

const sessions = [
  { _id: 'done', status: 'completed' },
  { _id: 'open', status: 'in_progress' },
  { _id: 'gone', status: 'abandoned' },
]

function attempt(sessionId: string, isCorrect: boolean) {
  return { sessionId, isCorrect, answeredAt: NOW, responseTimeMs: 1000 }
}

describe('summarizeActivity', () => {
  // An open simulacro grades each answer as it is saved. Counting those grades
  // here would let a student change an answer and watch "N correctas" move.
  test('a right answer in an open or abandoned sitting is not counted as correct', () => {
    const { stats, days } = summarizeActivity(
      [attempt('done', true), attempt('done', false), attempt('open', true), attempt('gone', true)],
      sessions,
      TODAY,
      1,
    )
    expect(stats.totalCorrect).toBe(1)
    expect(days.at(-1)?.correctCount).toBe(1)
  })

  test('accuracy is read over finished sittings only, so an open one cannot move it', () => {
    const finished = [attempt('done', true), attempt('done', false)]
    const before = summarizeActivity(finished, sessions, TODAY, 1).stats.accuracy
    const after = summarizeActivity([...finished, attempt('open', false)], sessions, TODAY, 1).stats.accuracy
    expect(before).toBe(0.5)
    expect(after).toBe(0.5)
  })

  test('every answer still counts as activity', () => {
    const { stats, days } = summarizeActivity(
      [attempt('done', true), attempt('open', true), attempt('gone', false)],
      sessions,
      TODAY,
      1,
    )
    expect(stats.totalAnswered).toBe(3)
    expect(days.at(-1)?.attemptCount).toBe(3)
    expect(stats.activeDayCount).toBe(1)
    expect(stats.currentStreakDays).toBe(1)
    expect(stats.totalStudyTimeMs).toBe(3000)
  })

  test('with nothing finished yet there is no accuracy to show', () => {
    const { stats } = summarizeActivity([attempt('open', true)], sessions, TODAY, 1)
    expect(stats.totalCorrect).toBe(0)
    expect(stats.accuracy).toBeNull()
  })
})
