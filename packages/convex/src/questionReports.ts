/**
 * "Reportar un problema" (Khan): a student tells us a question is broken — a
 * wrong key, a confusing stem, an unreadable crop. The bank comes from OCR and
 * LLM enrichment, so the students who read every question are the cheapest
 * proofreaders it will ever have.
 *
 * Allowed during an exam: a report reveals nothing and asks for nothing back.
 */
import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { assertOwnsStudent, requireAdminStudentId, requireAuthenticatedStudentId } from './auth'
import { colombiaDayNumber, colombiaDayStartMs } from './colombiaTime'
import { questionReportReasonValidator, questionReportStatusValidator } from './validators'

export const MAX_REPORT_NOTE_CHARS = 500

/** Reports one student may file per Colombia day; editing an open one is free. */
export const DAILY_REPORT_LIMIT = 20

/** The note as stored: trimmed, absent when empty. Longer than the limit is refused. */
export function normalizeReportNote(note: string | undefined): string | undefined {
  const trimmed = note?.trim()
  if (!trimmed) return undefined
  if (trimmed.length > MAX_REPORT_NOTE_CHARS) {
    throw new ConvexError(`La nota admite hasta ${MAX_REPORT_NOTE_CHARS} caracteres.`)
  }
  return trimmed
}

export function hasReportBudget(reportsToday: number): boolean {
  return reportsToday < DAILY_REPORT_LIMIT
}

/**
 * Files a report, or updates the student's open report on the same question —
 * one open report per student and question, so a repeated tap is not spam.
 */
export const reportQuestionProblem = mutation({
  args: {
    questionId: v.id('questions'),
    sessionId: v.optional(v.id('sessions')),
    reason: questionReportReasonValidator,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const studentId = await requireAuthenticatedStudentId(ctx)
    const note = normalizeReportNote(args.note)
    if ((await ctx.db.get('questions', args.questionId)) == null) {
      throw new ConvexError('Pregunta no encontrada.')
    }
    if (args.sessionId != null) {
      const session = await ctx.db.get('sessions', args.sessionId)
      if (session == null) throw new ConvexError('Sesión no encontrada.')
      await assertOwnsStudent(ctx, session.studentId)
    }

    const open = (
      await ctx.db
        .query('questionReports')
        .withIndex('by_studentId_questionId', (q) =>
          q.eq('studentId', studentId).eq('questionId', args.questionId))
        .collect()
    ).find((report) => report.status === 'open')
    if (open != null) {
      await ctx.db.patch('questionReports', open._id, { reason: args.reason, note })
      return { reportId: open._id }
    }

    const now = Date.now()
    const today = await ctx.db
      .query('questionReports')
      .withIndex('by_studentId_createdAt', (q) =>
        q.eq('studentId', studentId).gte('createdAt', colombiaDayStartMs(colombiaDayNumber(now))))
      .collect()
    if (!hasReportBudget(today.length)) {
      throw new ConvexError('Ya enviaste muchos reportes hoy. Gracias; vuelve a intentarlo mañana.')
    }

    const reportId = await ctx.db.insert('questionReports', {
      questionId: args.questionId,
      studentId,
      sessionId: args.sessionId,
      reason: args.reason,
      note,
      status: 'open',
      createdAt: now,
    })
    return { reportId }
  },
})

/** Admin queue, newest first, with what is needed to find and fix the question. */
export const listQuestionReports = query({
  args: {
    status: v.optional(questionReportStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdminStudentId(ctx)
    const reports = await ctx.db
      .query('questionReports')
      .withIndex('by_status_createdAt', (q) => q.eq('status', args.status ?? 'open'))
      .order('desc')
      .take(200)
    return Promise.all(
      reports.map(async (report) => {
        const question = await ctx.db.get('questions', report.questionId)
        return {
          ...report,
          question:
            question == null
              ? null
              : {
                  _id: question._id,
                  pdfUploadId: question.pdfUploadId,
                  questionNumber: question.questionNumber,
                  subjectId: question.subjectId ?? null,
                  primarySubtopicId: question.primarySubtopicId ?? null,
                  bodyMarkdown: question.bodyMarkdown,
                  answerCorrectOption: question.answerCorrectOption ?? null,
                },
        }
      }),
    )
  },
})

export const resolveQuestionReport = mutation({
  args: {
    reportId: v.id('questionReports'),
  },
  handler: async (ctx, args) => {
    await requireAdminStudentId(ctx)
    const report = await ctx.db.get('questionReports', args.reportId)
    if (report == null) throw new ConvexError('Reporte no encontrado.')
    if (report.status !== 'resolved') {
      await ctx.db.patch('questionReports', report._id, { status: 'resolved', resolvedAt: Date.now() })
    }
    return { resolved: true }
  },
})
