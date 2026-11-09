import { listMessages } from '@convex-dev/agent'
import { ConvexError, v } from 'convex/values'
import { components } from './_generated/api'
import { query } from './_generated/server'
import { assertIsStudent } from './auth'
import { canRevealSessionQuestion, sealAttempt, sealSessionResults } from './sessionIntegrity'
import { loadLiveExamQuestionIds } from './sessions'

/**
 * "Descargar mis datos" (Cuenta): every row keyed by the student, the same list
 * `deleteStudentData` erases, for the access `/privacidad` promises. Only the
 * student: `assertIsStudent` turns away the teachers `assertCanViewStudent`
 * would let in. A live exam's grades stay sealed here too, or the download
 * would hand over the key.
 *
 * ponytail: one query; if a student ever outgrows Convex's read limit, page it.
 */
export const exportMyData = query({
  args: { studentId: v.id('students') },
  handler: async (ctx, { studentId }) => {
    await assertIsStudent(ctx, studentId)

    const account = await ctx.db.get('students', studentId)
    if (account == null) throw new ConvexError('No encontramos tu cuenta.')

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
      .collect()
    const sessionById = new Map(sessions.map((session) => [session._id, session]))
    const [sessionQuestions, practiceTutorArtifacts] = await Promise.all([
      Promise.all(
        sessions.map((session) =>
          ctx.db.query('sessionQuestions').withIndex('by_sessionId', (q) => q.eq('sessionId', session._id)).collect()),
      ),
      Promise.all(
        sessions.map((session) =>
          ctx.db.query('practiceTutorArtifacts').withIndex('by_practiceSessionId', (q) => q.eq('practiceSessionId', session._id)).collect()),
      ),
    ])

    const now = Date.now()
    const liveExamQuestionIds = await loadLiveExamQuestionIds(ctx, studentId)

    const [
      attempts,
      learnerSubjectAggregates,
      learnerSubtopicAggregates,
      learnerProfileSnapshots,
      coachSummaries,
      tutorThreads,
      llmUsage,
      questionReports,
      memberships,
      classGroupMembers,
      duelAnswers,
    ] = await Promise.all([
      ctx.db.query('questionAttempts').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect(),
      ctx.db.query('learnerSubjectAggregates').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect(),
      ctx.db.query('learnerSubtopicAggregates').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect(),
      ctx.db.query('learnerProfileSnapshots').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect(),
      ctx.db.query('coachSummaries').withIndex('by_studentId_weekIndex', (q) => q.eq('studentId', studentId)).collect(),
      ctx.db.query('practiceTutorThreads').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect(),
      ctx.db.query('llmUsage').withIndex('by_studentId_day_feature', (q) => q.eq('studentId', studentId)).collect(),
      ctx.db.query('questionReports').withIndex('by_studentId_createdAt', (q) => q.eq('studentId', studentId)).collect(),
      ctx.db.query('memberships').withIndex('by_accountId', (q) => q.eq('accountId', studentId)).collect(),
      ctx.db.query('classGroupMembers').withIndex('by_accountId', (q) => q.eq('accountId', studentId)).collect(),
      ctx.db.query('duelAnswers').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).collect(),
    ])

    const questionAttempts = attempts.map((attempt) => {
      const session = sessionById.get(attempt.sessionId)
      return session != null && canRevealSessionQuestion(session, attempt, attempt.questionId, liveExamQuestionIds)
        ? attempt
        : sealAttempt(attempt)
    })

    // The tutor's chats live in the agent component, keyed by these threads.
    const practiceTutorThreads = await Promise.all(
      tutorThreads.map(async (thread) => {
        // An earlier reply can name the key of an item a live exam asks.
        if (thread.questionId != null && liveExamQuestionIds.has(thread.questionId)) return { ...thread, messages: [] }
        const { page } = await listMessages(ctx, components.agent, {
          threadId: thread.threadId,
          paginationOpts: { cursor: null, numItems: 500 },
        })
        return {
          ...thread,
          messages: page.map((message) => ({
            role: message.message?.role ?? null,
            text: message.text ?? null,
            createdAt: message._creationTime,
          })),
        }
      }),
    )

    return {
      exportedAt: now,
      account,
      sessions: sessions.map((session) => sealSessionResults(session, now)),
      sessionQuestions: sessionQuestions.flat(),
      questionAttempts,
      learnerSubjectAggregates,
      learnerSubtopicAggregates,
      learnerProfileSnapshots,
      coachSummaries,
      practiceTutorThreads,
      practiceTutorArtifacts: practiceTutorArtifacts.flat(),
      llmUsage,
      questionReports,
      memberships,
      classGroupMembers,
      duelAnswers,
    }
  },
})
