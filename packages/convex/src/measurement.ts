import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requirePlatformAdmin } from './auth'
import { colombiaDayNumber, colombiaWeekIndex, colombiaWeekStartMs } from './colombiaTime'

/**
 * F61: did the gamification help, and who did it leave behind. "Si el cuartil
 * inferior baja, se desactiva": the weekly league is switched off class by class
 * from what this reads.
 */

type CompletedSession = { studentId: string; completedAt: number }

/** Colombia days each student completed a session on. */
function activeDays(rows: CompletedSession[]) {
  const days = new Map<string, Set<number>>()
  for (const row of rows) {
    const set = days.get(row.studentId) ?? new Set<number>()
    set.add(colombiaDayNumber(row.completedAt))
    days.set(row.studentId, set)
  }
  return days
}

/** Students back exactly `daysLater` Colombia days after their first completed session. */
export function dayReturn(rows: CompletedSession[], now: number, daysLater: number) {
  const today = colombiaDayNumber(now)
  let eligible = 0
  let returned = 0
  for (const set of activeDays(rows).values()) {
    const target = Math.min(...set) + daysLater
    if (target > today) continue
    eligible += 1
    if (set.has(target)) returned += 1
  }
  return { eligible, returned, rate: eligible === 0 ? null : returned / eligible }
}

export const day7Return = (rows: CompletedSession[], now: number) => dayReturn(rows, now, 7)

const PLACEMENT_KINDS = new Set(['diagnostic', 'nivelacion'])

export type PilotStep = 'signedUp' | 'consented' | 'onboarded' | 'diagnosed' | 'practiced' | 'active2Days' | 'active7Days'

/**
 * The pilot funnel. Each step counts the students who reached it, independently
 * of the steps before, so an account from before onboarding existed still shows.
 * Rows of anyone outside `students` (staff) are ignored.
 */
export function pilotFunnel(
  input: {
    students: { studentId: string; consentAt?: number }[]
    onboardedIds: string[]
    completed: (CompletedSession & { kind: string })[]
    remindersSent: number
    emailClicks: number
  },
  now: number,
) {
  const ids = new Set(input.students.map((student) => student.studentId))
  const completed = input.completed.filter((row) => ids.has(row.studentId))
  const studentsWith = (rows: { studentId: string }[]) => new Set(rows.map((row) => row.studentId)).size
  const days = [...activeDays(completed).values()].map((set) => set.size)
  const counts: Record<PilotStep, number> = {
    signedUp: ids.size,
    consented: input.students.filter((student) => student.consentAt != null).length,
    onboarded: new Set(input.onboardedIds.filter((id) => ids.has(id))).size,
    diagnosed: studentsWith(completed.filter((row) => row.kind === 'diagnostic')),
    practiced: studentsWith(completed.filter((row) => !PLACEMENT_KINDS.has(row.kind))),
    active2Days: days.filter((count) => count >= 2).length,
    active7Days: days.filter((count) => count >= 7).length,
  }
  return {
    steps: (Object.keys(counts) as PilotStep[]).map((key) => ({ key, count: counts[key] })),
    d1Return: dayReturn(completed, now, 1),
    d7Return: dayReturn(completed, now, 7),
    reminders: { sent: input.remindersSent, clicked: input.emailClicks },
  }
}

/** Completed sessions and active students per Colombia week, oldest first. */
export function weeklySessions(rows: CompletedSession[], now: number, weeks: number) {
  const thisWeek = colombiaWeekIndex(now)
  return Array.from({ length: weeks }, (_, index) => {
    const weekIndex = thisWeek - (weeks - 1 - index)
    const inWeek = rows.filter((row) => colombiaWeekIndex(row.completedAt) === weekIndex)
    const activeStudents = new Set(inWeek.map((row) => row.studentId)).size
    return {
      weekStartMs: colombiaWeekStartMs(weekIndex),
      sessions: inWeek.length,
      activeStudents,
      sessionsPerActiveStudent: activeStudents === 0 ? 0 : inWeek.length / activeStudents,
    }
  })
}

/** The mean of the least active quarter (at least one student). Null for an empty class. */
export function bottomQuartileMean(values: number[]): number | null {
  if (values.length === 0) return null
  const quarter = [...values].sort((a, b) => a - b).slice(0, Math.max(1, Math.ceil(values.length / 4)))
  return quarter.reduce((sum, value) => sum + value, 0) / quarter.length
}

const WEEKS_SHOWN = 8
const BOTTOM_QUARTILE_WINDOW_WEEKS = 4

export const getEngagementMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)
    // ponytail: scans every session. Fine for the pilot's volume; past Convex's
    // per-query read limit, keep a per-student weekly row instead.
    const completed = (await ctx.db.query('sessions').collect()).flatMap((session) =>
      session.status === 'completed' && session.completedAt != null
        ? [{ studentId: session.studentId as string, completedAt: session.completedAt }]
        : [])
    const now = Date.now()
    const weekMs = 7 * 86_400_000

    /** Sessions per week per class member, in one of the last two windows. */
    const perWeek = (studentIds: string[], windowsAgo: number) => {
      const end = now - windowsAgo * BOTTOM_QUARTILE_WINDOW_WEEKS * weekMs
      const start = end - BOTTOM_QUARTILE_WINDOW_WEEKS * weekMs
      return studentIds.map((studentId) =>
        completed.filter((row) => row.studentId === studentId && row.completedAt > start && row.completedAt <= end).length
        / BOTTOM_QUARTILE_WINDOW_WEEKS)
    }

    const classes = await Promise.all((await ctx.db.query('classGroups').collect()).map(async (classGroup) => {
      const [members, organization] = await Promise.all([
        ctx.db.query('classGroupMembers').withIndex('by_classGroupId_role', (q) => q.eq('classGroupId', classGroup._id).eq('role', 'student')).collect(),
        ctx.db.get('organizations', classGroup.orgId),
      ])
      const studentIds = members.map((member) => member.accountId as string)
      return {
        classGroupId: classGroup._id,
        name: classGroup.name,
        organizationName: organization?.name ?? '',
        schoolLeagueEnabled: organization?.leagueEnabled === true,
        classLeagueOff: classGroup.leagueOff === true,
        studentCount: members.length,
        bottomQuartile: {
          recent: bottomQuartileMean(perWeek(studentIds, 0)),
          previous: bottomQuartileMean(perWeek(studentIds, 1)),
        },
      }
    }))

    return {
      day7Return: day7Return(completed, now),
      weeklySessions: weeklySessions(completed, now, WEEKS_SHOWN),
      classes,
    }
  },
})

export const getPilotFunnel = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)
    // ponytail: scans every student, session and funnel event. Fine for a pilot of
    // a few hundred students; past Convex's per-query read limit, keep counters.
    const [students, sessions, onboarded, remindersSent, emailClicks] = await Promise.all([
      ctx.db.query('students').collect(),
      ctx.db.query('sessions').collect(),
      ctx.db.query('events').withIndex('by_name_at', (q) => q.eq('name', 'onboarding_done')).collect(),
      ctx.db.query('events').withIndex('by_name_at', (q) => q.eq('name', 'reminder_sent')).collect(),
      ctx.db.query('events').withIndex('by_name_at', (q) => q.eq('name', 'email_click')).collect(),
    ])
    return pilotFunnel({
      students: students.flatMap((student) =>
        student.isAdmin === true ? [] : [{ studentId: student._id as string, consentAt: student.consentAt }]),
      onboardedIds: onboarded.map((event) => event.studentId as string),
      completed: sessions.flatMap((session) =>
        session.status === 'completed' && session.completedAt != null
          ? [{ studentId: session.studentId as string, kind: session.kind, completedAt: session.completedAt }]
          : []),
      remindersSent: remindersSent.length,
      emailClicks: emailClicks.length,
    }, Date.now())
  },
})

/** The school signed the minors' data addendum (G2): off by default, on only from here. */
export const setSchoolLeague = mutation({
  args: { orgId: v.id('organizations'), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    await ctx.db.patch('organizations', args.orgId, { leagueEnabled: args.enabled })
    return { enabled: args.enabled }
  },
})

/** Takes one class off the league, whatever the school chose (F61). */
export const setClassLeagueOff = mutation({
  args: { classGroupId: v.id('classGroups'), off: v.boolean() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    await ctx.db.patch('classGroups', args.classGroupId, { leagueOff: args.off })
    return { off: args.off }
  },
})
