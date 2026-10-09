import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery, query } from './_generated/server'
import { requireAdminStudentId } from './auth'
import { distractorRationaleValidator } from './validators'
import { inferQuestionAnswer } from '../../ingest/src/question-enrichment-core'

/**
 * Written explanations for the official booklet questions (G14).
 *
 * The booklets print only the key, so a student who misses a real ICFES item
 * gets a letter and nothing to learn from. This backfill runs the existing
 * answer enrichment — same prompt, same model, decided in
 * `question-enrichment-core.ts` — and keeps its solution and per-option
 * rationales **only when the model independently lands on the official key**.
 *
 * The key is never touched. A model that disagrees is either wrong or has found
 * a bad key; either way a person decides, so the question gets a flag in
 * `answerErrorMessage` (sealed during solve like the rest of the answer fields)
 * and no explanation.
 *
 * Idempotent: explained and flagged questions are skipped, and the save
 * re-checks both before writing. A question that throws is left unflagged and
 * skipped for the rest of the run; its id comes back in `failedIds`, to pass as
 * `skipIds` on a re-run. Run it by hand, in batches:
 *   bunx convex run explanations:backfillExplanations '{"limit": 10, "dryRun": true}'
 *   bunx convex run explanations:backfillExplanations '{"limit": 250}'
 *   bunx convex run explanations:backfillExplanations '{"limit": 250, "skipIds": ["…"]}'
 */

/** `answerModelId` of a key printed in an ICFES booklet (see `booklets.ts`). */
const OFFICIAL_KEY_MODEL_ID = 'icfes-booklet-key'
export const EXPLANATION_FLAG_PREFIX = 'explicacion_ia:'
/** Below this, an agreement with the key may be a lucky guess explained badly. */
export const MIN_EXPLANATION_CONFIDENCE = 0.6
/** Questions per action run; the scheduler chains the next batch. */
const BATCH_SIZE = 5

export function needsExplanation(question: {
  answerModelId?: string
  answerCorrectOption?: string
  answerSolutionMarkdown?: string
  answerErrorMessage?: string
  eligibility?: string
}) {
  return (
    question.answerModelId === OFFICIAL_KEY_MODEL_ID
    && question.answerCorrectOption != null
    && !question.answerSolutionMarkdown
    && !question.answerErrorMessage?.startsWith(EXPLANATION_FLAG_PREFIX)
    && question.eligibility !== 'excluded'
  )
}

type Rationale = { label: string; rationaleMarkdown: string }

export function decideExplanation(args: {
  officialKey: string
  optionLabels: string[]
  result: {
    correctOption: string
    confidence: number
    solutionMarkdown?: string
    distractorRationales: Rationale[]
  }
}):
  | { action: 'store'; solutionMarkdown: string; distractorRationales: Rationale[] }
  | { action: 'flag'; message: string } {
  const { officialKey, result } = args
  const confidence = result.confidence.toFixed(2)

  if (result.correctOption !== officialKey) {
    return {
      action: 'flag',
      message: `${EXPLANATION_FLAG_PREFIX} el modelo eligió ${result.correctOption} (confianza ${confidence}); la clave oficial es ${officialKey}. Revisar la clave o el enunciado.`,
    }
  }
  if (result.confidence < MIN_EXPLANATION_CONFIDENCE) {
    return {
      action: 'flag',
      message: `${EXPLANATION_FLAG_PREFIX} coincide con la clave ${officialKey} pero con confianza ${confidence}. Revisar a mano.`,
    }
  }
  const solutionMarkdown = result.solutionMarkdown?.trim() ?? ''
  if (solutionMarkdown.length === 0) {
    return {
      action: 'flag',
      message: `${EXPLANATION_FLAG_PREFIX} coincide con la clave ${officialKey} pero no escribió la solución.`,
    }
  }

  const seen = new Set<string>()
  const distractorRationales = result.distractorRationales.filter((rationale) => {
    const keep =
      rationale.label !== officialKey
      && args.optionLabels.includes(rationale.label)
      && !seen.has(rationale.label)
    seen.add(rationale.label)
    return keep
  })
  return { action: 'store', solutionMarkdown, distractorRationales }
}

export const listExplanationCandidates = internalQuery({
  args: { limit: v.number(), skipIds: v.optional(v.array(v.id('questions'))) },
  handler: async (ctx, args) => {
    const skip = new Set<string>(args.skipIds ?? [])
    // The bank is a few hundred rows; a scan is simpler than a new index.
    const pending = (await ctx.db.query('questions').collect()).filter(
      (question) => needsExplanation(question) && !skip.has(question._id),
    )
    const questions = await Promise.all(
      pending.slice(0, Math.max(0, args.limit)).map(async (question) => {
        const group =
          question.groupId == null ? null : await ctx.db.get('questionGroups', question.groupId)
        return {
          questionId: question._id,
          officialKey: question.answerCorrectOption!,
          bodyMarkdown: question.bodyMarkdown,
          contextMarkdown: group?.contextMarkdown,
          options: question.options,
          imageIds: [group?.renderedContextImageId, question.renderedStemImageId].filter(
            (id): id is Id<'_storage'> => id != null,
          ),
        }
      }),
    )
    return { pendingCount: pending.length, questions }
  },
})

export const saveExplanation = internalMutation({
  args: {
    questionId: v.id('questions'),
    officialKey: v.string(),
    solutionMarkdown: v.string(),
    distractorRationales: v.array(distractorRationaleValidator),
  },
  handler: async (ctx, args) => {
    const question = await ctx.db.get('questions', args.questionId)
    // Re-checked here: the key or the question may have changed during the call.
    if (question == null || !needsExplanation(question) || question.answerCorrectOption !== args.officialKey) {
      return false
    }
    await ctx.db.patch('questions', args.questionId, {
      answerSolutionMarkdown: args.solutionMarkdown,
      answerDistractorRationales: args.distractorRationales,
      explanationSource: 'ai_generated',
    })
    return true
  },
})

export const flagExplanation = internalMutation({
  args: { questionId: v.id('questions'), message: v.string() },
  handler: async (ctx, args) => {
    const question = await ctx.db.get('questions', args.questionId)
    if (question == null || !needsExplanation(question)) return false
    await ctx.db.patch('questions', args.questionId, { answerErrorMessage: args.message })
    return true
  },
})

type BackfillResult = {
  dryRun: boolean
  pendingCount: number
  questionIds: Id<'questions'>[]
  stored: number
  flagged: number
  failedIds: Id<'questions'>[]
  scheduledNext: boolean
}

export const backfillExplanations = internalAction({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    skipIds: v.optional(v.array(v.id('questions'))),
  },
  handler: async (ctx, args): Promise<BackfillResult> => {
    const limit = Math.max(0, Math.floor(args.limit ?? BATCH_SIZE))
    const skipIds = args.skipIds ?? []
    const batch = await ctx.runQuery(internal.explanations.listExplanationCandidates, {
      limit: args.dryRun ? limit : Math.min(limit, BATCH_SIZE),
      skipIds,
    })
    const result: BackfillResult = {
      dryRun: args.dryRun ?? false,
      pendingCount: batch.pendingCount,
      questionIds: batch.questions.map((question) => question.questionId),
      stored: 0,
      flagged: 0,
      failedIds: [],
      scheduledNext: false,
    }
    if (args.dryRun) return result

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('Falta GEMINI_API_KEY (la misma del pipeline de enriquecimiento).')

    for (const question of batch.questions) {
      try {
        const urls = await Promise.all(question.imageIds.map((id) => ctx.storage.getUrl(id)))
        const answer = await inferQuestionAnswer({
          apiKey,
          question: {
            bodyMarkdown: question.bodyMarkdown,
            ...(question.contextMarkdown == null ? {} : { contextMarkdown: question.contextMarkdown }),
            options: question.options,
            // Booklet crops are PNG (`upload-icfes-crops.ts`).
            images: urls
              .filter((url): url is string => url != null)
              .map((url) => ({ url, mediaType: 'image/png' })),
          },
        })
        const decision = decideExplanation({
          officialKey: question.officialKey,
          optionLabels: question.options.map((option) => option.label),
          result: answer,
        })
        if (decision.action === 'store') {
          await ctx.runMutation(internal.explanations.saveExplanation, {
            questionId: question.questionId,
            officialKey: question.officialKey,
            solutionMarkdown: decision.solutionMarkdown,
            distractorRationales: decision.distractorRationales,
          })
          result.stored += 1
        } else {
          await ctx.runMutation(internal.explanations.flagExplanation, {
            questionId: question.questionId,
            message: decision.message,
          })
          result.flagged += 1
        }
      } catch (error) {
        // Left unflagged so a later run can retry it; skipped for the rest of this one.
        console.error(`explicación falló para ${question.questionId}:`, error)
        result.failedIds.push(question.questionId)
      }
    }

    // Chain the next batch while there is budget, work left and progress: a
    // batch where everything failed (no key, provider down) stops the chain.
    const remaining = limit - batch.questions.length
    const progressed = result.stored + result.flagged > 0
    if (remaining > 0 && progressed && batch.pendingCount > batch.questions.length) {
      await ctx.scheduler.runAfter(0, internal.explanations.backfillExplanations, {
        limit: remaining,
        skipIds: [...skipIds, ...result.failedIds],
      })
      result.scheduledNext = true
    }
    return result
  },
})

/** Questions the backfill refused to explain, for an admin to settle. */
export const listExplanationFlags = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminStudentId(ctx)
    const questions = await ctx.db.query('questions').collect()
    return questions
      .filter((question) => question.answerErrorMessage?.startsWith(EXPLANATION_FLAG_PREFIX))
      .map((question) => ({
        questionId: question._id,
        pdfUploadId: question.pdfUploadId,
        questionNumber: question.questionNumber,
        subjectId: question.subjectId ?? null,
        officialKey: question.answerCorrectOption ?? null,
        message: question.answerErrorMessage!,
      }))
  },
})
