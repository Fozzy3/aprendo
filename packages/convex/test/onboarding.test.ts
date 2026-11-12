import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import { setupTest, signUp } from './signIn'

describe('onboarding', () => {
  test('a new student is not onboarded until completeOnboarding', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const before = await ana.as.query(api.students.getStudentAppState, { studentId: ana.studentId })
    expect(before?.onboarded).toBe(false)

    await ana.as.mutation(api.students.completeOnboarding, { studentId: ana.studentId })

    const student = await t.run((ctx) => ctx.db.get('students', ana.studentId))
    expect(typeof student?.onboardedAt).toBe('number')
    const after = await ana.as.query(api.students.getStudentAppState, { studentId: ana.studentId })
    expect(after?.onboarded).toBe(true)
  })

  test('the daily goal takes 5, 10, 15 or 20 questions and nothing else', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')

    await ana.as.mutation(api.students.setDailyGoal, { studentId: ana.studentId, questions: 15 })
    expect((await t.run((ctx) => ctx.db.get('students', ana.studentId)))?.dailyGoalQuestions).toBe(15)

    await expect(ana.as.mutation(api.students.setDailyGoal, { studentId: ana.studentId, questions: 7 })).rejects.toThrow()
    await expect(ana.as.mutation(api.students.setDailyGoal, { studentId: ana.studentId, questions: 0 })).rejects.toThrow()
  })

  test('reminders turn off and back on', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')

    await ana.as.mutation(api.students.setReminders, { studentId: ana.studentId, off: true })
    expect((await t.run((ctx) => ctx.db.get('students', ana.studentId)))?.remindersOff).toBe(true)

    await ana.as.mutation(api.students.setReminders, { studentId: ana.studentId, off: false })
    expect((await t.run((ctx) => ctx.db.get('students', ana.studentId)))?.remindersOff).toBe(false)
  })

  test('nobody sets another student’s goal, reminders or onboarding', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const luis = await signUp(t, 'luis@x.co')
    const studentId = ana.studentId
    await expect(luis.as.mutation(api.students.setDailyGoal, { studentId, questions: 10 })).rejects.toThrow()
    await expect(luis.as.mutation(api.students.setReminders, { studentId, off: true })).rejects.toThrow()
    await expect(luis.as.mutation(api.students.completeOnboarding, { studentId })).rejects.toThrow()
  })
})
