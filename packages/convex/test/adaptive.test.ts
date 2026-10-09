import { describe, expect, test } from 'bun:test'
import { TARGET_SUCCESS, orderByDesirableDifficulty } from '../src/adaptive'
import { DEFAULT_RATING, expectedScore } from '../src/elo'

const q = (id: string, difficultyRating?: number, subjectId = 'matematicas') => ({
  id,
  subjectId,
  difficultyRating,
})

describe('orderByDesirableDifficulty', () => {
  test('aims at about 70% expected success', () => {
    expect(TARGET_SUCCESS).toBe(0.7)
  })

  test('puts the question closest to 70% expected success first', () => {
    const ability = 1400
    const ordered = orderByDesirableDifficulty(
      [q('muy-dificil', 1700), q('trivial', 900), q('justa', 1250), q('dificil', 1350)],
      { matematicas: ability },
    )
    expect(ordered.map((item) => item.id)).toEqual(['justa', 'dificil', 'trivial', 'muy-dificil'])
    expect(expectedScore(ability, 1250)).toBeCloseTo(0.7, 1)
  })

  test('keeps the incoming order when nothing is rated', () => {
    const ordered = orderByDesirableDifficulty([q('a'), q('b'), q('c')], { matematicas: 1500 })
    expect(ordered.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  test('keeps the incoming order between equally fitting questions', () => {
    const ordered = orderByDesirableDifficulty([q('a', 1100), q('b', 1100)], { matematicas: 1300 })
    expect(ordered.map((item) => item.id)).toEqual(['a', 'b'])
  })

  test('an unmeasured student and unrated questions both start from the default rating', () => {
    const ordered = orderByDesirableDifficulty(
      [q('sin-calificar'), q('facil', DEFAULT_RATING - 150)],
      undefined,
    )
    // 1200 vs 1050 → ~0.70: the easier rated item fits a beginner better than a coin flip.
    expect(ordered.map((item) => item.id)).toEqual(['facil', 'sin-calificar'])
  })

  test('uses the ability of each question\'s own area', () => {
    const ordered = orderByDesirableDifficulty(
      [q('ingles', 1050, 'ingles'), q('mate', 1550, 'matematicas')],
      { matematicas: 1700, ingles: 900 },
    )
    // Inglés: 900 vs 1050 → ~0.30. Matemáticas: 1700 vs 1550 → ~0.70.
    expect(ordered.map((item) => item.id)).toEqual(['mate', 'ingles'])
  })

  test('does not mutate its input', () => {
    const input = [q('b', 1700), q('a', 1250)]
    orderByDesirableDifficulty(input, { matematicas: 1400 })
    expect(input.map((item) => item.id)).toEqual(['b', 'a'])
  })
})
