import { describe, expect, test } from 'bun:test'
import { planBookletFinish } from '../src/booklets'

type Q = { _id: string; questionNumber: number; groupId?: string }
type G = { _id: string; contextKey: string }

const ids = (rows: Array<{ _id: string }>) => rows.map((row) => row._id)

describe('planBookletFinish', () => {
  // A number goes missing when the booklet changes, but also when the parser's
  // filters drop it. Deleting it orphaned every attempt and session question
  // that pointed at it, so the row is retired and keeps its id.
  test('a question missing from this run is retired, not dropped', () => {
    const questions: Q[] = [
      { _id: 'q1', questionNumber: 1 },
      { _id: 'q14', questionNumber: 14 },
    ]
    const plan = planBookletFinish(questions, [], new Set([1]), new Set())
    expect(ids(plan.kept)).toEqual(['q1'])
    expect(ids(plan.retired)).toEqual(['q14'])
  })

  test('a group gone from the booklet that no row references is deleted', () => {
    const groups: G[] = [{ _id: 'g-old', contextKey: 'old' }]
    const plan = planBookletFinish([{ _id: 'q1', questionNumber: 1 }], groups, new Set([1]), new Set())
    expect(ids(plan.orphanGroups)).toEqual(['g-old'])
  })

  // Review renders a question with its passage; dropping the group would show
  // a retired question's stem without the text it asks about.
  test('a gone group still referenced by a retired question is kept', () => {
    const questions: Q[] = [
      { _id: 'q1', questionNumber: 1 },
      { _id: 'q14', questionNumber: 14, groupId: 'g-old' },
    ]
    const groups: G[] = [{ _id: 'g-old', contextKey: 'old' }]
    const plan = planBookletFinish(questions, groups, new Set([1]), new Set())
    expect(plan.orphanGroups).toEqual([])
  })

  test('a group whose key is still in the booklet is never deleted', () => {
    const groups: G[] = [{ _id: 'g1', contextKey: 'k1' }]
    const plan = planBookletFinish([], groups, new Set(), new Set(['k1']))
    expect(plan.orphanGroups).toEqual([])
  })
})
