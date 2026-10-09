import { generateText } from 'ai'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from './_generated/server'
import type { Id } from './_generated/dataModel'
import { assertOwnsStudent } from './auth'
import { type AiCacheStatus, type ClaimDecision, type ClaimableRow, decideClaim } from './aiCache'
import { colombiaDayNumber, colombiaWeekIndex } from './colombiaTime'
import { settledAttempts } from './sessionIntegrity'
import { getSubjectLabel } from './taxonomy'
import { APRENDO_MODEL_ID, aprendoModel } from './aiProvider'

const COACH_MODEL = APRENDO_MODEL_ID
// v2: weeks now start on Monday. A summary keyed to the old Thursday buckets
// describes a different span of days, so it is rewritten rather than reused.
const PROMPT_VERSION = 'v2'

/**
 * How old a ready summary must be before new activity rewrites it. The week
 * keeps going after the first visit, so the summary has to follow it — but not
 * on every answer, which would cost an LLM call per question.
 */
export const COACH_REFRESH_MS = 3 * 60 * 60 * 1000

/**
 * `decideClaim` plus the one rule only the coach has: a ready summary is
 * rewritten once the student has answered something since it was written and
 * it was last touched at least `COACH_REFRESH_MS` ago. A failed rewrite touches
 * it (see `coachFailurePatch`), so an outage is retried every interval, not on
 * every visit — even for a summary on an old prompt, which `decideClaim` alone
 * would reclaim at once.
 */
export function decideCoachClaim(params: {
  existing: (ClaimableRow & { generatedAt?: number; failureReason?: string }) | null
  promptVersion: string
  now: number
  lastActivityAt: number | null
}): ClaimDecision {
  const existing = params.existing
  if (
    existing?.status === 'ready'
    && existing.failureReason != null
    && params.now - existing.updatedAt < COACH_REFRESH_MS
  ) return 'skip'

  const decision = decideClaim(params)
  if (decision !== 'skip' || existing?.status !== 'ready') return decision

  const writtenAt = existing.generatedAt ?? existing.updatedAt
  const hasNewActivity = params.lastActivityAt != null && params.lastActivityAt > writtenAt
  return hasNewActivity && params.now - existing.updatedAt >= COACH_REFRESH_MS ? 'reclaim' : 'skip'
}

/**
 * A failed rewrite must not take the student's summary away: with a previous
 * body the row goes back to `ready` and keeps it. Only a first summary that
 * fails is left `failed`, which `decideClaim` retries.
 */
export function coachFailurePatch(
  summary: { body?: string },
  failureReason: string,
  now: number,
): { status: AiCacheStatus; failureReason: string; updatedAt: number } {
  return { status: summary.body != null ? 'ready' : 'failed', failureReason, updatedAt: now }
}

/**
 * What "Hoy" shows: while a rewrite runs, the last good body stays on screen
 * rather than a "Preparando…" placeholder. Only a summary with nothing written
 * yet reads as `generating`.
 */
export function coachSummaryForDisplay<T extends { status: AiCacheStatus; body?: string }>(
  summary: T,
): T {
  return summary.status === 'generating' && summary.body != null
    ? { ...summary, status: 'ready' }
    : summary
}

/** When the student last answered anything: the "new activity" signal. */
async function lastAnsweredAt(ctx: QueryCtx, studentId: Id<'students'>) {
  const attempts = await ctx.db
    .query('questionAttempts')
    .withIndex('by_studentId', (q) => q.eq('studentId', studentId))
    .collect()
  let latest: number | null = null
  for (const attempt of attempts) {
    if (attempt.answeredAt == null || attempt.isCorrect == null) continue
    if (latest == null || attempt.answeredAt > latest) latest = attempt.answeredAt
  }
  return latest
}

export const getWeeklyCoachSummary = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)
    const now = Date.now()
    const summary = await ctx.db
      .query('coachSummaries')
      .withIndex('by_studentId_weekIndex', (q) =>
        q.eq('studentId', args.studentId).eq('weekIndex', colombiaWeekIndex(now)),
      )
      .unique()
    if (summary == null) return null

    // Null means "no current summary", and "Hoy" requests one exactly then. A
    // summary due for a rewrite therefore reads as missing, and the request
    // re-claims it with the same rule.
    const decision = decideCoachClaim({
      existing: summary,
      promptVersion: PROMPT_VERSION,
      now,
      lastActivityAt: await lastAnsweredAt(ctx, args.studentId),
    })
    return decision === 'skip' ? coachSummaryForDisplay(summary) : null
  },
})

/**
 * Ensure this week's coach summary exists, generating on demand. Same atomic
 * claim + schedule pattern as concept lessons: the `generating` status
 * deduplicates concurrent requests for the same (student, week). When to
 * rewrite an existing one lives in `decideCoachClaim`.
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

    const decision = decideCoachClaim({
      existing,
      promptVersion: PROMPT_VERSION,
      now,
      lastActivityAt: await lastAnsweredAt(ctx, args.studentId),
    })

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
      // The previous body stays (it is shown while this runs), and so do the
      // model and prompt version that describe it until a new one replaces it.
      await ctx.db.patch('coachSummaries', existing!._id, {
        status: 'generating',
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
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    // The summary quotes "N correctas": only finished sittings may feed it, or
    // an open simulacro's grades would reach the student through the coach.
    const settled = new Set(settledAttempts(attempts, sessions))

    const weekAttempts = attempts.filter(
      (attempt) =>
        attempt.answeredAt != null
        && attempt.isCorrect != null
        && colombiaWeekIndex(attempt.answeredAt) === args.weekIndex,
    )

    const questionIds = [...new Set(weekAttempts.map((attempt) => attempt.questionId))]
    const questions = await Promise.all(questionIds.map((id) => ctx.db.get('questions', id)))
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
      if (!settled.has(attempt)) continue
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
              `- Preguntas respondidas: ${stats.totalAttempts} (${stats.correctCount} correctas en sesiones terminadas)`,
              `- Días activos: ${stats.activeDays}`,
              'Desempeño por materia:',
              subjectLines,
              '',
              'Escribe un resumen de 2-4 frases: celebra un logro concreto de la semana, señala con tacto una materia para reforzar, y termina con una recomendación accionable para la próxima semana. Markdown simple, sin encabezados.',
            ].join('\n')

      const { text } = await generateText({
        model: aprendoModel(COACH_MODEL),
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
    await ctx.db.patch('coachSummaries', summary._id, {
      status: 'ready',
      body: args.body,
      modelId: COACH_MODEL,
      promptVersion: PROMPT_VERSION,
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
    await ctx.db.patch(
      'coachSummaries',
      summary._id,
      coachFailurePatch(summary, args.failureReason, Date.now()),
    )
  },
})
