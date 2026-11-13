import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertIsStudent, requirePlatformAdmin } from './auth'
import { PILOT_SURVEY_QUESTIONS, summarizeSurvey, surveyAnswersError } from './pilotSurveyQuestions'
import { pilotSurveyAnswersValidator } from './validators'

/**
 * The pilot survey: once per student, read by staff in the pilot panel.
 * The questions and their rules live in `pilotSurveyQuestions.ts`.
 *
 * ponytail: `summary` and `listResponses` scan the table; fine for a pilot.
 */

export const submit = mutation({
  args: { studentId: v.id('students'), name: v.string(), studentCode: v.string(), answers: pilotSurveyAnswersValidator },
  handler: async (ctx, { studentId, answers, ...who }) => {
    await assertIsStudent(ctx, studentId)
    const name = who.name.trim()
    const studentCode = who.studentCode.trim()
    if (name === '' || studentCode === '' || name.length > 120 || studentCode.length > 40) {
      throw new ConvexError('Escribe tu nombre y tu código.')
    }
    const existing = await ctx.db.query('pilotSurveyResponses').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).first()
    if (existing != null) throw new ConvexError('Ya respondiste la encuesta.')
    // Free text is stored trimmed; everything else as given.
    const cleaned = Object.fromEntries(Object.entries(answers).map(([id, value]) => [
      id,
      typeof value === 'string' && PILOT_SURVEY_QUESTIONS.find((question) => question.id === id)?.kind === 'text' ? value.trim() : value,
    ]))
    const error = surveyAnswersError(cleaned)
    if (error != null) throw new ConvexError(error)
    await ctx.db.insert('pilotSurveyResponses', { studentId, name, studentCode, answers: cleaned, submittedAt: Date.now() })
  },
})

export const getMine = query({
  args: { studentId: v.id('students') },
  handler: async (ctx, { studentId }) => {
    await assertIsStudent(ctx, studentId)
    const response = await ctx.db.query('pilotSurveyResponses').withIndex('by_studentId', (q) => q.eq('studentId', studentId)).first()
    return response == null ? null : { submittedAt: response.submittedAt }
  },
})

export const summary = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)
    return summarizeSurvey(await ctx.db.query('pilotSurveyResponses').collect())
  },
})

/** Every response with the name and code the student typed: the CSV the pilot panel downloads. */
export const listResponses = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx)
    const rows = await ctx.db.query('pilotSurveyResponses').collect()
    return rows.map(({ answers, submittedAt, name, studentCode }) => ({ submittedAt, name, studentCode, answers }))
  },
})
