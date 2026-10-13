import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id, TableNames } from './_generated/dataModel'
import { assertIsStudent } from './auth'
import { MAX_GLOBAL_SCORE } from './globalScore'
import { MAX_WEEKLY_GOAL_MINUTES, MIN_WEEKLY_GOAL_MINUTES, isValidWeeklyGoal } from './studyTime'

export const getStudent = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)
    return ctx.db.get("students", args.studentId)
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
    await assertIsStudent(ctx, args.studentId)

    if (args.examDate != null && !Number.isFinite(args.examDate)) {
      throw new ConvexError('Fecha de examen inválida.')
    }

    await ctx.db.patch("students", args.studentId, {
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
    await assertIsStudent(ctx, args.studentId)

    if (
      args.targetGlobalScore != null
      && (!Number.isFinite(args.targetGlobalScore)
        || args.targetGlobalScore < 0
        || args.targetGlobalScore > MAX_GLOBAL_SCORE)
    ) {
      throw new ConvexError(`La meta debe estar entre 0 y ${MAX_GLOBAL_SCORE}.`)
    }

    await ctx.db.patch("students", args.studentId, {
      targetGlobalScore:
        args.targetGlobalScore == null ? undefined : Math.round(args.targetGlobalScore),
      updatedAt: Date.now(),
    })
    return { targetGlobalScore: args.targetGlobalScore }
  },
})

/** Set the study minutes the student aims for each week ("Hoy" shows progress against it). */
export const setWeeklyGoal = mutation({
  args: {
    studentId: v.id('students'),
    minutes: v.number(),
  },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)

    if (!isValidWeeklyGoal(args.minutes)) {
      throw new ConvexError(
        `La meta semanal debe estar entre ${MIN_WEEKLY_GOAL_MINUTES} y ${MAX_WEEKLY_GOAL_MINUTES} minutos.`,
      )
    }

    const weeklyGoalMinutes = Math.round(args.minutes)
    await ctx.db.patch('students', args.studentId, { weeklyGoalMinutes, updatedAt: Date.now() })
    return { weeklyGoalMinutes }
  },
})

export const getStudentAppState = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)
    return computeStudentAppState(ctx, args.studentId)
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
  const student = await ctx.db.get("students", studentId)
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

  const hasPlacement = [...diagnosticSessions, ...nivelacionSessions].some(
    (session) => session.status === 'completed',
  )

  // Teachers and school admins land on their panel; they never sit placement.
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_accountId', (q) => q.eq('accountId', studentId))
    .collect()
  const isStaff = memberships.some((membership) => membership.role !== 'student')

  const placedSubjectIds = [
    ...new Set(
      nivelacionSessions
        .filter((session) => session.status === 'completed')
        .map((session) => session.subjectId)
        .filter((subjectId): subjectId is string => subjectId != null),
    ),
  ]

  return {
    studentId: student._id,
    hasPlacement,
    /** Areas the student has actually levelled, for the placement screen. */
    placedSubjectIds,
    isStaff,
    defaultRoute: isStaff
      ? '/teacher' as const
      : hasPlacement ? '/today' as const : '/diagnostic' as const,
  }
}

/**
 * Erase everything a student produced, and their place in any school (Ley 1581:
 * the account holder can ask for it, and most are minors). The shared bank and its anonymous tallies
 * (`questionAnswerStats`, question Elo) stay. The tutor's chat history lives in
 * the agent component and is removed by the caller.
 *
 * ponytail: one transaction; if a student ever outgrows Convex's per-mutation
 * write limit, batch per table through the scheduler.
 */
export async function deleteStudentData(ctx: MutationCtx, studentId: Id<'students'>) {
  const sessions = await ctx.db
    .query('sessions')
    .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
    .collect()
  for (const session of sessions) {
    const [sessionQuestions, artifacts] = await Promise.all([
      ctx.db.query('sessionQuestions').withIndex('by_sessionId', (q) => q.eq('sessionId', session._id)).collect(),
      ctx.db
        .query('practiceTutorArtifacts')
        .withIndex('by_practiceSessionId', (q) => q.eq('practiceSessionId', session._id))
        .collect(),
    ])
    for (const row of sessionQuestions) await ctx.db.delete('sessionQuestions', row._id)
    for (const row of artifacts) await ctx.db.delete('practiceTutorArtifacts', row._id)
    await ctx.db.delete('sessions', session._id)
  }

  const remove = async <T extends TableNames>(table: T, rows: Doc<T>[]) => {
    for (const row of rows) await ctx.db.delete(table, row._id)
  }
  await remove('questionAttempts', await ctx.db.query('questionAttempts').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect())
  await remove('learnerSubjectAggregates', await ctx.db.query('learnerSubjectAggregates').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect())
  await remove('learnerSubtopicAggregates', await ctx.db.query('learnerSubtopicAggregates').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect())
  await remove('learnerProfileSnapshots', await ctx.db.query('learnerProfileSnapshots').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect())
  await remove('coachSummaries', await ctx.db.query('coachSummaries').withIndex('by_studentId_weekIndex', (q) => q.eq('studentId', studentId)).collect())
  await remove('practiceTutorThreads', await ctx.db.query('practiceTutorThreads').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect())
  await remove('llmUsage', await ctx.db.query('llmUsage').withIndex('by_studentId_day_feature', (q) => q.eq('studentId', studentId)).collect())
  await remove('questionReports', await ctx.db.query('questionReports').withIndex('by_studentId_createdAt', (q) => q.eq('studentId', studentId)).collect())
  await remove('memberships', await ctx.db.query('memberships').withIndex('by_accountId', (q) => q.eq('accountId', studentId)).collect())
  await remove('classGroupMembers', await ctx.db.query('classGroupMembers').withIndex('by_accountId', (q) => q.eq('accountId', studentId)).collect())

  if ((await ctx.db.get('students', studentId)) != null) await ctx.db.delete('students', studentId)
}
