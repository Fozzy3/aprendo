import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import { setupTest, signUp } from './signIn'

const now = 1_700_000_000_000

type Test = ReturnType<typeof setupTest>
type Account = Awaited<ReturnType<typeof signUp>>

function appState(account: Account) {
  return account.as.query(api.students.getStudentAppState, { studentId: account.studentId })
}

async function joinSchool(t: Test, account: Account, role: 'student' | 'teacher' | 'org_admin') {
  await t.run(async (ctx) => {
    const orgId = await ctx.db.insert('organizations', {
      name: 'Colegio', plan: 'school', seatLimit: 10, licenseEndsAt: now, createdAt: now,
    })
    await ctx.db.insert('memberships', { orgId, accountId: account.studentId, role, createdAt: now })
  })
}

describe('where each role lands, and which sides it can open', () => {
  test('a platform admin goes to /admin, even when teaching too', async () => {
    const t = setupTest()
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    await joinSchool(t, admin, 'teacher')
    const state = await appState(admin)
    expect(state?.defaultRoute).toBe('/admin')
    expect(state?.defaultSearch).toBeUndefined()
    expect(state?.isStaff).toBe(true)
    expect(state?.roles).toEqual(['admin', 'teacher'])
  })

  test('a reviewer goes to the audit tab', async () => {
    const t = setupTest()
    const reviewer = await signUp(t, 'revisora@x.co')
    await t.run((ctx) => ctx.db.patch('students', reviewer.studentId, { reviewerSubjects: ['matematicas'] }))
    const state = await appState(reviewer)
    expect(state?.defaultRoute).toBe('/admin')
    expect(state?.defaultSearch).toEqual({ tab: 'audit' })
    expect(state?.isStaff).toBe(true)
    expect(state?.roles).toEqual(['reviewer'])
  })

  test('a teacher who is also a student of a school has both sides', async () => {
    const t = setupTest()
    const profe = await signUp(t, 'profe@x.co')
    await joinSchool(t, profe, 'org_admin')
    await joinSchool(t, profe, 'student')
    const state = await appState(profe)
    expect(state?.defaultRoute).toBe('/teacher')
    expect(state?.roles).toEqual(['teacher', 'student'])
  })

  test('an empty reviewer list is not a role, and a plain student has only their side', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    await t.run((ctx) => ctx.db.patch('students', ana.studentId, { reviewerSubjects: [] }))
    const state = await appState(ana)
    expect(state?.isStaff).toBe(false)
    expect(state?.roles).toEqual(['student'])
    expect(state?.defaultRoute).toBe('/diagnostic')
  })
})
