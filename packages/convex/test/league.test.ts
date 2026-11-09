import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { colombiaWeekStartMs, colombiaWeekIndex } from '../src/colombiaTime'
import { MIN_LEAGUE_PARTICIPANTS, leagueWindow } from '../src/league'
import { setupTest, signUp } from './signIn'

const row = (id: string, xp: number) => ({ id, xp, nickname: `Apodo ${id}`, avatar: null })

describe('leagueWindow', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, index) => row(id, 700 - index * 100))

  test('the upper half sees two neighbours each way', () => {
    const window = leagueWindow(rows, 'c')
    expect(window.entries.map((entry) => entry.nickname)).toEqual(['Apodo a', 'Apodo b', 'Apodo c', 'Apodo d', 'Apodo e'])
    expect(window.entries.find((entry) => entry.isYou)?.nickname).toBe('Apodo c')
  })

  test('at the top the window keeps the two below', () => {
    expect(leagueWindow(rows, 'a').entries.map((entry) => entry.nickname)).toEqual(['Apodo a', 'Apodo b', 'Apodo c'])
  })

  test('upper half sees ranks and a gap to the next one', () => {
    const { you, entries } = leagueWindow(rows, 'b')
    expect(you).toEqual({ xp: 600, rank: 2, gapToNext: 100 })
    expect(entries.find((entry) => entry.nickname === 'Apodo a')).toMatchObject({ rank: 1, xpGap: 100 })
    expect(entries.find((entry) => entry.isYou)).toMatchObject({ rank: 2, xpGap: 0 })
  })

  test('lower half sees gaps and never a rank (G3)', () => {
    const { you, entries } = leagueWindow(rows, 'f')
    expect(you).toEqual({ xp: 200, rank: null, gapToNext: 100 })
    expect(entries.every((entry) => entry.rank == null)).toBe(true)
    expect(entries.map((entry) => entry.xpGap)).toEqual([200, 100, 0])
  })

  test('the lower half sees only who is above: where the list ends stays hidden (G3)', () => {
    for (const id of ['d', 'e', 'f', 'g']) {
      const { entries } = leagueWindow(rows, id)
      expect(entries).toHaveLength(3)
      expect(entries.at(-1)?.isYou).toBe(true)
    }
  })

  test('an upper-half student never sees a lower-half classmate\'s rank (G3)', () => {
    const { you, entries } = leagueWindow(rows, 'c')
    expect(you.rank).toBe(3)
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3, null, null])
  })

  test('the leader has no next one to chase', () => {
    expect(leagueWindow(rows, 'a').you).toEqual({ xp: 700, rank: 1, gapToNext: null })
  })
})

const WEEK = colombiaWeekIndex(Date.now())
const thisMonday = colombiaWeekStartMs(WEEK)

async function setupClass(t: ReturnType<typeof setupTest>, xpBy: number[], opts: { leagueEnabled?: boolean; optOutIndex?: number } = {}) {
  const me = await signUp(t, 'me@x.co')
  const { classGroupId, orgId } = await t.run(async (ctx) => {
    const orgId = await ctx.db.insert('organizations', {
      name: 'c', plan: 'school', seatLimit: 50, licenseEndsAt: Date.now() + 1000, leagueEnabled: opts.leagueEnabled ?? true, createdAt: 1,
    })
    const classGroupId = await ctx.db.insert('classGroups', { orgId, name: '11A', grade: '11', inviteCode: 'X', createdAt: 1 })
    return { orgId, classGroupId }
  })
  const ids: Id<'students'>[] = []
  for (const [index, xp] of xpBy.entries()) {
    const studentId = index === 0
      ? me.studentId
      : await t.run((ctx) => ctx.db.insert('students', { email: `s${index}@x.co`, normalizedEmail: `s${index}@x.co`, createdAt: 1, updatedAt: 1, lastSeenAt: 1 }))
    ids.push(studentId)
    await t.run(async (ctx) => {
      await ctx.db.insert('classGroupMembers', { classGroupId, orgId, accountId: studentId, role: 'student', joinedAt: 1 })
      await ctx.db.patch('students', studentId, { nickname: `Apodo ${index}`, avatar: { skin: 'tono1', hair: 'corto', top: 'buso', accessory: 'ninguno' }, leagueOptOut: opts.optOutIndex === index ? true : undefined })
      if (xp > 0) {
        await ctx.db.insert('sessions', {
          studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual', startedAt: thisMonday + 3600_000, completedAt: thisMonday + 3600_000,
          questionCount: 1, currentPosition: 1, reward: { xp, medals: [], streakDays: 1 },
        })
      }
    })
  }
  return { ...me, ids, classGroupId, orgId }
}

describe('getClassLeague', () => {
  test('returns the window by nickname and avatar, with no student ids anywhere', async () => {
    const t = setupTest()
    const { studentId, as, ids } = await setupClass(t, [50, 100, 80, 60, 30, 20, 10])
    const league = await as.query(api.league.getClassLeague, { studentId })
    expect(league.status).toBe('ok')
    if (league.status !== 'ok') return
    expect('participantCount' in league).toBe(false)
    expect(league.entries.map((entry) => entry.nickname)).toEqual(['Apodo 2', 'Apodo 3', 'Apodo 0'])
    expect(league.entries[2]?.avatar).toMatchObject({ skin: 'tono1' })
    expect(league.you.xp).toBe(50)
    expect(league.weekEndsAt).toBe(colombiaWeekStartMs(WEEK + 1))
    const json = JSON.stringify(league)
    for (const id of ids) expect(json).not.toContain(id)
  })

  test('is off unless the school signed up (G2)', async () => {
    const t = setupTest()
    const { studentId, as } = await setupClass(t, [50, 100, 80, 60, 30], { leagueEnabled: false })
    expect(await as.query(api.league.getClassLeague, { studentId })).toEqual({ status: 'unavailable' })
  })

  test('a class that left the league is out even if the school is in', async () => {
    const t = setupTest()
    const { studentId, as, classGroupId } = await setupClass(t, [50, 100, 80, 60, 30])
    await t.run((ctx) => ctx.db.patch('classGroups', classGroupId, { leagueOff: true }))
    expect(await as.query(api.league.getClassLeague, { studentId })).toEqual({ status: 'unavailable' })
  })

  test('needs five participants with XP (G3)', async () => {
    const t = setupTest()
    const short = await setupClass(t, [50, 100, 80, 60, 0, 0])
    expect(await short.as.query(api.league.getClassLeague, { studentId: short.studentId })).toEqual({ status: 'unavailable' })
    expect(MIN_LEAGUE_PARTICIPANTS).toBe(5)
  })

  test('zero-XP and opted-out classmates are not listed; a student with no XP sees their state', async () => {
    const t = setupTest()
    const { studentId, as } = await setupClass(t, [50, 100, 80, 60, 40, 30, 0], { optOutIndex: 5 })
    const league = await as.query(api.league.getClassLeague, { studentId })
    expect(league.status).toBe('ok')
    expect(league.status === 'ok' && league.entries.map((entry) => entry.nickname)).toEqual(['Apodo 2', 'Apodo 3', 'Apodo 0'])

    const t2 = setupTest()
    const noXp = await setupClass(t2, [0, 100, 80, 60, 40, 30])
    expect(await noXp.as.query(api.league.getClassLeague, { studentId: noXp.studentId })).toEqual({ status: 'no_xp_yet' })
  })

  test('opting out takes the student off the board; opting back in returns them', async () => {
    const t = setupTest()
    const { studentId, as } = await setupClass(t, [50, 100, 80, 60, 30, 20])
    await as.mutation(api.league.setLeagueOptOut, { studentId, optOut: true })
    expect(await as.query(api.league.getClassLeague, { studentId })).toEqual({ status: 'opted_out' })
    await as.mutation(api.league.setLeagueOptOut, { studentId, optOut: false })
    expect((await as.query(api.league.getClassLeague, { studentId })).status).toBe('ok')
  })

  test('the week resets at Monday 00:00 Colombia time', async () => {
    const t = setupTest()
    const { studentId, as } = await setupClass(t, [50, 100, 80, 60, 30, 20])
    await t.run(async (ctx) => {
      await ctx.db.insert('sessions', {
        studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual', startedAt: thisMonday - 86_400_000, completedAt: thisMonday - 1,
        questionCount: 1, currentPosition: 1, reward: { xp: 1000, medals: [], streakDays: 1 },
      })
    })
    const league = await as.query(api.league.getClassLeague, { studentId })
    expect(league.status === 'ok' && league.you.xp).toBe(50)
  })

  test('a teacher cannot read it for a student', async () => {
    const t = setupTest()
    const { studentId, orgId } = await setupClass(t, [50, 100, 80, 60, 30, 20])
    const { as: teacher, studentId: teacherId } = await signUp(t, 'teacher@x.co')
    await t.run((ctx) => ctx.db.insert('memberships', { orgId, accountId: teacherId, role: 'teacher', createdAt: 1 }))
    await expect(teacher.query(api.league.getClassLeague, { studentId })).rejects.toThrow()
  })

  test('a student without a nickname shows as anonymous, never by name or email', async () => {
    const t = setupTest()
    const { studentId, as, ids } = await setupClass(t, [50, 100, 80, 60, 30, 20])
    await t.run(async (ctx) => {
      await ctx.db.patch('students', ids[1]!, { nickname: undefined, avatar: undefined, name: 'Ana Pérez' })
    })
    const league = await as.query(api.league.getClassLeague, { studentId })
    const json = JSON.stringify(league)
    expect(json).not.toContain('Ana Pérez')
    expect(json).not.toContain('@x.co')
  })
})
