import { describe, expect, test } from 'bun:test'
import { pickSimulacroForm, scoreSimulacroSubjects } from '../src/simulacroForm'

type Q = { _id: string; groupId?: string; groupPosition?: number }

/** `count` standalone questions in booklet order: q0, q1, … */
function standalone(count: number, prefix = 'q'): Q[] {
  return Array.from({ length: count }, (_, index) => ({ _id: `${prefix}${index}` }))
}

/** A shared-stimulus group of `size` members. */
function group(groupId: string, size: number): Q[] {
  return Array.from({ length: size }, (_, index) => ({
    _id: `${groupId}-${index}`,
    groupId,
    groupPosition: index,
  }))
}

const ids = (questions: Q[]) => questions.map((question) => question._id)
const none = new Map<string, number>()
const nothing = new Set<string>()

describe('pickSimulacroForm', () => {
  test('never-seen questions come before seen ones', () => {
    const questions = standalone(6)
    const lastSeenAt = new Map([['q0', 100], ['q1', 100], ['q2', 100]])
    const form = pickSimulacroForm({ questions, limit: 3, seed: 's', lastSeenAt, exclude: nothing })
    expect(ids(form).sort()).toEqual(['q3', 'q4', 'q5'])
  })

  test('once the unseen run out, the least recently seen fill the form', () => {
    const questions = standalone(4)
    const lastSeenAt = new Map([['q0', 300], ['q1', 100], ['q2', 200]])
    const form = pickSimulacroForm({ questions, limit: 3, seed: 's', lastSeenAt, exclude: nothing })
    expect(ids(form).sort()).toEqual(['q1', 'q2', 'q3'])
  })

  test('excluded items never appear, even if the form comes out short', () => {
    const questions = standalone(5)
    const exclude = new Set(['q0', 'q1', 'q2'])
    const form = pickSimulacroForm({ questions, limit: 4, seed: 's', lastSeenAt: none, exclude })
    expect(ids(form).sort()).toEqual(['q3', 'q4'])
  })

  test('a group is taken whole, with its members adjacent and in order', () => {
    const questions = [...standalone(2), ...group('g', 3)]
    const form = pickSimulacroForm({ questions, limit: 5, seed: 's', lastSeenAt: none, exclude: nothing })
    expect(ids(form)).toEqual(['q0', 'q1', 'g-0', 'g-1', 'g-2'])
  })

  test('a group that does not fit is skipped, never split', () => {
    const questions = [...group('g', 4), ...standalone(3)]
    const form = pickSimulacroForm({ questions, limit: 3, seed: 's', lastSeenAt: none, exclude: nothing })
    expect(ids(form)).toEqual(['q0', 'q1', 'q2'])
  })

  test('a group with any excluded member is excluded whole', () => {
    const questions = [...group('g', 3), ...standalone(3)]
    const exclude = new Set(['g-1'])
    const form = pickSimulacroForm({ questions, limit: 6, seed: 's', lastSeenAt: none, exclude })
    expect(ids(form)).toEqual(['q0', 'q1', 'q2'])
  })

  test('a group counts as seen if any member was', () => {
    const questions = [...group('g', 2), ...standalone(2)]
    const lastSeenAt = new Map([['g-1', 100]])
    const form = pickSimulacroForm({ questions, limit: 2, seed: 's', lastSeenAt, exclude: nothing })
    expect(ids(form)).toEqual(['q0', 'q1'])
  })

  test('the form is presented in booklet order, not in pick order', () => {
    const questions = standalone(10)
    const lastSeenAt = new Map([['q0', 100], ['q1', 100]])
    const form = pickSimulacroForm({ questions, limit: 10, seed: 's', lastSeenAt, exclude: nothing })
    expect(ids(form)).toEqual(ids(questions))
  })

  test('the same seed always builds the same form', () => {
    const questions = standalone(40)
    const first = pickSimulacroForm({ questions, limit: 10, seed: 'student-a:1', lastSeenAt: none, exclude: nothing })
    const again = pickSimulacroForm({ questions, limit: 10, seed: 'student-a:1', lastSeenAt: none, exclude: nothing })
    expect(ids(again)).toEqual(ids(first))
  })

  test('two students, or two attempts, get different forms from the same bank', () => {
    const questions = standalone(40)
    const formFor = (seed: string) =>
      ids(pickSimulacroForm({ questions, limit: 10, seed, lastSeenAt: none, exclude: nothing }))
    expect(formFor('student-a:1')).not.toEqual(formFor('student-b:1'))
    expect(formFor('student-a:1')).not.toEqual(formFor('student-a:2'))
    // Not just the first N of the bank, which is what everyone used to get.
    expect(formFor('student-a:1')).not.toEqual(ids(questions.slice(0, 10)))
  })

  test('never returns more than the limit', () => {
    const questions = [...group('g', 3), ...standalone(20), ...group('h', 2)]
    const form = pickSimulacroForm({ questions, limit: 7, seed: 'x', lastSeenAt: none, exclude: nothing })
    expect(form.length).toBe(7)
    expect(new Set(ids(form)).size).toBe(7)
  })
})

describe('scoreSimulacroSubjects', () => {
  const targets = [
    { subjectId: 'matematicas', questionCount: 50 },
    { subjectId: 'ingles', questionCount: 55 },
  ]
  const score = (subjectId: string, correctCount: number, questionCount: number) => ({
    subjectId,
    correctCount,
    answeredCount: correctCount,
    questionCount,
  })

  test('a perfect exam scores 100 even when the bank served fewer than the official count', () => {
    const [math] = scoreSimulacroSubjects(targets, [
      [score('matematicas', 25, 25)],
      [score('matematicas', 19, 19)],
    ])
    expect(math).toEqual({
      subjectId: 'matematicas',
      correctCount: 44,
      answeredCount: 44,
      questionCount: 44,
      score: 100,
    })
  })

  test('adds up both sittings against what was served', () => {
    const [math] = scoreSimulacroSubjects(targets, [
      [score('matematicas', 20, 25)],
      [score('matematicas', 13, 19)],
    ])
    expect(math.correctCount).toBe(33)
    expect(math.questionCount).toBe(44)
    expect(math.score).toBe(Math.round((33 / 44) * 100))
  })

  test('an area never served falls back to the official count and scores 0', () => {
    const [, english] = scoreSimulacroSubjects(targets, [[score('matematicas', 25, 25)]])
    expect(english).toEqual({
      subjectId: 'ingles',
      correctCount: 0,
      answeredCount: 0,
      questionCount: 55,
      score: 0,
    })
  })

  test('reports every official area, in target order', () => {
    const scores = scoreSimulacroSubjects(targets, [])
    expect(scores.map((s) => s.subjectId)).toEqual(['matematicas', 'ingles'])
  })
})
