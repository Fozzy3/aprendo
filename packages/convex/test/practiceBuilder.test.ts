import { describe, expect, test } from 'bun:test'
import {
  MAX_PRACTICE_QUESTIONS,
  MIN_PRACTICE_QUESTIONS,
  difficultyTiers,
  filterPracticeQuestions,
  practiceBuilderCounts,
  practiceCountError,
  resolvePracticeScope,
} from '../src/practiceBuilder'

const ALGEBRA = 'matematicas.algebra_equations.equations_inequalities'
const PROPORCIONES = 'matematicas.number_proportionality.ratios_proportions_percent'
const VOCAB = 'ingles.lexis.vocab_definitions'

const q = (_id: string, primarySubtopicId: string, difficultyRating?: number) => ({
  _id,
  subjectId: primarySubtopicId.split('.')[0],
  primarySubtopicId,
  difficultyRating,
})

const noHistory = { seen: new Set<string>(), wrong: new Set<string>(), flagged: new Set<string>() }

describe('practiceCountError', () => {
  test('accepts 5 to 30 whole questions', () => {
    expect(MIN_PRACTICE_QUESTIONS).toBe(5)
    expect(MAX_PRACTICE_QUESTIONS).toBe(30)
    expect(practiceCountError(5)).toBeNull()
    expect(practiceCountError(30)).toBeNull()
  })

  test('explains out-of-range counts in Spanish', () => {
    expect(practiceCountError(4)).toBe('Elige entre 5 y 30 preguntas.')
    expect(practiceCountError(31)).toBe('Elige entre 5 y 30 preguntas.')
    expect(practiceCountError(7.5)).toBe('Elige entre 5 y 30 preguntas.')
  })
})

describe('resolvePracticeScope', () => {
  test('no filters is the whole bank', () => {
    expect(resolvePracticeScope({})).toEqual({ subjectId: null, subtopicIds: null })
  })

  test('derives the area from its subtopics', () => {
    expect(resolvePracticeScope({ subtopicIds: [ALGEBRA, PROPORCIONES] })).toEqual({
      subjectId: 'matematicas',
      subtopicIds: [ALGEBRA, PROPORCIONES],
    })
  })

  test('subtopics from several areas have no single area', () => {
    expect(resolvePracticeScope({ subtopicIds: [ALGEBRA, VOCAB] })).toEqual({
      subjectId: null,
      subtopicIds: [ALGEBRA, VOCAB],
    })
  })

  test('rejects an unknown area', () => {
    expect(resolvePracticeScope({ subjectId: 'astrologia' })).toEqual({
      error: 'Selecciona un área válida.',
    })
  })

  test('rejects an unknown subtopic', () => {
    expect(resolvePracticeScope({ subtopicIds: ['matematicas.inventado'] })).toEqual({
      error: 'Selecciona subtemas válidos.',
    })
  })

  test('rejects a subtopic from another area', () => {
    expect(resolvePracticeScope({ subjectId: 'ingles', subtopicIds: [ALGEBRA] })).toEqual({
      error: 'Los subtemas deben ser del área que elegiste.',
    })
  })

  test('an empty subtopic list means every subtopic', () => {
    expect(resolvePracticeScope({ subjectId: 'ingles', subtopicIds: [] })).toEqual({
      subjectId: 'ingles',
      subtopicIds: null,
    })
  })
})

describe('difficultyTiers', () => {
  test('splits the rated questions in thirds, easiest first; unrated ones are medio', () => {
    const tiers = difficultyTiers([
      q('d900', ALGEBRA, 900),
      q('d1500', ALGEBRA, 1500),
      q('d1200', ALGEBRA, 1200),
      q('nuevo', ALGEBRA),
      q('d1000', ALGEBRA, 1000),
      q('d1300', ALGEBRA, 1300),
      q('d1400', ALGEBRA, 1400),
    ])
    expect(Object.fromEntries(tiers)).toEqual({
      d900: 'basico',
      d1000: 'basico',
      d1200: 'medio',
      d1300: 'medio',
      d1400: 'avanzado',
      d1500: 'avanzado',
      nuevo: 'medio',
    })
  })
})

describe('filterPracticeQuestions', () => {
  const bank = [
    q('a1', ALGEBRA, 900),
    q('a2', ALGEBRA, 1200),
    q('a3', ALGEBRA, 1500),
    q('p1', PROPORCIONES),
    q('v1', VOCAB),
  ]

  test('narrows to the area', () => {
    const result = filterPracticeQuestions(bank, { subjectId: 'matematicas', source: 'todas' }, noHistory)
    expect(result.map((item) => item._id)).toEqual(['a1', 'a2', 'a3', 'p1'])
  })

  test('narrows to the chosen subtopics', () => {
    const result = filterPracticeQuestions(bank, { subtopicIds: [PROPORCIONES, VOCAB], source: 'todas' }, noHistory)
    expect(result.map((item) => item._id)).toEqual(['p1', 'v1'])
  })

  test('tiers are measured inside the chosen scope', () => {
    const result = filterPracticeQuestions(
      bank,
      { subtopicIds: [ALGEBRA], difficulty: 'avanzado', source: 'todas' },
      noHistory,
    )
    expect(result.map((item) => item._id)).toEqual(['a3'])
  })

  test('no vistas leaves out anything already shown', () => {
    const result = filterPracticeQuestions(
      bank,
      { subjectId: 'matematicas', source: 'no_vistas' },
      { ...noHistory, seen: new Set(['a1', 'p1']) },
    )
    expect(result.map((item) => item._id)).toEqual(['a2', 'a3'])
  })

  test('falladas and marcadas draw from the history', () => {
    const history = { seen: new Set(['a1', 'a2']), wrong: new Set(['a2']), flagged: new Set(['a1', 'v1']) }
    expect(filterPracticeQuestions(bank, { source: 'falladas' }, history).map((item) => item._id)).toEqual(['a2'])
    expect(filterPracticeQuestions(bank, { source: 'marcadas' }, history).map((item) => item._id)).toEqual(['a1', 'v1'])
  })
})

describe('practiceBuilderCounts', () => {
  test('counts what matches plus how it splits by difficulty', () => {
    const bank = [q('a1', ALGEBRA, 900), q('a2', ALGEBRA, 1200), q('a3', ALGEBRA, 1500), q('p1', PROPORCIONES)]
    expect(practiceBuilderCounts(bank, { subjectId: 'matematicas', difficulty: 'medio', source: 'todas' }, noHistory))
      .toEqual({ available: 2, byDifficulty: { basico: 1, medio: 2, avanzado: 1 } })
  })
})
