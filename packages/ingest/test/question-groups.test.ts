import { describe, expect, test } from 'bun:test'
import { groupExtractedQuestions } from '../src/question-groups'
import type { QuestionExtraction } from '../src/question-schema'

function question(
  questionNumber: number,
  overrides: Partial<QuestionExtraction> = {},
): QuestionExtraction {
  return {
    questionNumber,
    stem: `Pregunta ${questionNumber}`,
    options: [
      { label: 'A', text: 'a' },
      { label: 'B', text: 'b' },
    ],
    ...overrides,
  }
}

const SHARED = 'El siguiente texto describe el ciclo del agua...'

describe('groupExtractedQuestions', () => {
  test('links every question that repeats the same contextKey', () => {
    const result = groupExtractedQuestions([
      question(4, { context: SHARED, contextKey: 'ctx-q4-q7', contextRange: { from: 4, to: 7 } }),
      question(5, { context: SHARED, contextKey: 'ctx-q4-q7', contextRange: { from: 4, to: 7 } }),
      question(6, { context: SHARED, contextKey: 'ctx-q4-q7', contextRange: { from: 4, to: 7 } }),
      question(7, { context: SHARED, contextKey: 'ctx-q4-q7', contextRange: { from: 4, to: 7 } }),
    ])

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]?.contextMarkdown).toBe(SHARED)
    expect(result.groups[0]?.firstNumber).toBe(4)
    expect(result.groups[0]?.lastNumber).toBe(7)
    expect(result.groupKeyByIndex).toEqual(['ctx-q4-q7', 'ctx-q4-q7', 'ctx-q4-q7', 'ctx-q4-q7'])
    expect(result.groupPositionByIndex).toEqual([0, 1, 2, 3])
  })

  test('groups members that are not adjacent in the extraction output', () => {
    const result = groupExtractedQuestions([
      question(4, { context: SHARED, contextKey: 'ctx-a' }),
      question(20, {}),
      question(5, { context: SHARED, contextKey: 'ctx-a' }),
    ])

    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]?.memberNumbers).toEqual([4, 5])
    expect(result.groupKeyByIndex).toEqual(['ctx-a', null, 'ctx-a'])
  })

  test('leaves standalone questions ungrouped', () => {
    const result = groupExtractedQuestions([question(1), question(2)])

    expect(result.groups).toHaveLength(0)
    expect(result.groupKeyByIndex).toEqual([null, null])
  })

  test('does not create a group from a single question carrying a key', () => {
    const result = groupExtractedQuestions([
      question(4, { context: SHARED, contextKey: 'ctx-lonely', contextRange: { from: 4, to: 7 } }),
      question(5),
    ])

    expect(result.groups).toHaveLength(0)
    expect(result.groupKeyByIndex).toEqual([null, null])
  })

  test('ignores a key when no member carries the stimulus text', () => {
    const result = groupExtractedQuestions([
      question(4, { contextKey: 'ctx-empty' }),
      question(5, { contextKey: 'ctx-empty' }),
    ])

    expect(result.groups).toHaveLength(0)
  })

  test('falls back to the observed numbers when the stated range is too narrow', () => {
    const result = groupExtractedQuestions([
      question(4, { context: SHARED, contextKey: 'ctx-a', contextRange: { from: 4, to: 5 } }),
      question(5, { context: SHARED, contextKey: 'ctx-a', contextRange: { from: 4, to: 5 } }),
      question(6, { context: SHARED, contextKey: 'ctx-a', contextRange: { from: 4, to: 5 } }),
    ])

    // The stated range says 4-5 but three questions share the stimulus, so the
    // range is wrong and the observed numbers win.
    expect(result.groups[0]?.firstNumber).toBe(4)
    expect(result.groups[0]?.lastNumber).toBe(6)
  })

  test('keeps a stated range that is wider than the extracted members', () => {
    // Question 6 failed to extract; the exam still says the stimulus covers 4-7.
    const result = groupExtractedQuestions([
      question(4, { context: SHARED, contextKey: 'ctx-a', contextRange: { from: 4, to: 7 } }),
      question(5, { context: SHARED, contextKey: 'ctx-a', contextRange: { from: 4, to: 7 } }),
      question(7, { context: SHARED, contextKey: 'ctx-a', contextRange: { from: 4, to: 7 } }),
    ])

    expect(result.groups[0]?.firstNumber).toBe(4)
    expect(result.groups[0]?.lastNumber).toBe(7)
    expect(result.groups[0]?.memberNumbers).toEqual([4, 5, 7])
  })

  test('separates distinct groups and dedupes their images', () => {
    const result = groupExtractedQuestions([
      question(4, { context: SHARED, contextKey: 'ctx-a', contextImages: ['a.jpg'] }),
      question(5, { context: SHARED, contextKey: 'ctx-a', contextImages: ['a.jpg'] }),
      question(9, { context: 'Otro texto', contextKey: 'ctx-b' }),
      question(10, { context: 'Otro texto', contextKey: 'ctx-b' }),
    ])

    expect(result.groups).toHaveLength(2)
    expect(result.groups[0]?.contextImages).toEqual(['a.jpg'])
    expect(result.groups[1]?.contextMarkdown).toBe('Otro texto')
  })

  test('treats whitespace-only keys as no key', () => {
    const result = groupExtractedQuestions([
      question(4, { context: SHARED, contextKey: '   ' }),
      question(5, { context: SHARED, contextKey: '' }),
    ])

    expect(result.groups).toHaveLength(0)
  })
})
