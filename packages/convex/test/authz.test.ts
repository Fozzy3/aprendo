import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import { setupTest, signUp } from './signIn'

describe('a student only reaches their own data', () => {
  test('reads and writes their own account', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    expect((await as.query(api.students.getStudent, { studentId }))?.email).toBe('ana@x.co')
    await as.mutation(api.students.setWeeklyGoal, { studentId, minutes: 120 })
  })

  test('cannot read or write another student', async () => {
    const t = setupTest()
    const { as } = await signUp(t, 'ana@x.co')
    const { studentId: other } = await signUp(t, 'beto@x.co')
    await expect(as.query(api.students.getStudent, { studentId: other })).rejects.toThrow()
    await expect(as.mutation(api.students.setWeeklyGoal, { studentId: other, minutes: 120 })).rejects.toThrow()
  })

  test('signed-out callers are refused', async () => {
    const t = setupTest()
    const { studentId } = await signUp(t, 'ana@x.co')
    await expect(t.query(api.students.getStudent, { studentId })).rejects.toThrow()
  })
})
