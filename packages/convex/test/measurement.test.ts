import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import { bottomQuartileMean, day7Return, weeklySessions } from '../src/measurement'
import { colombiaWeekIndex, colombiaWeekStartMs } from '../src/colombiaTime'
import { setupTest, signUp } from './signIn'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 21, 17)

describe('day7Return', () => {
  const session = (studentId: string, daysAfter: number) => ({ studentId, completedAt: NOW - 20 * DAY + daysAfter * DAY })

  test('counts a student who is back exactly 7 days after their first session', () => {
    const rows = [session('a', 0), session('a', 7), session('b', 0), session('b', 3)]
    expect(day7Return(rows, NOW)).toEqual({ eligible: 2, returned: 1, rate: 0.5 })
  })

  test('a student whose first session is under 7 days old is not in the denominator', () => {
    const rows = [{ studentId: 'new', completedAt: NOW - 2 * DAY }]
    expect(day7Return(rows, NOW)).toEqual({ eligible: 0, returned: 0, rate: null })
  })
})

describe('weeklySessions', () => {
  test('counts completed sessions and active students per Colombia week, oldest first', () => {
    const thisWeek = colombiaWeekIndex(NOW)
    const rows = [
      { studentId: 'a', completedAt: NOW - 1000 },
      { studentId: 'a', completedAt: NOW - 2000 },
      { studentId: 'b', completedAt: NOW - 3000 },
      { studentId: 'b', completedAt: NOW - 14 * DAY },
    ]
    const weeks = weeklySessions(rows, NOW, 3)
    expect(weeks.map((week) => week.weekStartMs)).toEqual([thisWeek - 2, thisWeek - 1, thisWeek].map(colombiaWeekStartMs))
    expect(weeks.at(-1)).toMatchObject({ sessions: 3, activeStudents: 2, sessionsPerActiveStudent: 1.5 })
    expect(weeks[0]).toMatchObject({ sessions: 1, activeStudents: 1 })
  })
})

describe('bottomQuartileMean', () => {
  test('is the mean of the least active quarter, at least one student', () => {
    expect(bottomQuartileMean([0, 2, 4, 6, 8, 10, 12, 14])).toBe(1)
    expect(bottomQuartileMean([3, 9])).toBe(3)
    expect(bottomQuartileMean([])).toBeNull()
  })
})

describe('admin measurement', () => {
  async function seed(t: ReturnType<typeof setupTest>) {
    const admin = await signUp(t, 'admin@x.co', { isAdmin: true })
    const student = await signUp(t, 'ana@x.co')
    const now = Date.now()
    const { orgId, classGroupId } = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert('organizations', { name: 'Colegio', plan: 'school', seatLimit: 10, licenseEndsAt: now + DAY, createdAt: 1 })
      const classGroupId = await ctx.db.insert('classGroups', { orgId, name: '11A', grade: '11', inviteCode: 'X', createdAt: 1 })
      await ctx.db.insert('classGroupMembers', { classGroupId, orgId, accountId: student.studentId, role: 'student', joinedAt: 1 })
      await ctx.db.insert('sessions', {
        studentId: student.studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual',
        startedAt: now - 8 * DAY, completedAt: now - 8 * DAY, questionCount: 1, currentPosition: 1,
      })
      await ctx.db.insert('sessions', {
        studentId: student.studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual',
        startedAt: now - DAY, completedAt: now - DAY, questionCount: 1, currentPosition: 1,
      })
      await ctx.db.insert('sessions', {
        studentId: student.studentId, kind: 'topic', status: 'in_progress', recommendationSource: 'manual',
        startedAt: now, questionCount: 1, currentPosition: 1,
      })
      return { orgId, classGroupId }
    })
    return { admin, student, orgId, classGroupId }
  }

  test('only a platform admin reads the metrics', async () => {
    const t = setupTest()
    const { admin, student } = await seed(t)
    await expect(student.as.query(api.measurement.getEngagementMetrics, {})).rejects.toThrow()
    const report = await admin.as.query(api.measurement.getEngagementMetrics, {})
    expect(report.day7Return).toEqual({ eligible: 1, returned: 1, rate: 1 })
    // Yesterday's session lands in last week when today is a Monday.
    expect(report.weeklySessions.slice(-2).reduce((sum, week) => sum + week.sessions, 0)).toBeGreaterThan(0)
    expect(report.classes).toHaveLength(1)
    expect(report.classes[0]).toMatchObject({ name: '11A', organizationName: 'Colegio', schoolLeagueEnabled: false, classLeagueOff: false, studentCount: 1 })
    expect(report.classes[0]!.bottomQuartile.recent).toBeGreaterThan(0)
  })

  test('the toggles are admin-only, per school and per class', async () => {
    const t = setupTest()
    const { admin, student, orgId, classGroupId } = await seed(t)
    await expect(student.as.mutation(api.measurement.setSchoolLeague, { orgId, enabled: true })).rejects.toThrow()
    await expect(student.as.mutation(api.measurement.setClassLeagueOff, { classGroupId, off: true })).rejects.toThrow()

    await admin.as.mutation(api.measurement.setSchoolLeague, { orgId, enabled: true })
    await admin.as.mutation(api.measurement.setClassLeagueOff, { classGroupId, off: true })
    const report = await admin.as.query(api.measurement.getEngagementMetrics, {})
    expect(report.classes[0]).toMatchObject({ schoolLeagueEnabled: true, classLeagueOff: true })
  })
})
