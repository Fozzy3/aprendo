import { describe, expect, test } from 'bun:test'
import { summarizeTrends } from '../src/progress'

const WEEK = 7 * 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 8, 17)

const sessions = [
  { _id: 'done', status: 'completed' },
  { _id: 'open', status: 'in_progress' },
  { _id: 'gone', status: 'abandoned' },
]

function attempt(
  sessionId: string,
  isCorrect: boolean,
  extra: { answeredAt?: number; confidence?: 'sure' | 'unsure' | 'guess' } = {},
) {
  return { sessionId, isCorrect, answeredAt: NOW, ...extra }
}

describe('summarizeTrends', () => {
  test('a right answer in an open or abandoned sitting is not counted as correct', () => {
    const trends = summarizeTrends(
      [attempt('done', true), attempt('done', false), attempt('open', true), attempt('gone', true)],
      sessions,
    )
    expect(trends.totalCorrect).toBe(1)
  })

  test('weekly accuracy is read over finished sittings only', () => {
    const { weekly } = summarizeTrends(
      [attempt('done', true), attempt('done', false), attempt('open', true)],
      sessions,
    )
    expect(weekly).toHaveLength(1)
    expect(weekly[0]).toMatchObject({ attempts: 2, accuracy: 0.5 })
  })

  // Otherwise a week spent inside an unfinished simulacro plots as 0%.
  test('a week with only unfinished sittings adds no point to the trend', () => {
    const { weekly } = summarizeTrends(
      [attempt('done', true), attempt('open', true, { answeredAt: NOW + WEEK })],
      sessions,
    )
    expect(weekly).toHaveLength(1)
  })

  // "Seguro y correcta" is a grade too.
  test('the confidence breakdown only reads finished sittings', () => {
    const { confidence } = summarizeTrends(
      [
        attempt('done', true, { confidence: 'sure' }),
        attempt('open', true, { confidence: 'sure' }),
        attempt('gone', false, { confidence: 'sure' }),
      ],
      sessions,
    )
    expect(confidence).toMatchObject({ mastered: 1, misconception: 0, declaredCount: 1 })
  })

  test('every answer still counts as activity', () => {
    const trends = summarizeTrends(
      [attempt('done', true), attempt('open', true, { answeredAt: NOW - WEEK }), attempt('gone', false)],
      sessions,
    )
    expect(trends.totalAttempts).toBe(3)
    expect(trends.activeDays).toBe(2)
    expect(trends.firstActivityAt).toBe(NOW - WEEK)
  })
})
