import { describe, expect, it } from 'vitest'
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
  it('opens the first node and locks the rest until the one before is familiar', () => {
    expect(
      resolvePathStates([
        { questionCount: 5, level: 'sin_empezar' },
        { questionCount: 5, level: 'sin_empezar' },
      ]),
    ).toEqual(['current', 'locked'])
  })

  it('unlocks the next node once the previous one reaches familiar', () => {
    expect(
      resolvePathStates([
        { questionCount: 5, level: 'familiar' },
        { questionCount: 5, level: 'sin_empezar' },
        { questionCount: 5, level: 'sin_empezar' },
      ]),
    ).toEqual(['current', 'available', 'locked'])
  })

  it('marks competente and dominado as mastered and moves on', () => {
    expect(
      resolvePathStates([
        { questionCount: 5, level: 'dominado' },
        { questionCount: 5, level: 'competente' },
        { questionCount: 5, level: 'intentado' },
        { questionCount: 5, level: 'sin_empezar' },
      ]),
    ).toEqual(['mastered', 'mastered', 'current', 'locked'])
  })

  it('never blocks on a subtopic with no questions', () => {
    expect(
      resolvePathStates([
        { questionCount: 5, level: 'familiar' },
        { questionCount: 0, level: 'sin_empezar' },
        { questionCount: 5, level: 'sin_empezar' },
      ]),
    ).toEqual(['current', 'empty', 'available'])
  })

  it('opens the path even when it starts with empty subtopics', () => {
    expect(
      resolvePathStates([
        { questionCount: 0, level: 'sin_empezar' },
        { questionCount: 5, level: 'sin_empezar' },
      ]),
    ).toEqual(['empty', 'current'])
  })

  it('never locks a subtopic the student already practised elsewhere', () => {
    expect(
      resolvePathStates([
        { questionCount: 5, level: 'sin_empezar' },
        { questionCount: 5, level: 'intentado' },
      ]),
    ).toEqual(['current', 'available'])
  })
})
