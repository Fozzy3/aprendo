import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import { INACTIVE_DAYS, riskReasonsFor } from '../src/teacher'
import { setupTest, signUp } from './signIn'

const DAY = 86_400_000

async function schoolWithClass(seatLimit = 40, licenseEndsAt = Date.now() + 365 * DAY) {
  const t = setupTest()
  const platform = await signUp(t, 'equipo@aprendo.co', { isAdmin: true })
  const rector = await signUp(t, 'rector@colegio.co')
  const profe = await signUp(t, 'profe@colegio.co')
  const orgId = await platform.as.mutation(api.schools.createOrganization, {
    name: 'Colegio San José', plan: 'school', seatLimit, licenseEndsAt, adminEmail: 'rector@colegio.co',
  })
  await rector.as.mutation(api.schools.addTeacher, { orgId, email: 'profe@colegio.co' })
  const classGroupId = await rector.as.mutation(api.schools.createClassGroup, { orgId, name: '11A', grade: '11' })
  await rector.as.mutation(api.schools.assignTeacher, { classGroupId, accountId: profe.studentId })
  const admin = await rector.as.query(api.schools.getSchoolAdmin, { orgId })
  const inviteCode = admin.classGroups[0]!.inviteCode
  return { t, platform, rector, profe, orgId, classGroupId, inviteCode }
}

describe('organizations', () => {
  test('only the Aprendo team creates a school', async () => {
    const t = setupTest()
    const rector = await signUp(t, 'rector@colegio.co')
    await expect(
      rector.as.mutation(api.schools.createOrganization, {
        name: 'X', plan: 'school', seatLimit: 10, licenseEndsAt: Date.now() + DAY, adminEmail: 'rector@colegio.co',
      }),
    ).rejects.toThrow()
  })

  test('the school admin account must exist first', async () => {
    const t = setupTest()
    const platform = await signUp(t, 'equipo@aprendo.co', { isAdmin: true })
    await expect(
      platform.as.mutation(api.schools.createOrganization, {
        name: 'X', plan: 'school', seatLimit: 10, licenseEndsAt: Date.now() + DAY, adminEmail: 'nadie@x.co',
      }),
    ).rejects.toThrow(/no existe/)
  })

  test('a teacher cannot manage the school', async () => {
    const { profe, orgId } = await schoolWithClass()
    await expect(profe.as.mutation(api.schools.createClassGroup, { orgId, name: '11B', grade: '11' })).rejects.toThrow()
    await expect(profe.as.query(api.schools.getSchoolAdmin, { orgId })).rejects.toThrow()
  })
})

describe('joining a class', () => {
  test('a student joins with the invite code and sees the school', async () => {
    const { t, inviteCode } = await schoolWithClass()
    const ana = await signUp(t, 'ana@x.co')
    await ana.as.mutation(api.schools.joinClassGroup, { inviteCode: ` ${inviteCode.toLowerCase()} ` })
    await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
    const schools = await ana.as.query(api.schools.getMySchools, {})
    expect(schools).toHaveLength(1)
    expect(schools[0]).toMatchObject({ name: 'Colegio San José', role: 'student', licenseActive: true })
    expect(schools[0]!.classGroups.map((group) => group.name)).toEqual(['11A'])
  })

  test('a wrong code is refused', async () => {
    const { t } = await schoolWithClass()
    const ana = await signUp(t, 'ana@x.co')
    await expect(ana.as.mutation(api.schools.joinClassGroup, { inviteCode: 'NOEXISTE' })).rejects.toThrow(/código/)
  })

  test('an expired license is refused', async () => {
    const { t, inviteCode } = await schoolWithClass(40, Date.now() - DAY)
    const ana = await signUp(t, 'ana@x.co')
    await expect(ana.as.mutation(api.schools.joinClassGroup, { inviteCode })).rejects.toThrow(/licencia/)
  })

  test('a full school is refused, and removing a student frees the seat', async () => {
    const { t, rector, orgId, inviteCode } = await schoolWithClass(1)
    const ana = await signUp(t, 'ana@x.co')
    const beto = await signUp(t, 'beto@x.co')
    await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
    await expect(beto.as.mutation(api.schools.joinClassGroup, { inviteCode })).rejects.toThrow(/cupos/)

    const admin = await rector.as.query(api.schools.getSchoolAdmin, { orgId })
    expect(admin.seatsUsed).toBe(1)
    const anaMembership = admin.members.find((member) => member.email === 'ana@x.co')!
    await rector.as.mutation(api.schools.removeMember, { membershipId: anaMembership.membershipId })
    await beto.as.mutation(api.schools.joinClassGroup, { inviteCode })
    expect((await ana.as.query(api.schools.getMySchools, {}))).toHaveLength(0)
  })
})

describe('teachers see their school, never act for a student', () => {
  test('a teacher reads the progress of a student of the school', async () => {
    const { t, profe, inviteCode } = await schoolWithClass()
    const ana = await signUp(t, 'ana@x.co')
    await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
    const progress = await profe.as.query(api.progress.getStudentProgress, { studentId: ana.studentId })
    expect(progress.subjectLevels.length).toBeGreaterThan(0)
    expect(progress.account).toEqual({ name: null, email: 'ana@x.co' })
  })

  test('a teacher cannot write for the student', async () => {
    const { t, profe, inviteCode } = await schoolWithClass()
    const ana = await signUp(t, 'ana@x.co')
    await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
    await expect(
      profe.as.mutation(api.students.setWeeklyGoal, { studentId: ana.studentId, minutes: 120 }),
    ).rejects.toThrow()
  })

  test('a teacher of another school sees nothing', async () => {
    const { t, platform, inviteCode } = await schoolWithClass()
    const otroRector = await signUp(t, 'rector@otro.co')
    await platform.as.mutation(api.schools.createOrganization, {
      name: 'Otro', plan: 'school', seatLimit: 10, licenseEndsAt: Date.now() + DAY, adminEmail: 'rector@otro.co',
    })
    const ana = await signUp(t, 'ana@x.co')
    await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
    await expect(otroRector.as.query(api.progress.getStudentProgress, { studentId: ana.studentId })).rejects.toThrow()
  })

  test('the class overview lists students and flags the ones without placement', async () => {
    const { t, profe, classGroupId, inviteCode } = await schoolWithClass()
    const ana = await signUp(t, 'ana@x.co')
    await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
    const overview = await profe.as.query(api.teacher.getClassOverview, { classGroupId })
    expect(overview.classGroup.name).toBe('11A')
    expect(overview.students).toHaveLength(1)
    expect(overview.students[0]).toMatchObject({ email: 'ana@x.co', hasPlacement: false })
    expect(overview.students[0]!.riskReasons).toContain('sin_nivelacion')

    const outsider = await signUp(t, 'beto@x.co')
    await expect(outsider.as.query(api.teacher.getClassOverview, { classGroupId })).rejects.toThrow()
  })

  test('a teacher lists only the classes assigned to them; the school admin lists all', async () => {
    const { profe, rector, orgId } = await schoolWithClass()
    await rector.as.mutation(api.schools.createClassGroup, { orgId, name: '11B', grade: '11' })
    expect((await profe.as.query(api.teacher.listMyClassGroups, {})).map((group) => group.name)).toEqual(['11A'])
    expect((await rector.as.query(api.teacher.listMyClassGroups, {})).map((group) => group.name).sort()).toEqual(['11A', '11B'])
  })
})

describe('riskReasonsFor', () => {
  const now = 100 * 86_400_000
  const levelled = (levelIndex: number | null, hasEnoughEvidence = true) => ({ levelIndex, hasEnoughEvidence })

  test('a placed, active student at a decent level needs nothing', () => {
    expect(riskReasonsFor({ hasPlacement: true, lastActiveAt: now, subjects: [levelled(3)] }, now)).toEqual([])
  })

  test('flags missing placement, inactivity and the lowest level', () => {
    expect(riskReasonsFor({ hasPlacement: false, lastActiveAt: null, subjects: [levelled(1)] }, now))
      .toEqual(['sin_nivelacion', 'inactivo', 'nivel_bajo'])
    expect(riskReasonsFor({ hasPlacement: true, lastActiveAt: now - (INACTIVE_DAYS + 1) * 86_400_000, subjects: [] }, now))
      .toEqual(['inactivo'])
  })

  test('never claims a low level without evidence', () => {
    expect(riskReasonsFor({ hasPlacement: true, lastActiveAt: now, subjects: [levelled(1, false)] }, now)).toEqual([])
  })
})

describe('where an account lands after signing in', () => {
  test('a teacher goes to the teacher panel, a new student to placement', async () => {
    const { t, profe, inviteCode } = await schoolWithClass()
    const ana = await signUp(t, 'ana@x.co')
    await ana.as.mutation(api.schools.joinClassGroup, { inviteCode })
    expect((await profe.as.query(api.students.getStudentAppState, { studentId: profe.studentId }))?.defaultRoute).toBe('/teacher')
    expect((await ana.as.query(api.students.getStudentAppState, { studentId: ana.studentId }))?.defaultRoute).toBe('/diagnostic')
  })

  test('a teacher sees the class invite code to share it', async () => {
    const { profe, classGroupId, inviteCode } = await schoolWithClass()
    expect((await profe.as.query(api.teacher.getClassOverview, { classGroupId })).classGroup.inviteCode).toBe(inviteCode)
  })
})

describe('Aprendo staff name another school admin', () => {
  test('promotes an existing account, and nobody else can', async () => {
    const { t, platform, rector, orgId } = await schoolWithClass()
    const nueva = await signUp(t, 'coordinadora@colegio.co')
    await expect(rector.as.mutation(api.schools.addOrgAdmin, { orgId, email: 'coordinadora@colegio.co' })).rejects.toThrow()
    await platform.as.mutation(api.schools.addOrgAdmin, { orgId, email: 'coordinadora@colegio.co' })
    const schools = await nueva.as.query(api.schools.getMySchools, {})
    expect(schools[0]?.role).toBe('org_admin')
  })
})
