import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { Id } from './_generated/dataModel'
import { assertOwnsStudent } from './auth'
import { decideClaim } from './aiCache'
import { colombiaDayNumber, colombiaWeekIndex } from './colombiaTime'
import { getSubjectLabel } from './taxonomy'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const COACH_MODEL = 'deepseek/deepseek-v4-pro'
const PROMPT_VERSION = 'v1'

export const getWeeklyCoachSummary = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)
    const weekIndex = colombiaWeekIndex(Date.now())
    return ctx.db
      .query('coachSummaries')
      .withIndex('by_studentId_weekIndex', (q) =>
        q.eq('studentId', args.studentId).eq('weekIndex', weekIndex),
      )
      .unique()
  },
})

/**
 * Ensure this week's coach summary exists, generating on demand. Same atomic
 * claim + schedule pattern as concept lessons: the `generating` status
 * deduplicates concurrent requests for the same (student, week).
 */
export const requestWeeklyCoachSummary = mutation({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)
    const weekIndex = colombiaWeekIndex(Date.now())
    const existing = await ctx.db
      .query('coachSummaries')
      .withIndex('by_studentId_weekIndex', (q) =>
        q.eq('studentId', args.studentId).eq('weekIndex', weekIndex),
      )
      .unique()
    const now = Date.now()

    const schedule = async () => {
      await ctx.scheduler.runAfter(0, internal.coach.generateWeeklyCoachSummary, {
        studentId: args.studentId,
        weekIndex,
      })
    }

    const decision = decideClaim({ existing, promptVersion: PROMPT_VERSION, now })

    if (decision === 'create') {
      await ctx.db.insert('coachSummaries', {
        studentId: args.studentId,
        weekIndex,
        status: 'generating',
        modelId: COACH_MODEL,
        promptVersion: PROMPT_VERSION,
        createdAt: now,
        updatedAt: now,
      })
      await schedule()
      return { status: 'generating' as const }
    }

    if (decision === 'reclaim') {
      await ctx.db.patch(existing!._id, {
        status: 'generating',
        modelId: COACH_MODEL,
        promptVersion: PROMPT_VERSION,
        failureReason: undefined,
        updatedAt: now,
      })
      await schedule()
      return { status: 'generating' as const }
    }

    return { status: existing!.status }
  },
})

export const getWeeklyStats = internalQuery({
  args: {
    studentId: v.id('students'),
    weekIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const attempts = await ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()

    const weekAttempts = attempts.filter(
      (attempt) =>
        attempt.answeredAt != null
        && attempt.isCorrect != null
        && colombiaWeekIndex(attempt.answeredAt) === args.weekIndex,
    )

    const questionIds = [...new Set(weekAttempts.map((attempt) => attempt.questionId))]
    const questions = await Promise.all(questionIds.map((id) => ctx.db.get(id)))
    const subjectByQuestionId = new Map<Id<'questions'>, string>()
    for (const question of questions) {
      if (question?.subjectId != null) {
        subjectByQuestionId.set(question._id, question.subjectId)
      }
    }

    const buckets = new Map<string, { attempts: number; correct: number }>()
    const activeDays = new Set<number>()
    let correctCount = 0
    for (const attempt of weekAttempts) {
      if (attempt.answeredAt != null) activeDays.add(colombiaDayNumber(attempt.answeredAt))
      if (attempt.isCorrect === true) correctCount += 1
      const subjectId = subjectByQuestionId.get(attempt.questionId)
      if (subjectId == null) continue
      const bucket = buckets.get(subjectId) ?? { attempts: 0, correct: 0 }
      bucket.attempts += 1
      if (attempt.isCorrect === true) bucket.correct += 1
      buckets.set(subjectId, bucket)
    }

    const subjects = [...buckets.entries()]
      .map(([subjectId, bucket]) => ({
        subjectId,
        label: getSubjectLabel(subjectId),
        attempts: bucket.attempts,
        correct: bucket.correct,
        accuracy: bucket.attempts === 0 ? 0 : bucket.correct / bucket.attempts,
      }))
      .sort((a, b) => b.attempts - a.attempts)

    return {
      totalAttempts: weekAttempts.length,
      correctCount,
      activeDays: activeDays.size,
      subjects,
    }
  },
})

const COACH_SYSTEM = [
  'Eres un coach de estudio cálido y motivador para estudiantes que preparan el ICFES Saber 11 en Colombia.',
  'Escribes en español, en segunda persona (tú), en un tono cercano y alentador pero honesto.',
  'No exageras ni inventas cifras: usa solo los datos que se te dan.',
].join(' ')

export const generateWeeklyCoachSummary = internalAction({
  args: {
    studentId: v.id('students'),
    weekIndex: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const stats = await ctx.runQuery(internal.coach.getWeeklyStats, {
        studentId: args.studentId,
        weekIndex: args.weekIndex,
      })

      const subjectLines = stats.subjects
        .map(
          (subject) =>
            `- ${subject.label}: ${subject.correct}/${subject.attempts} correctas (${Math.round(subject.accuracy * 100)}%)`,
        )
        .join('\n')

      const prompt =
        stats.totalAttempts === 0
          ? 'Esta semana el estudiante no practicó ninguna pregunta. Escribe 2 frases breves, cálidas y sin culpa, que lo animen a retomar con una sesión corta hoy.'
          : [
              'Resumen de la actividad de esta semana del estudiante:',
              `- Preguntas respondidas: ${stats.totalAttempts} (${stats.correctCount} correctas)`,
              `- Días activos: ${stats.activeDays}`,
              'Desempeño por materia:',
              subjectLines,
              '',
              'Escribe un resumen de 2-4 frases: celebra un logro concreto de la semana, señala con tacto una materia para reforzar, y termina con una recomendación accionable para la próxima semana. Markdown simple, sin encabezados.',
            ].join('\n')

      const { text } = await generateText({
        model: openrouter(COACH_MODEL),
        system: COACH_SYSTEM,
        prompt,
        maxOutputTokens: 600,
      })

      await ctx.runMutation(internal.coach.markCoachSummaryReady, {
        studentId: args.studentId,
        weekIndex: args.weekIndex,
        body: text.trim(),
      })
    } catch (error) {
      await ctx.runMutation(internal.coach.markCoachSummaryFailed, {
        studentId: args.studentId,
        weekIndex: args.weekIndex,
        failureReason: error instanceof Error ? error.message : 'Error de generación.',
      })
    }
  },
})

export const markCoachSummaryReady = internalMutation({
  args: {
    studentId: v.id('students'),
    weekIndex: v.number(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query('coachSummaries')
      .withIndex('by_studentId_weekIndex', (q) =>
        q.eq('studentId', args.studentId).eq('weekIndex', args.weekIndex),
      )
      .unique()
    if (summary == null) return
    const now = Date.now()
    await ctx.db.patch(summary._id, {
      status: 'ready',
      body: args.body,
      failureReason: undefined,
      generatedAt: now,
      updatedAt: now,
    })
  },
})

export const markCoachSummaryFailed = internalMutation({
  args: {
    studentId: v.id('students'),
    weekIndex: v.number(),
    failureReason: v.string(),
  },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query('coachSummaries')
      .withIndex('by_studentId_weekIndex', (q) =>
        q.eq('studentId', args.studentId).eq('weekIndex', args.weekIndex),
      )
      .unique()
    if (summary == null) return
    await ctx.db.patch(summary._id, {
      status: 'failed',
      failureReason: args.failureReason,
      updatedAt: Date.now(),
    })
  },
})
