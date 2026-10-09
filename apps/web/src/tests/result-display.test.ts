import { describe, expect, it } from 'vitest'
import {
  celebrationFor,
  formatClock,
  formatSignedPoints,
  hasResultScreen,
  pickPracticeSubtopic,
  previousPlacementIndex,
  simulacroGapMessage,
} from '../lib/result-display'

describe('hasResultScreen', () => {
  it('opens nivelación and simulacro on their result, everything else on the questions', () => {
    expect(hasResultScreen('nivelacion')).toBe(true)
    expect(hasResultScreen('simulacro')).toBe(true)
    expect(hasResultScreen('topic')).toBe(false)
    expect(hasResultScreen('repaso')).toBe(false)
    expect(hasResultScreen('diagnostic')).toBe(false)
  })
})

describe('formatClock', () => {
  it('reads a question time as minutes and zero-padded seconds', () => {
    expect(formatClock(135_000)).toBe('2:15')
    expect(formatClock(9_000)).toBe('0:09')
    expect(formatClock(12 * 60_000 + 5_000)).toBe('12:05')
  })

  it('rounds to the nearest second without printing 60 seconds', () => {
    expect(formatClock(59_600)).toBe('1:00')
    expect(formatClock(121_400)).toBe('2:01')
  })
})

describe('formatSignedPoints', () => {
  it('always carries a sign so a change reads as a change', () => {
    expect(formatSignedPoints(7)).toBe('+7')
    expect(formatSignedPoints(-3)).toBe('−3')
    expect(formatSignedPoints(0)).toBe('±0')
  })
})

describe('pickPracticeSubtopic', () => {
  it('takes the weakest subtopic with misses across every area', () => {
    const areas = [
      {
        subjectId: 'matematicas',
        subtopics: [
          { subtopicId: 'mat_a', correctCount: 1, questionCount: 4 },
          { subtopicId: 'mat_b', correctCount: 3, questionCount: 3 },
        ],
      },
      {
        subjectId: 'lectura_critica',
        subtopics: [{ subtopicId: 'lc_a', correctCount: 0, questionCount: 2 }],
      },
    ]
    expect(pickPracticeSubtopic(areas)).toEqual({ subjectId: 'lectura_critica', subtopicId: 'lc_a' })
  })

  it('breaks an accuracy tie towards the subtopic with more misses', () => {
    const areas = [
      { subjectId: 'a', subtopics: [{ subtopicId: 'few', correctCount: 1, questionCount: 2 }] },
      { subjectId: 'b', subtopics: [{ subtopicId: 'many', correctCount: 3, questionCount: 6 }] },
    ]
    expect(pickPracticeSubtopic(areas)?.subtopicId).toBe('many')
  })

  it('offers nothing when every question was right', () => {
    expect(
      pickPracticeSubtopic([
        { subjectId: 'a', subtopics: [{ subtopicId: 'x', correctCount: 2, questionCount: 2 }] },
      ]),
    ).toBeNull()
  })
})

describe('previousPlacementIndex', () => {
  const current = { _id: 'now', subjectId: 'matematicas', startedAt: 300 }

  it('places the last completed nivelación of the same area before this one', () => {
    const sessions = [
      { _id: 'old', kind: 'nivelacion', status: 'completed', subjectId: 'matematicas', startedAt: 100, summary: { accuracy: 0.2 } },
      { _id: 'mid', kind: 'nivelacion', status: 'completed', subjectId: 'matematicas', startedAt: 200, summary: { accuracy: 0.9 } },
      { _id: 'other', kind: 'nivelacion', status: 'completed', subjectId: 'ingles', startedAt: 250, summary: { accuracy: 0 } },
      { _id: 'quit', kind: 'nivelacion', status: 'abandoned', subjectId: 'matematicas', startedAt: 260, summary: { accuracy: 0 } },
      { _id: 'now', kind: 'nivelacion', status: 'completed', subjectId: 'matematicas', startedAt: 300, summary: { accuracy: 0.5 } },
      { _id: 'later', kind: 'nivelacion', status: 'completed', subjectId: 'matematicas', startedAt: 400, summary: { accuracy: 0 } },
    ]
    // 90 % lands in the top band of Matemáticas.
    expect(previousPlacementIndex(sessions, current)).toBe(4)
  })

  it('is null on the first nivelación of an area', () => {
    expect(previousPlacementIndex([{ ...current, kind: 'nivelacion', status: 'completed', summary: { accuracy: 1 } }], current)).toBeNull()
  })
})

describe('celebrationFor', () => {
  it('celebrates the first placement, even a preliminary one', () => {
    expect(celebrationFor({ isFirstPlacement: true, hasEnoughEvidence: false, levelIndex: 1, previousIndex: null })).toBe('first')
  })

  it('celebrates a level up backed by enough evidence', () => {
    expect(celebrationFor({ isFirstPlacement: false, hasEnoughEvidence: true, levelIndex: 3, previousIndex: 2 })).toBe('level_up')
  })

  it('stays quiet on the same level, a drop, or a level up the evidence does not support', () => {
    expect(celebrationFor({ isFirstPlacement: false, hasEnoughEvidence: true, levelIndex: 2, previousIndex: 2 })).toBeNull()
    expect(celebrationFor({ isFirstPlacement: false, hasEnoughEvidence: true, levelIndex: 1, previousIndex: 2 })).toBeNull()
    expect(celebrationFor({ isFirstPlacement: false, hasEnoughEvidence: false, levelIndex: 3, previousIndex: 2 })).toBeNull()
    expect(celebrationFor({ isFirstPlacement: false, hasEnoughEvidence: true, levelIndex: null, previousIndex: 1 })).toBeNull()
  })
})

describe('simulacroGapMessage', () => {
  it('names the missing sitting first: it is the one the student can fix', () => {
    expect(simulacroGapMessage({ missingSessionNumbers: [2], missingSubjectIds: ['ingles'] })).toBe(
      'Te falta la Sesión 2 para calcular tu puntaje global de 0 a 500.',
    )
  })

  it('names the areas the exam could not serve', () => {
    expect(simulacroGapMessage({ missingSessionNumbers: [], missingSubjectIds: ['ingles'] })).toBe(
      'Este simulacro no incluyó Inglés, así que no hay puntaje global de 0 a 500.',
    )
    expect(
      simulacroGapMessage({ missingSessionNumbers: [], missingSubjectIds: ['matematicas', 'ingles'] }),
    ).toBe('Este simulacro no incluyó Matemáticas ni Inglés, así que no hay puntaje global de 0 a 500.')
  })

  it('says nothing when the exam is whole', () => {
    expect(simulacroGapMessage({ missingSessionNumbers: [], missingSubjectIds: [] })).toBeNull()
  })
})
