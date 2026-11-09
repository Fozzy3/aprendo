import { describe, expect, test } from 'bun:test'
import { AI_GENERATION_TIMEOUT_MS } from '../src/aiCache'
import { PROMPT_VERSION, isLessonStale, lessonStepsSchema, stepsToMarkdown } from '../src/lessons'

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

describe('lesson steps (F56)', () => {
  const step = (words: number) => ({ predict: '¿Qué crees que pasa?', reveal: Array.from({ length: words - 4 }, () => 'palabra').join(' ') })
  const steps = (count: number, words = 20) => Array.from({ length: count }, () => step(words))

  test('accepts 3 to 5 steps of at most 40 words', () => {
    expect(lessonStepsSchema.safeParse(steps(3)).success).toBe(true)
    expect(lessonStepsSchema.safeParse(steps(5, 40)).success).toBe(true)
  })

  test('refuses fewer than 3, more than 5, or a step over 40 words', () => {
    expect(lessonStepsSchema.safeParse(steps(2)).success).toBe(false)
    expect(lessonStepsSchema.safeParse(steps(6)).success).toBe(false)
    expect(lessonStepsSchema.safeParse(steps(3, 41)).success).toBe(false)
  })

  test('every step opens by asking the student to predict', () => {
    expect(lessonStepsSchema.safeParse([{ predict: '', reveal: 'x' }, ...steps(2)]).success).toBe(false)
  })

  test('the steps also render as markdown, so the old lesson screen keeps working', () => {
    const body = stepsToMarkdown([{ predict: '¿Qué pasa?', reveal: 'Pasa esto.' }, { predict: '¿Y luego?', reveal: 'Aquello.' }])
    expect(body).toBe('**¿Qué pasa?**\n\nPasa esto.\n\n**¿Y luego?**\n\nAquello.')
  })
})
