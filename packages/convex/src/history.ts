import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { query } from './_generated/server'
import { assertOwnsStudent } from './auth'
import { colombiaDayNumber, colombiaDayStartMs } from './colombiaTime'
import { sessionKindValidator } from './validators'

/**
 * Study history: what the student did, and — just as important — which days they
 * did nothing. Everything here is derived from `sessions` and `questionAttempts`;
 * there is no history table.
 *
 * Days are bucketed in Colombia time via `colombiaTime.ts`, the same helper the
 * streak on "Hoy" and the weekly progress trend use, so all three agree on where
 * a day starts.
 */

const DEFAULT_CALENDAR_WEEKS = 16

interface DayBucket {
  attemptCount: number
  correctCount: number
}

/**
 * Calendar heatmap + lifetime totals in a single pass.
 *
 * Deliberately one query rather than the two it reads like: both halves need a
 * full scan of the student's attempts, and splitting them would double that
 * scan for no benefit.
 *
 * V1 scale note: `.collect()` over one student's attempts is fine while a
 * student stays well under a few thousand attempts. If that stops holding, the
 * fix is a denormalized per-day counter, not a wider scan — the same threshold
 * already documented in `syllabus.ts`.
 */
export const getActivitySummary = query({
  args: {
    studentId: v.id('students'),
    weeks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const attempts = await ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()

    const byDay = new Map<number, DayBucket>()
    let totalAnswered = 0
    let totalCorrect = 0
    let totalResponseTimeMs = 0

    for (const attempt of attempts) {
      if (attempt.answeredAt == null || attempt.isCorrect == null) continue

      totalAnswered += 1
      if (attempt.isCorrect) totalCorrect += 1
      totalResponseTimeMs += attempt.responseTimeMs ?? 0

      const day = colombiaDayNumber(attempt.answeredAt)
      const bucket = byDay.get(day) ?? { attemptCount: 0, correctCount: 0 }
      bucket.attemptCount += 1
      if (attempt.isCorrect) bucket.correctCount += 1
      byDay.set(day, bucket)
    }

    const today = colombiaDayNumber(Date.now())
    const weeks = args.weeks ?? DEFAULT_CALENDAR_WEEKS
    // Start the grid on a week boundary so the heatmap renders as full columns.
    const firstDay = today - (weeks * 7 - 1)

    const days = []
    for (let day = firstDay; day <= today; day += 1) {
      const bucket = byDay.get(day)
      days.push({
        dayNumber: day,
        startMs: colombiaDayStartMs(day),
        attemptCount: bucket?.attemptCount ?? 0,
        correctCount: bucket?.correctCount ?? 0,
      })
    }

    return {
      days,
      todayDayNumber: today,
      stats: {
        totalAnswered,
        totalCorrect,
        accuracy: totalAnswered === 0 ? null : totalCorrect / totalAnswered,
        activeDayCount: byDay.size,
        currentStreakDays: currentStreak(byDay, today),
        longestStreakDays: longestStreak(byDay),
        totalStudyTimeMs: totalResponseTimeMs,
        firstActivityMs:
          byDay.size === 0 ? null : colombiaDayStartMs(Math.min(...byDay.keys())),
      },
    }
  },
})

/**
 * Current run of consecutive active days. Anchored on today *or* yesterday so a
 * streak isn't reported as broken before the day is over — same rule as the
 * streak card on "Hoy" (`today.ts`).
 */
function currentStreak(byDay: Map<number, DayBucket>, today: number): number {
  const anchor = byDay.has(today) ? today : byDay.has(today - 1) ? today - 1 : null
  if (anchor == null) return 0

  let streak = 0
  let cursor = anchor
  while (byDay.has(cursor)) {
    streak += 1
    cursor -= 1
  }
  return streak
}

function longestStreak(byDay: Map<number, DayBucket>): number {
  const sorted = [...byDay.keys()].sort((a, b) => a - b)
  let longest = 0
  let run = 0
  let previous: number | null = null

  for (const day of sorted) {
    run = previous != null && day === previous + 1 ? run + 1 : 1
    if (run > longest) longest = run
    previous = day
  }

  return longest
}

/**
 * Paginated session history.
 *
 * Unlike `sessions.listSessions` — which powers the short "recent practice" list
 * on the hub and deliberately hides the diagnostic — this is the full record:
 * every kind, including `diagnostic`, `nivelacion` and `simulacro`. It paginates
 * rather than collecting because history only ever grows.
 */
export const listHistory = query({
  args: {
    studentId: v.id('students'),
    kind: v.optional(sessionKindValidator),
    subjectId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    let sessionQuery = ctx.db
      .query('sessions')
      .withIndex('by_studentId_startedAt', (q) => q.eq('studentId', args.studentId))
      .order('desc')

    // Filtering before paginating keeps pages full; the index still bounds the
    // scan to this student.
    if (args.kind != null) {
      const kind = args.kind
      sessionQuery = sessionQuery.filter((q) => q.eq(q.field('kind'), kind))
    }
    if (args.subjectId != null) {
      const subjectId = args.subjectId
      sessionQuery = sessionQuery.filter((q) => q.eq(q.field('subjectId'), subjectId))
    }

    return sessionQuery.paginate(args.paginationOpts)
  },
})
