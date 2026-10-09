import { describe, expect, test } from 'bun:test'
import { AI_GENERATION_TIMEOUT_MS } from '../src/aiCache'
import { PROMPT_VERSION, isLessonStale } from '../src/lessons'

const NOW = 1_700_000_000_000

describe('isLessonStale', () => {
  // Bumping PROMPT_VERSION never reached students: the page only requested a
  // lesson when none existed, so every cached one was served forever.
  test('a ready lesson from an older prompt is stale', () => {
    expect(isLessonStale({ status: 'ready', promptVersion: 'v1', updatedAt: NOW }, NOW)).toBe(true)
  })

  test('a ready lesson on the current prompt is not', () => {
    expect(
      isLessonStale({ status: 'ready', promptVersion: PROMPT_VERSION, updatedAt: NOW }, NOW),
    ).toBe(false)
  })

  test('a generation whose action died is stale; one still running is not', () => {
    const generating = { status: 'generating' as const, promptVersion: PROMPT_VERSION }
    expect(
      isLessonStale({ ...generating, updatedAt: NOW - AI_GENERATION_TIMEOUT_MS - 1 }, NOW),
    ).toBe(true)
    expect(isLessonStale({ ...generating, updatedAt: NOW - 1000 }, NOW)).toBe(false)
  })

  // A failure is retried from the "Reintentar" button, not on every visit.
  test('a failed lesson is left to the retry button', () => {
    expect(isLessonStale({ status: 'failed', promptVersion: 'v1', updatedAt: NOW }, NOW)).toBe(false)
  })
})
