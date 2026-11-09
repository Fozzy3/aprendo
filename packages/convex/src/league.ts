import { v } from 'convex/values'
import { mutation, query, type QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { assertIsStudent } from './auth'
import { colombiaWeekIndex, colombiaWeekStartMs } from './colombiaTime'
import { earnedXp } from './rewards'

/**
 * The weekly class league (F59): effort only (XP), automatic, reset every
 * Monday in Colombia time. Built for minors (G2, G3): off until the school
 * signs up, shown only by nickname and avatar, never with student ids, never
 * to teachers, and the lower half sees how close the next classmate is instead
 * of its position.
 */

export const MIN_LEAGUE_PARTICIPANTS = 5
const NEIGHBOURS = 2
/** A student who has not picked a nickname: never their name or email. */
const ANONYMOUS_NICKNAME = 'Anónimo'

type LeagueRow = { id: string; xp: number; nickname: string; avatar: Doc<'students'>['avatar'] | null }

/**
 * The student and two classmates each way. In the lower half nobody carries a
 * rank and the window stops at the student: a row below is where the list ends (G3).
 */
export function leagueWindow(rows: LeagueRow[], youId: string) {
  const sorted = [...rows].sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id))
  const index = sorted.findIndex((row) => row.id === youId)
  const you = sorted[index]!
  const inUpperHalf = (position: number) => position + 1 <= sorted.length / 2
  const showsRank = inUpperHalf(index)
  const above = index === 0 ? null : sorted[index - 1]!
  return {
    you: {
      xp: you.xp,
      rank: showsRank ? index + 1 : null,
      gapToNext: above == null ? null : above.xp - you.xp,
    },
    entries: sorted
      .slice(Math.max(0, index - NEIGHBOURS), showsRank ? index + NEIGHBOURS + 1 : index + 1)
      .map((row) => ({
        nickname: row.nickname,
        avatar: row.avatar,
        isYou: row.id === youId,
        rank: showsRank && inUpperHalf(sorted.indexOf(row)) ? sorted.indexOf(row) + 1 : null,
        xpGap: row.xp - you.xp,
      })),
  }
}

/** The class the student's league runs in: the first one whose school is in the league and that has not left it. */
async function loadLeagueClass(ctx: QueryCtx, studentId: Id<'students'>) {
  const memberships = (await ctx.db
    .query('classGroupMembers')
    .withIndex('by_accountId', (q) => q.eq('accountId', studentId))
    .collect()).filter((row) => row.role === 'student')
  for (const membership of memberships) {
    const [classGroup, organization] = await Promise.all([
      ctx.db.get('classGroups', membership.classGroupId),
      ctx.db.get('organizations', membership.orgId),
    ])
    if (classGroup != null && organization?.leagueEnabled === true && classGroup.leagueOff !== true) return classGroup
  }
  return null
}

export const getClassLeague = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    // Only the student: a teacher never reads a league (G3).
    await assertIsStudent(ctx, args.studentId)

    const classGroup = await loadLeagueClass(ctx, args.studentId)
    if (classGroup == null) return { status: 'unavailable' as const }
    const student = await ctx.db.get('students', args.studentId)
    if (student?.leagueOptOut === true) return { status: 'opted_out' as const }

    const week = colombiaWeekIndex(Date.now())
    const weekStartMs = colombiaWeekStartMs(week)
    const members = await ctx.db
      .query('classGroupMembers')
      .withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', classGroup._id).eq('role', 'student'))
      .collect()
    const participants: LeagueRow[] = []
    // ponytail: a session per class member; a class is tens of students. Beyond that, a weekly counter.
    for (const member of members) {
      const account = await ctx.db.get('students', member.accountId)
      if (account == null || account.leagueOptOut === true) continue
      const sessions = await ctx.db
        .query('sessions')
        .withIndex('by_studentId_startedAt', (q) => q.eq('studentId', member.accountId).gte('startedAt', weekStartMs - 86_400_000))
        .collect()
      const xp = earnedXp(sessions, (completedAt) => colombiaWeekIndex(completedAt) === week)
      if (xp > 0) {
        participants.push({ id: account._id, xp, nickname: account.nickname ?? ANONYMOUS_NICKNAME, avatar: account.avatar ?? null })
      }
    }

    if (participants.length < MIN_LEAGUE_PARTICIPANTS) return { status: 'unavailable' as const }
    if (!participants.some((row) => row.id === args.studentId)) return { status: 'no_xp_yet' as const }
    return {
      status: 'ok' as const,
      weekEndsAt: colombiaWeekStartMs(week + 1),
      ...leagueWindow(participants, args.studentId),
    }
  },
})

/** Leave or rejoin the league; takes effect at once. */
export const setLeagueOptOut = mutation({
  args: {
    studentId: v.id('students'),
    optOut: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)
    await ctx.db.patch('students', args.studentId, { leagueOptOut: args.optOut, updatedAt: Date.now() })
    return { optOut: args.optOut }
  },
})
