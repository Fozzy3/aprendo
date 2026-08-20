import { mutation, query, type QueryCtx } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { assertOwnsStudent, requireAuthenticatedStudentId } from './auth'
import { MAX_GLOBAL_SCORE } from './globalScore'

export const getStudent = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)
    return ctx.db.get(args.studentId)
  },
})

/**
 * Set (or clear) the exam date.
 *
 * Stored as the ms timestamp the client sends for local noon on the chosen day.
 * Noon rather than midnight so that the Colombia-day bucketing in `examPlan.ts`
 * lands on the intended day regardless of how the client built the timestamp —
 * a midnight value is one DST-less hour away from tipping into the day before.
 */
export const setExamDate = mutation({
  args: {
    studentId: v.id('students'),
    examDate: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    if (args.examDate != null && !Number.isFinite(args.examDate)) {
      throw new ConvexError('Fecha de examen inválida.')
    }

    await ctx.db.patch(args.studentId, {
      examDate: args.examDate ?? undefined,
      updatedAt: Date.now(),
    })
    return { examDate: args.examDate }
  },
})

/** Set (or clear) the global score the student is aiming for. */
export const setTargetGlobalScore = mutation({
  args: {
    studentId: v.id('students'),
    targetGlobalScore: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    if (
      args.targetGlobalScore != null
      && (!Number.isFinite(args.targetGlobalScore)
        || args.targetGlobalScore < 0
        || args.targetGlobalScore > MAX_GLOBAL_SCORE)
    ) {
      throw new ConvexError(`La meta debe estar entre 0 y ${MAX_GLOBAL_SCORE}.`)
    }

    await ctx.db.patch(args.studentId, {
      targetGlobalScore:
        args.targetGlobalScore == null ? undefined : Math.round(args.targetGlobalScore),
      updatedAt: Date.now(),
    })
    return { targetGlobalScore: args.targetGlobalScore }
  },
})

export const getStudentAppState = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)
    return computeStudentAppState(ctx, args.studentId)
  },
})

export const getCurrentStudentAppState = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await ctx.auth.getUserIdentity()
    if (!authUser) return null
    const studentId = await requireAuthenticatedStudentId(ctx)
    return computeStudentAppState(ctx, studentId)
  },
})

/**
 * The entry gate.
 *
 * Placement is now done one area at a time (`nivelacion`) instead of a single
 * 20-question `diagnostic`, so **the first completed nivelación unlocks the
 * app** and the remaining areas show up as pending work on "Hoy" and Progreso.
 *
 * The legacy `diagnostic` kind still counts as placement: students who
 * completed one before this change must keep getting in without redoing
 * anything. It is simply no longer the only way through, and is no longer
 * launchable from the hub.
 */
async function computeStudentAppState(ctx: QueryCtx, studentId: Id<'students'>) {
  const student = await ctx.db.get(studentId)
  if (student == null) {
    return null
  }

  const [diagnosticSessions, nivelacionSessions] = await Promise.all([
    ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind', (q) =>
        q.eq('studentId', studentId).eq('kind', 'diagnostic'),
      )
      .collect(),
    ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind', (q) =>
        q.eq('studentId', studentId).eq('kind', 'nivelacion'),
      )
      .collect(),
  ])

  const placementSessions = [...diagnosticSessions, ...nivelacionSessions]

  const activePlacement = placementSessions.find(
    (session) => session.status === 'in_progress' || session.status === 'created',
  ) ?? null

  const completedPlacements = placementSessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))

  const latestCompletedPlacement = completedPlacements[0] ?? null

  const placedSubjectIds = [
    ...new Set(
      nivelacionSessions
        .filter((session) => session.status === 'completed')
        .map((session) => session.subjectId)
        .filter((subjectId): subjectId is string => subjectId != null),
    ),
  ]

  const hasPlacement = latestCompletedPlacement != null

  return {
    studentId: student._id,
    hasCompletedDiagnostic: hasPlacement,
    /** Areas the student has actually levelled, for the placement screen. */
    placedSubjectIds,
    activeDiagnosticSessionId: activePlacement?._id ?? null,
    latestCompletedDiagnosticId: latestCompletedPlacement?._id ?? null,
    defaultRoute: hasPlacement ? '/today' as const : '/diagnostic' as const,
  }
}
