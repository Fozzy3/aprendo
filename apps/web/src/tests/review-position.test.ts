import { describe, expect, it } from 'vitest'
import { indexOfPosition } from '../lib/review-position'

describe('indexOfPosition', () => {
  it('finds the question by its session position, not by array index', () => {
    // Position 2 was deleted on reprocess, so the array has a gap.
    const questions = [{ position: 1 }, { position: 3 }, { position: 4 }]
    expect(indexOfPosition(questions, 3)).toBe(1)
    expect(indexOfPosition(questions, 4)).toBe(2)
  })

  it('falls back to the first question when the position is missing', () => {
    const questions = [{ position: 1 }, { position: 3 }]
    expect(indexOfPosition(questions, 2)).toBe(0)
    expect(indexOfPosition(questions, 99)).toBe(0)
    expect(indexOfPosition(questions, undefined)).toBe(0)
    expect(indexOfPosition([], 1)).toBe(0)
  })
})
