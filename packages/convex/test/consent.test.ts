import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import { setupTest, signUp } from './signIn'

describe('recordConsent', () => {
  test('stores the age answer and when consent was given, and the app state reports it', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const before = await ana.as.query(api.students.getStudentAppState, { studentId: ana.studentId })
    expect(before?.hasConsent).toBe(false)

    await ana.as.mutation(api.students.recordConsent, { studentId: ana.studentId, isMinor: true })

    const student = await t.run((ctx) => ctx.db.get('students', ana.studentId))
    expect(student?.isMinor).toBe(true)
    expect(typeof student?.consentAt).toBe('number')
    const after = await ana.as.query(api.students.getStudentAppState, { studentId: ana.studentId })
    expect(after?.hasConsent).toBe(true)
  })

  test('nobody records consent for someone else', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const luis = await signUp(t, 'luis@x.co')
    await expect(
      luis.as.mutation(api.students.recordConsent, { studentId: ana.studentId, isMinor: false }),
    ).rejects.toThrow()
  })
})
