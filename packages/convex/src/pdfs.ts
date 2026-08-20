import { mutation, query, internalMutation, internalQuery } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { slugify } from '../../ingest/src/slug'
import { distractorRationaleValidator, questionDocumentValidator } from './validators'
import { requireAdminStudentId } from './auth'

async function serializeUpload(
  ctx: { storage: { getUrl: (storageId: Doc<'pdfUploads'>['pdfStorageId']) => Promise<string | null> } },
  upload: Doc<'pdfUploads'>,
) {
  const pdfUrl = await ctx.storage.getUrl(upload.pdfStorageId)
  const ocrPagesUrl = upload.ocrPagesStorageId
    ? await ctx.storage.getUrl(upload.ocrPagesStorageId)
    : null
  const rawQuestionsUrl = upload.rawQuestionsStorageId
    ? await ctx.storage.getUrl(upload.rawQuestionsStorageId)
    : null

  return {
    ...upload,
    pdfUrl,
    ocrPagesUrl,
    rawQuestionsUrl,
  }
}

export const generatePdfUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminStudentId(ctx)
    return ctx.storage.generateUploadUrl()
  },
})

export const createPdfUpload = mutation({
  args: {
    storageId: v.id('_storage'),
    fileName: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminStudentId(ctx)
    const now = Date.now()
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: args.fileName,
      slug: `${slugify(args.fileName)}-${now}`,
      pdfStorageId: args.storageId,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      status: 'uploaded',
      createdAt: now,
      updatedAt: now,
    })

    await ctx.scheduler.runAfter(0, internal.pdfPipeline.processUploadedPdf, {
      pdfUploadId,
    })

    return pdfUploadId
  },
})

export const retryPdfUpload = mutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
  },
  handler: async (ctx, args) => {
    await requireAdminStudentId(ctx)
    const upload = await ctx.db.get(args.pdfUploadId)
    if (upload == null) {
      throw new Error('PDF upload not found.')
    }

    if (upload.status === 'processing' || upload.status === 'enriching') {
      throw new Error('PDF is already processing.')
    }

    await ctx.db.patch(args.pdfUploadId, {
      status: 'uploaded',
      errorMessage: undefined,
      updatedAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, internal.pdfPipeline.processUploadedPdf, {
      pdfUploadId: args.pdfUploadId,
    })
  },
})

export const listPdfUploads = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminStudentId(ctx)
    const uploads = await ctx.db
      .query('pdfUploads')
      .withIndex('by_createdAt')
      .order('desc')
      .take(args.limit ?? 20)

    return Promise.all(uploads.map((upload) => serializeUpload(ctx, upload)))
  },
})

export const getPdfUploadDetail = query({
  args: {
    pdfUploadId: v.id('pdfUploads'),
  },
  handler: async (ctx, args) => {
    await requireAdminStudentId(ctx)
    const upload = await ctx.db.get(args.pdfUploadId)
    if (upload == null) {
      return null
    }

    const questions = await ctx.db
      .query('questions')
      .withIndex('by_pdfUploadId_sequence', (q) =>
        q.eq('pdfUploadId', args.pdfUploadId),
      )
      .take(5)

    return {
      upload: await serializeUpload(ctx, upload),
      previewQuestions: questions,
    }
  },
})

export const getQuestionBrowser = query({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    sequence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminStudentId(ctx)
    const upload = await ctx.db.get(args.pdfUploadId)
    if (upload == null) {
      return null
    }

    const totalQuestions = upload.questionCount ?? 0
    if (totalQuestions === 0) {
      return {
        upload: await serializeUpload(ctx, upload),
        totalQuestions: 0,
        currentSequence: 1,
        question: null,
      }
    }

    const requestedSequence = Math.max(
      1,
      Math.min(args.sequence ?? 1, totalQuestions),
    )

    const currentQuestion = await ctx.db
      .query('questions')
      .withIndex('by_pdfUploadId_sequence', (q) =>
        q.eq('pdfUploadId', args.pdfUploadId).eq('sequence', requestedSequence),
      )
      .unique()
    if (currentQuestion == null) {
      return {
        upload: await serializeUpload(ctx, upload),
        totalQuestions,
        currentSequence: requestedSequence,
        question: null,
      }
    }

    return {
      upload: await serializeUpload(ctx, upload),
      totalQuestions,
      currentSequence: requestedSequence,
      question: currentQuestion,
    }
  },
})

export const getPdfUploadForProcessing = internalQuery({
  args: {
    pdfUploadId: v.id('pdfUploads'),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.pdfUploadId)
  },
})

export const markPdfProcessing = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.patch(args.pdfUploadId, {
      status: 'processing',
      errorMessage: undefined,
      processingStartedAt: now,
      updatedAt: now,
    })
  },
})

export const clearPdfQuestions = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('questions')
      .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
      .collect()

    for (const question of existing) {
      await ctx.db.delete(question._id)
    }

    // Groups belong to the upload too — leaving them behind on a reprocess
    // would strand rows no question points at any more.
    const existingGroups = await ctx.db
      .query('questionGroups')
      .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
      .collect()

    for (const group of existingGroups) {
      await ctx.db.delete(group._id)
    }
  },
})

/**
 * Insert an upload's shared-stimulus groups and return their ids keyed by
 * `contextKey`, so the question insert that follows can point each member at
 * its group.
 */
export const insertPdfQuestionGroups = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    groups: v.array(
      v.object({
        contextKey: v.string(),
        contextMarkdown: v.string(),
        contextImages: v.optional(v.array(v.string())),
        firstNumber: v.number(),
        lastNumber: v.number(),
        memberCount: v.number(),
        createdAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const idByContextKey: Record<string, Id<'questionGroups'>> = {}
    for (const group of args.groups) {
      idByContextKey[group.contextKey] = await ctx.db.insert('questionGroups', {
        pdfUploadId: args.pdfUploadId,
        ...group,
      })
    }
    return idByContextKey
  },
})

export const insertPdfQuestionsChunk = internalMutation({
  args: {
    questions: v.array(questionDocumentValidator),
  },
  handler: async (ctx, args) => {
    for (const question of args.questions) {
      await ctx.db.insert('questions', question)
    }
  },
})

export const markPdfCompleted = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    pageCount: v.number(),
    assetCount: v.number(),
    questionCount: v.number(),
    ocrPagesStorageId: v.id('_storage'),
    rawQuestionsStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.patch(args.pdfUploadId, {
      status: 'enriching',
      pageCount: args.pageCount,
      assetCount: args.assetCount,
      questionCount: args.questionCount,
      ocrPagesStorageId: args.ocrPagesStorageId,
      rawQuestionsStorageId: args.rawQuestionsStorageId,
      processedAt: now,
      enrichmentStartedAt: now,
      updatedAt: now,
    })
  },
})

export const markPdfEnriching = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.patch(args.pdfUploadId, {
      status: 'enriching',
      enrichmentStartedAt: now,
      updatedAt: now,
    })
  },
})

export const getPdfQuestionIds = internalQuery({
  args: {
    pdfUploadId: v.id('pdfUploads'),
  },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_pdfUploadId_sequence', (q) => q.eq('pdfUploadId', args.pdfUploadId))
      .collect()

    return questions.map((question) => question._id)
  },
})

export const getQuestionsForEnrichment = internalQuery({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const questions = await Promise.all(
      args.questionIds.map((questionId) => ctx.db.get(questionId)),
    )

    // Attach each grouped question's shared stimulus so enrichment sees the full
    // text it is being asked about, not just a dangling stem.
    return Promise.all(
      questions
        .filter((question): question is Doc<'questions'> => question != null)
        .map(async (question) => {
          const group = question.groupId == null ? null : await ctx.db.get(question.groupId)
          return {
            ...question,
            ...(group == null ? {} : { contextMarkdown: group.contextMarkdown }),
          }
        }),
    )
  },
})

export const setQuestionAnswerProcessing = internalMutation({
  args: {
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.questionId, {
      answerStatus: 'processing',
      answerErrorMessage: undefined,
    })
  },
})

export const setQuestionAnswerResult = internalMutation({
  args: {
    questionId: v.id('questions'),
    status: v.union(v.literal('completed'), v.literal('failed'), v.literal('needs_review')),
    correctOption: v.optional(v.string()),
    solutionMarkdown: v.optional(v.string()),
    distractorRationales: v.optional(v.array(distractorRationaleValidator)),
    confidence: v.optional(v.number()),
    modelId: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.questionId, {
      answerStatus: args.status,
      answerCorrectOption: args.correctOption,
      answerSolutionMarkdown: args.solutionMarkdown,
      answerDistractorRationales: args.distractorRationales,
      answerConfidence: args.confidence,
      answerModelId: args.modelId,
      answerPromptVersion: args.promptVersion,
      answerCompletedAt: Date.now(),
      answerErrorMessage: args.errorMessage,
    })
  },
})

export const setQuestionTaxonomyProcessing = internalMutation({
  args: {
    questionId: v.id('questions'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.questionId, {
      taxonomyStatus: 'processing',
      taxonomyErrorMessage: undefined,
    })
  },
})

export const setQuestionTaxonomyResult = internalMutation({
  args: {
    questionId: v.id('questions'),
    status: v.union(v.literal('completed'), v.literal('failed'), v.literal('needs_review')),
    taxonomyVersion: v.optional(v.string()),
    taxonomyRelease: v.optional(v.string()),
    subjectId: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    primarySubtopicId: v.optional(v.string()),
    secondarySubtopicIds: v.optional(v.array(v.string())),
    secondaryDimensions: v.optional(v.array(v.object({
      dimension: v.string(),
      value: v.string(),
    }))),
    confidence: v.optional(v.number()),
    modelId: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.questionId, {
      taxonomyStatus: args.status,
      taxonomyVersion: args.taxonomyVersion,
      taxonomyRelease: args.taxonomyRelease,
      subjectId: args.subjectId,
      categoryId: args.categoryId,
      primarySubtopicId: args.primarySubtopicId,
      secondarySubtopicIds: args.secondarySubtopicIds,
      secondaryDimensions: args.secondaryDimensions,
      taggingConfidence: args.confidence,
      taxonomyModelId: args.modelId,
      taxonomyPromptVersion: args.promptVersion,
      taxonomyCompletedAt: Date.now(),
      taxonomyErrorMessage: args.errorMessage,
    })
  },
})

export const setQuestionEligibility = internalMutation({
  args: {
    questionId: v.id('questions'),
    eligibility: v.union(
      v.literal('pending'),
      v.literal('diagnostic'),
      v.literal('practice_only'),
      v.literal('excluded'),
    ),
    reasons: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.questionId, {
      eligibility: args.eligibility,
      eligibilityReasons: args.reasons,
      eligibilityEvaluatedAt: Date.now(),
    })
  },
})

export const refreshPdfEnrichmentStats = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
  },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
      .collect()

    const answerCompletedCount = questions.filter((question) => question.answerStatus === 'completed').length
    const taxonomyCompletedCount = questions.filter((question) => question.taxonomyStatus === 'completed').length
    const diagnosticEligibleCount = questions.filter((question) => question.eligibility === 'diagnostic').length
    const excludedQuestionCount = questions.filter((question) => question.eligibility === 'excluded').length
    const allQuestionsResolved = questions.every((question) =>
      question.answerStatus !== 'pending'
      && question.answerStatus !== 'processing'
      && question.taxonomyStatus !== 'pending'
      && question.taxonomyStatus !== 'processing'
      && question.eligibility !== 'pending',
    )

    await ctx.db.patch(args.pdfUploadId, {
      status: allQuestionsResolved ? 'completed' : 'enriching',
      answerCompletedCount,
      taxonomyCompletedCount,
      diagnosticEligibleCount,
      excludedQuestionCount,
      enrichedAt: allQuestionsResolved ? Date.now() : undefined,
      updatedAt: Date.now(),
    })
  },
})

export const getDiagnosticEligibleQuestionPool = internalQuery({
  args: {
    subjectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.subjectId) {
      return ctx.db
        .query('questions')
        .withIndex('by_subjectId_eligibility', (q) =>
          q.eq('subjectId', args.subjectId).eq('eligibility', 'diagnostic'),
        )
        .collect()
    }

    const questions = await ctx.db.query('questions').collect()
    return questions.filter((question) => question.eligibility === 'diagnostic')
  },
})

export const getQuestionsByIds = internalQuery({
  args: {
    questionIds: v.array(v.id('questions')),
  },
  handler: async (ctx, args) => {
    const questions = await Promise.all(
      args.questionIds.map((questionId) => ctx.db.get(questionId)),
    )
    return questions.filter((question): question is Doc<'questions'> => question != null)
  },
})

export const markPdfFailed = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pdfUploadId, {
      status: 'failed',
      errorMessage: args.message,
      updatedAt: Date.now(),
    })
  },
})
