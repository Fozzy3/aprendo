import { describe, expect, test } from 'bun:test'
import {
  MASTERY_LEVELS,
  MASTERY_POINTS,
  interleaveBlocks,
  masteryContext,
  masteryLevelOf,
  nextMasteryLevel,
  orderRetoCandidates,
  revealedQuestionIds,
  summarizeMastery,
  type MasteryLevel,
} from '../src/mastery'

const evidence = (correctCount: number, questionCount: number, answeredCount = questionCount) => ({
  correctCount,
  questionCount,
  answeredCount,
})

describe('masteryContext', () => {
  test('exam kinds are mixed evidence', () => {
    for (const kind of ['simulacro', 'nivelacion', 'diagnostic'] as const) {
      expect(masteryContext({ kind }, 1)).toBe('mixta')
    }
  })

  test('recommended practice is mixed only across 3 or more subtopics', () => {
    expect(masteryContext({ kind: 'recommended' }, 2)).toBe('practica')
    expect(masteryContext({ kind: 'recommended' }, 3)).toBe('mixta')
  })

  test('topic and personalizada are focused practice', () => {
    for (const kind of ['topic', 'personalizada'] as const) {
      expect(masteryContext({ kind }, 5)).toBe('practica')
    }
    expect(masteryContext({ kind: 'personalizada', practiceSource: 'no_vistas' }, 2)).toBe('practica')
  })

  test('items whose key the student already saw are a repaso, whatever the mode', () => {
    expect(masteryContext({ kind: 'repaso' }, 5)).toBe('repaso')
    expect(masteryContext({ kind: 'repaso', feedbackMode: 'inmediata' }, 5)).toBe('repaso')
    expect(masteryContext({ kind: 'personalizada', practiceSource: 'falladas' }, 2)).toBe('repaso')
    expect(masteryContext({ kind: 'personalizada', practiceSource: 'marcadas' }, 2)).toBe('repaso')
  })

  test('the mastery challenge has its own rule', () => {
    expect(masteryContext({ kind: 'reto' }, 3)).toBe('reto')
  })

  test('seeing each answer right away makes any session practice, never an assessment', () => {
    expect(masteryContext({ kind: 'recommended', feedbackMode: 'inmediata' }, 4)).toBe('practica')
  })
})

describe('nextMasteryLevel in a repaso', () => {
  test('a perfect retry of seen keys is memory, not skill: the level stays', () => {
    expect(nextMasteryLevel('intentado', evidence(5, 5), 'repaso')).toBe('intentado')
    expect(nextMasteryLevel('sin_empezar', evidence(4, 4), 'repaso')).toBe('sin_empezar')
  })

  test('nor does it lower one', () => {
    expect(nextMasteryLevel('competente', evidence(0, 5), 'repaso')).toBe('competente')
  })
})

describe('nextMasteryLevel in focused practice', () => {
  test('under 70% is intentado', () => {
    expect(nextMasteryLevel('sin_empezar', evidence(2, 4), 'practica')).toBe('intentado')
  })

  test('70-99% is familiar', () => {
    expect(nextMasteryLevel('sin_empezar', evidence(3, 4), 'practica')).toBe('familiar')
    expect(nextMasteryLevel('intentado', evidence(7, 10), 'practica')).toBe('familiar')
  })

  test('a perfect practice of 4 or more questions jumps straight to competente', () => {
    expect(nextMasteryLevel('sin_empezar', evidence(4, 4), 'practica')).toBe('competente')
    expect(nextMasteryLevel('intentado', evidence(5, 5), 'practica')).toBe('competente')
  })

  test('a perfect practice of fewer than 4 questions is only familiar', () => {
    expect(nextMasteryLevel('sin_empezar', evidence(3, 3), 'practica')).toBe('familiar')
  })

  test('blanks count as misses', () => {
    expect(nextMasteryLevel('sin_empezar', evidence(3, 5, 3), 'practica')).toBe('intentado')
  })

  test('practice caps at competente: dominado needs a mixed session', () => {
    expect(nextMasteryLevel('competente', evidence(10, 10), 'practica')).toBe('competente')
  })

  test('practice never demotes', () => {
    expect(nextMasteryLevel('dominado', evidence(0, 5), 'practica')).toBe('dominado')
    expect(nextMasteryLevel('familiar', evidence(1, 5), 'practica')).toBe('familiar')
  })

  test('nothing answered is no evidence', () => {
    expect(nextMasteryLevel('sin_empezar', evidence(0, 4, 0), 'practica')).toBe('sin_empezar')
  })
})

describe('nextMasteryLevel in mixed sessions', () => {
  test('all right promotes one level, up to dominado', () => {
    expect(nextMasteryLevel('familiar', evidence(2, 2), 'mixta')).toBe('competente')
    expect(nextMasteryLevel('competente', evidence(1, 1), 'mixta')).toBe('dominado')
    expect(nextMasteryLevel('dominado', evidence(3, 3), 'mixta')).toBe('dominado')
  })

  test('all right from below familiar lands on familiar', () => {
    expect(nextMasteryLevel('sin_empezar', evidence(2, 2), 'mixta')).toBe('familiar')
    expect(nextMasteryLevel('intentado', evidence(1, 1), 'mixta')).toBe('familiar')
  })

  test('any miss demotes one level', () => {
    expect(nextMasteryLevel('dominado', evidence(4, 5), 'mixta')).toBe('competente')
    expect(nextMasteryLevel('competente', evidence(0, 1), 'mixta')).toBe('familiar')
    expect(nextMasteryLevel('familiar', evidence(1, 2), 'mixta')).toBe('intentado')
    expect(nextMasteryLevel('intentado', evidence(0, 2), 'mixta')).toBe('intentado')
    expect(nextMasteryLevel('sin_empezar', evidence(1, 2), 'mixta')).toBe('intentado')
  })

  test('a blank in an exam is a miss', () => {
    expect(nextMasteryLevel('competente', evidence(1, 2, 1), 'mixta')).toBe('familiar')
  })

  test('nothing answered is no evidence', () => {
    expect(nextMasteryLevel('dominado', evidence(0, 3, 0), 'mixta')).toBe('dominado')
  })
})

describe('nextMasteryLevel in the mastery challenge', () => {
  test('both right levels up', () => {
    expect(nextMasteryLevel('competente', evidence(2, 2), 'reto')).toBe('dominado')
    expect(nextMasteryLevel('familiar', evidence(2, 2), 'reto')).toBe('competente')
  })

  test('both wrong levels down', () => {
    expect(nextMasteryLevel('competente', evidence(0, 2), 'reto')).toBe('familiar')
    expect(nextMasteryLevel('dominado', evidence(0, 2, 1), 'reto')).toBe('competente')
  })

  test('one of each stays', () => {
    expect(nextMasteryLevel('competente', evidence(1, 2), 'reto')).toBe('competente')
  })
})

describe('masteryLevelOf', () => {
  test('the stored level wins', () => {
    expect(masteryLevelOf({ masteryLevel: 'dominado', attemptCount: 1, correctCount: 0 })).toBe('dominado')
  })

  test('aggregates from before levels existed fall back to their accuracy, never above familiar', () => {
    expect(masteryLevelOf({ attemptCount: 0, correctCount: 0 })).toBe('sin_empezar')
    expect(masteryLevelOf({ attemptCount: 10, correctCount: 6 })).toBe('intentado')
    expect(masteryLevelOf({ attemptCount: 10, correctCount: 10 })).toBe('familiar')
  })
})

describe('summarizeMastery', () => {
  test('points are 0/0/50/80/100 per subtopic', () => {
    expect(MASTERY_LEVELS.map((level) => MASTERY_POINTS[level])).toEqual([0, 0, 50, 80, 100])
  })

  test('the percentage counts every subtopic of the course, practiced or not', () => {
    const levels: MasteryLevel[] = ['familiar', 'competente', 'dominado']
    expect(summarizeMastery(levels, 5)).toEqual({
      points: 230,
      maxPoints: 500,
      percent: 46,
      competenteOrAbove: 2,
      subtopicCount: 5,
    })
  })

  test('an empty course is 0%', () => {
    expect(summarizeMastery([], 0).percent).toBe(0)
  })
})

describe('orderRetoCandidates', () => {
  const row = (subtopicId: string, masteryLevel: MasteryLevel, masteryUpdatedAt?: number) => ({
    subtopicId,
    masteryLevel,
    masteryUpdatedAt,
    attemptCount: 4,
    correctCount: 2,
  })

  test('only practiced subtopics; familiar and competente first, the longest unreviewed first', () => {
    const ordered = orderRetoCandidates([
      row('nuevo', 'sin_empezar'),
      row('dom', 'dominado', 1),
      row('comp-reciente', 'competente', 300),
      row('fam-viejo', 'familiar', 100),
      row('int', 'intentado', 50),
      row('comp-viejo', 'competente', 200),
    ])
    expect(ordered.map((item) => item.subtopicId)).toEqual([
      'fam-viejo',
      'comp-viejo',
      'comp-reciente',
      'dom',
      'int',
    ])
  })
})

describe('interleaveBlocks', () => {
  test('alternates subtopics so the challenge is mixed', () => {
    const blocks = [
      [{ id: 'a1' }, { id: 'a2' }],
      [{ id: 'b1' }, { id: 'b2' }],
      [{ id: 'c1' }, { id: 'c2' }],
    ]
    expect(interleaveBlocks(blocks).map((item) => item.id)).toEqual(['a1', 'b1', 'c1', 'a2', 'b2', 'c2'])
  })

  test('a shared-text pair stays together', () => {
    const blocks = [
      [{ id: 'a1', groupId: 'g' }, { id: 'a2', groupId: 'g' }],
      [{ id: 'b1' }, { id: 'b2' }],
    ]
    expect(interleaveBlocks(blocks).map((item) => item.id)).toEqual(['a1', 'a2', 'b1', 'b2'])
  })
})

describe('revealedQuestionIds', () => {
  const sessions = [
    { _id: 's-now', status: 'in_progress' },
    { _id: 's-done', status: 'completed' },
    { _id: 's-open', status: 'in_progress' },
    { _id: 's-left', status: 'abandoned' },
  ]

  test('a question of a completed session had its key shown in the review', () => {
    expect(revealedQuestionIds([{ questionId: 'q1', sessionId: 's-done' }], sessions, 's-now')).toEqual(new Set(['q1']))
  })

  test('a question checked in an open immediate-feedback practice had its key shown', () => {
    expect(revealedQuestionIds([{ questionId: 'q1', sessionId: 's-open', checkedAt: 5 }], sessions, 's-now'))
      .toEqual(new Set(['q1']))
  })

  test('an open, unchecked or abandoned sitting showed nothing', () => {
    expect(revealedQuestionIds(
      [{ questionId: 'q1', sessionId: 's-open' }, { questionId: 'q2', sessionId: 's-left' }],
      sessions,
      's-now',
    )).toEqual(new Set())
  })

  test('the session being scored does not reveal its own questions', () => {
    const scored = [{ _id: 's-now', status: 'completed' }]
    expect(revealedQuestionIds([{ questionId: 'q1', sessionId: 's-now', checkedAt: 5 }], scored, 's-now'))
      .toEqual(new Set())
  })
})
