import { query } from './_generated/server'
import { v } from 'convex/values'
import { assertOwnsStudent } from './auth'
import { colombiaDayNumber } from './colombiaTime'
import { buildExamPlan, observedSessionsPerWeek } from './examPlan'

/**
 * "Hoy" dashboard signals derived from raw attempts. The streak and weekly
 * activity are read-only derivations — no new stored state. Days are bucketed in
 * Colombia time (see `colombiaTime.ts`).
 */
const WEEKLY_GOAL = 5

export const getTodayDashboard = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const attempts = await ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()

    const activeDays = new Set<number>()
    let firstActivityAt: number | null = null
    for (const attempt of attempts) {
      if (attempt.answeredAt == null || attempt.isCorrect == null) continue
      activeDays.add(colombiaDayNumber(attempt.answeredAt))
      if (firstActivityAt == null || attempt.answeredAt < firstActivityAt) {
        firstActivityAt = attempt.answeredAt
      }
    }

    const today = colombiaDayNumber(Date.now())

    // A streak is unbroken if today or yesterday has activity; count back from
    // whichever the most recent active anchor is.
    let streakDays = 0
    const anchor = activeDays.has(today)
      ? today
      : activeDays.has(today - 1)
        ? today - 1
        : null
    if (anchor != null) {
      let cursor = anchor
      while (activeDays.has(cursor)) {
        streakDays += 1
        cursor -= 1
      }
    }

    let activeDaysThisWeek = 0
    for (let offset = 0; offset < 7; offset += 1) {
      if (activeDays.has(today - offset)) activeDaysThisWeek += 1
    }

    const student = await ctx.db.get(args.studentId)
    const now = Date.now()

    return {
      streakDays,
      practicedToday: activeDays.has(today),
      activeDaysThisWeek,
      weeklyGoal: WEEKLY_GOAL,
      examDate: student?.examDate ?? null,
      // Null until the student sets a date — the countdown is opt-in, and the
      // UI prompts for it rather than assuming one.
      examPlan:
        student?.examDate == null
          ? null
          : buildExamPlan({
              examDateMs: student.examDate,
              nowMs: now,
              sessionsPerWeek: observedSessionsPerWeek({
                activeDayCount: activeDays.size,
                firstActivityMs: firstActivityAt,
                nowMs: now,
              }),
            }),
    }
  },
})
