import { describe, expect, test } from 'bun:test'
import { competencyBreakdown, getCompetenciaLabel } from '../src/taxonomy'

describe('ICFES competencias', () => {
  test('use the official names', () => {
    expect(getCompetenciaLabel('formulacion_ejecucion')).toBe('Formulación y ejecución')
    expect(getCompetenciaLabel('afirmacion_3_critica')).toBe('Reflexionar y evaluar')
  })

  test('break answers down per area and competencia, in the official order, untagged ones left out', () => {
    const rows = competencyBreakdown([
      { subjectId: 'matematicas', competencia: 'argumentacion', isCorrect: false },
      { subjectId: 'matematicas', competencia: 'interpretacion_representacion', isCorrect: true },
      { subjectId: 'matematicas', competencia: 'argumentacion', isCorrect: true },
      { subjectId: 'matematicas', competencia: null, isCorrect: false },
    ])
    expect(rows).toEqual([
      { subjectId: 'matematicas', competencia: 'interpretacion_representacion', answered: 1, correct: 1 },
      { subjectId: 'matematicas', competencia: 'argumentacion', answered: 2, correct: 1 },
    ])
  })
})
