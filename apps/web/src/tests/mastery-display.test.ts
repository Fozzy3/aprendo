import { describe, expect, it } from 'vitest'
import { closingLine } from '../lib/mastery-display'

describe('closingLine', () => {
  it('names the step up when the level moved', () => {
    expect(closingLine({ from: 'intentado', to: 'familiar' })).toEqual({ moved: 'up', text: 'Intentado → Familiar' })
  })

  it('says what is missing when it did not', () => {
    expect(closingLine({ from: 'familiar', to: 'familiar' }).text)
      .toBe('Sigue en Familiar. Para Competente: una práctica perfecta de 4 o más preguntas, sin pedir ayuda al tutor.')
    expect(closingLine({ from: 'intentado', to: 'intentado' }).text).toMatch(/7 de cada 10/)
    expect(closingLine({ from: 'dominado', to: 'dominado' }).moved).toBe('same')
  })

  it('says a drop plainly', () => {
    expect(closingLine({ from: 'competente', to: 'familiar' })).toEqual({ moved: 'down', text: 'Competente → Familiar' })
  })
})
import {
  countByLevel,
  countedSubtopics,
  levelFor,
  masteryLevelMap,
  resolvePathStates,
  scopeMastery,
  subjectSubtopics,
} from '../lib/mastery-display'

describe('countedSubtopics', () => {
  it('is the one denominator Temario, Ruta and Progreso share', () => {
    const subtopics = [
      { questionCount: 4, level: 'competente' as const },
      { questionCount: 0, level: 'sin_empezar' as const },
      { questionCount: 0, level: 'familiar' as const },
      { questionCount: 3, level: 'sin_empezar' as const },
    ]
    const counted = countedSubtopics(subtopics)
    expect(counted).toHaveLength(3)
    expect(counted.length).toBe(scopeMastery(subtopics).subtopicCount)
  })
})

describe('subjectSubtopics', () => {
  it('flattens a syllabus subject and reads each level', () => {
    const levels = masteryLevelMap([{ subtopicId: 'b', masteryLevel: 'familiar' }])
    const subject = {
      categories: [
        { subtopics: [{ id: 'a', questionCount: 2 }] },
        { subtopics: [{ id: 'b', questionCount: 0 }] },
      ],
    }
    expect(subjectSubtopics(subject, levels)).toEqual([
      { id: 'a', questionCount: 2, level: 'sin_empezar' },
      { id: 'b', questionCount: 0, level: 'familiar' },
    ])
  })
})

describe('levelFor', () => {
  it('reads a listed subtopic and treats an unlisted one as sin_empezar', () => {
    const map = masteryLevelMap([{ subtopicId: 'a', masteryLevel: 'familiar' }])
    expect(levelFor(map, 'a')).toBe('familiar')
    expect(levelFor(map, 'b')).toBe('sin_empezar')
  })
})

describe('scopeMastery', () => {
  it('scores Khan points over 100 per practicable subtopic', () => {
    const summary = scopeMastery([
      { questionCount: 5, level: 'dominado' },
      { questionCount: 5, level: 'familiar' },
      { questionCount: 5, level: 'sin_empezar' },
      { questionCount: 5, level: 'intentado' },
    ])
    expect(summary.points).toBe(150)
    expect(summary.maxPoints).toBe(400)
    expect(summary.percent).toBe(38)
  })

  it('leaves out subtopics with no questions, which nobody can practise', () => {
    const summary = scopeMastery([
      { questionCount: 4, level: 'competente' },
      { questionCount: 0, level: 'sin_empezar' },
    ])
    expect(summary.subtopicCount).toBe(1)
    expect(summary.percent).toBe(80)
  })

  it('still counts an empty subtopic the student already practised', () => {
    const summary = scopeMastery([{ questionCount: 0, level: 'familiar' }])
    expect(summary.subtopicCount).toBe(1)
    expect(summary.percent).toBe(50)
  })
})

describe('countByLevel', () => {
  it('counts each level and fills sin_empezar up to the total', () => {
    expect(countByLevel(['familiar', 'familiar', 'dominado', 'intentado'], 10)).toEqual({
      sin_empezar: 6,
      intentado: 1,
      familiar: 2,
      competente: 0,
      dominado: 1,
    })
  })

  it('never reports a negative sin_empezar', () => {
    expect(countByLevel(['familiar', 'familiar'], 1).sin_empezar).toBe(0)
  })
})

describe('resolvePathStates', () => {
  const node = (subtopicId: string, level: 'sin_empezar' | 'intentado' | 'familiar' | 'competente' | 'dominado', questionCount = 5) =>
    ({ subtopicId, questionCount, level })

  it('never locks: Ruta is a recommended order, and the ICFES areas have no strict prerequisites', () => {
    expect(resolvePathStates([node('a', 'sin_empezar'), node('b', 'sin_empezar')], [])).toEqual(['current', 'available'])
  })

  it('puts "Estás aquí" on the compass pick for this area, wherever it sits', () => {
    expect(resolvePathStates([node('a', 'familiar'), node('b', 'sin_empezar'), node('c', 'intentado')], ['c']))
      .toEqual(['available', 'available', 'current'])
  })

  it('marks competente and dominado as mastered, and skips empty subtopics', () => {
    expect(resolvePathStates([node('a', 'dominado'), node('b', 'sin_empezar', 0), node('c', 'competente'), node('d', 'sin_empezar')], []))
      .toEqual(['mastered', 'empty', 'mastered', 'current'])
  })
})
