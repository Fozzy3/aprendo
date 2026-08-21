import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'

/**
 * Import an ICFES practice booklet without OCR and without a model.
 *
 * The booklets ship a text layer and print their own answer key, so the whole
 * pipeline collapses to parsing (`@aprendo/ingest/icfes-booklet`) plus this
 * insert. Two consequences worth stating:
 *
 * - **The answer is the one ICFES published**, not one a model inferred. That
 *   removes the biggest correctness risk the normal pipeline carries.
 * - **The subtopic is a keyword guess**, the one thing the booklet does not
 *   print. Low-confidence tags are stored with `taxonomyStatus: 'needs_review'`
 *   so `/admin` shows the truth and the model pipeline can re-tag them later
 *   without a re-import. They stay eligible for placement anyway — see the note
 *   on `eligibility` below for why that is safe.
 */

const BOOKLET_CONTENT_TYPE = 'application/x-aprendo-icfes-booklet'

export const prepareBookletUpload = internalAction({
  args: { slug: v.string(), fileName: v.string() },
  handler: async (ctx, args): Promise<Id<'pdfUploads'>> => {
    const existing: Id<'pdfUploads'> | null = await ctx.runMutation(
      internal.booklets.findBooklet,
      { slug: args.slug },
    )
    if (existing != null) return existing

    // `pdfUploads.pdfStorageId` is required and typed to real storage. The
    // source PDF itself is not stored — it is a public document that
    // `content/fetch.sh` re-downloads — so a marker blob stands in.
    const storageId = await ctx.storage.store(
      new Blob([`icfes-booklet:${args.slug}`], { type: BOOKLET_CONTENT_TYPE }),
    )
    return await ctx.runMutation(internal.booklets.createBooklet, {
      slug: args.slug,
      fileName: args.fileName,
      pdfStorageId: storageId,
    })
  },
})

export const findBooklet = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('pdfUploads')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
    return row?._id ?? null
  },
})

export const createBooklet = internalMutation({
  args: {
    slug: v.string(),
    fileName: v.string(),
    pdfStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return ctx.db.insert('pdfUploads', {
      fileName: args.fileName,
      slug: args.slug,
      pdfStorageId: args.pdfStorageId,
      contentType: BOOKLET_CONTENT_TYPE,
      sizeBytes: 0,
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    })
  },
})

/** Drop everything previously imported for a booklet, so a re-run is idempotent. */
export const clearBooklet = internalMutation({
  args: { pdfUploadId: v.id('pdfUploads') },
  handler: async (ctx, args) => {
    const questions = await ctx.db
      .query('questions')
      .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
      .collect()
    for (const question of questions) await ctx.db.delete(question._id)

    const groups = await ctx.db
      .query('questionGroups')
      .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
      .collect()
    for (const group of groups) await ctx.db.delete(group._id)

    return { removedQuestions: questions.length, removedGroups: groups.length }
  },
})

export const insertBookletQuestions = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    subjectId: v.string(),
    questions: v.array(
      v.object({
        number: v.number(),
        stem: v.string(),
        contextMarkdown: v.optional(v.string()),
        contextKey: v.optional(v.string()),
        options: v.array(v.object({ label: v.string(), bodyMarkdown: v.string() })),
        correctOption: v.string(),
        categoryId: v.string(),
        subtopicId: v.string(),
        tagConfidence: v.number(),
        confidentTag: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // One group row per distinct stimulus, so members share the text instead of
    // each carrying a copy — the arrangement `expandToGroups` expects.
    const groupIdByKey = new Map<string, Id<'questionGroups'>>()
    for (const question of args.questions) {
      const key = question.contextKey
      if (key == null || question.contextMarkdown == null) continue
      if (groupIdByKey.has(key)) continue

      const members = args.questions.filter((item) => item.contextKey === key)
      const numbers = members.map((item) => item.number)
      const groupId = await ctx.db.insert('questionGroups', {
        pdfUploadId: args.pdfUploadId,
        contextKey: key,
        contextMarkdown: question.contextMarkdown,
        firstNumber: Math.min(...numbers),
        lastNumber: Math.max(...numbers),
        memberCount: members.length,
        createdAt: now,
      })
      groupIdByKey.set(key, groupId)
    }

    let inserted = 0
    for (const question of args.questions) {
      const groupId = question.contextKey == null ? undefined : groupIdByKey.get(question.contextKey)
      const members =
        question.contextKey == null
          ? []
          : args.questions
              .filter((item) => item.contextKey === question.contextKey)
              .sort((a, b) => a.number - b.number)

      await ctx.db.insert('questions', {
        pdfUploadId: args.pdfUploadId,
        questionNumber: question.number,
        sequence: question.number,
        bodyMarkdown: question.stem,
        options: question.options,
        createdAt: now,
        groupId,
        groupPosition:
          groupId == null ? undefined : members.findIndex((item) => item.number === question.number),

        // Printed in the booklet, so it is settled — not inferred, not scored.
        answerStatus: 'completed',
        answerCorrectOption: question.correctOption,
        answerConfidence: 1,
        answerModelId: 'icfes-booklet-key',
        answerPromptVersion: 'deterministic-v1',
        answerCompletedAt: now,

        // The one field the booklet does not carry. Flagged for review so the
        // model pipeline can improve it later without re-importing anything.
        taxonomyStatus: question.confidentTag ? 'completed' : 'needs_review',
        taxonomyVersion: 'keyword-v1',
        taxonomyRelease: 'keyword-v1',
        subjectId: args.subjectId,
        categoryId: question.categoryId,
        primarySubtopicId: question.subtopicId,
        taggingConfidence: question.tagConfidence,
        taxonomyModelId: 'keyword-rules',
        taxonomyPromptVersion: 'keyword-v1',
        taxonomyCompletedAt: now,

        // Eligible for placement regardless of how sure the subtopic tag is.
        //
        // Placement reads `learnerSubjectAggregates.accuracy` — accuracy per
        // AREA — and the area is certain here: it is which booklet the question
        // came from. A weak subtopic tag misattributes credit inside the
        // learning path and the recommendations, and those are wrong either way
        // until the model re-tags. Gating placement on it would have left
        // Matemáticas with zero usable questions to measure a student with,
        // which is a worse answer to "what level am I" than a slightly
        // misfiled subtopic.
        eligibility: 'diagnostic',
        eligibilityReasons: question.confidentTag
          ? ['icfes_answer_key', 'keyword_taxonomy_confident']
          : ['icfes_answer_key', 'keyword_taxonomy_low_confidence'],
        eligibilityEvaluatedAt: now,
      })
      inserted += 1
    }

    await ctx.db.patch(args.pdfUploadId, {
      questionCount: inserted,
      answerCompletedCount: inserted,
      taxonomyCompletedCount: inserted,
      diagnosticEligibleCount: args.questions.filter((q) => q.confidentTag).length,
      updatedAt: now,
      processedAt: now,
      enrichedAt: now,
    })

    return { inserted, groups: groupIdByKey.size }
  },
})

/** Grant admin rights by email, so the panel is reachable after a fresh deploy. */
export const grantAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase()
    const student = await ctx.db
      .query('students')
      .withIndex('by_normalizedEmail', (q) => q.eq('normalizedEmail', normalized))
      .unique()
    if (student == null) return { granted: false, reason: 'No existe un estudiante con ese correo.' }
    await ctx.db.patch(student._id, { isAdmin: true, updatedAt: Date.now() })
    return { granted: true, studentId: student._id }
  },
})

/**
 * A batch of upload URLs.
 *
 * One per call meant spawning the Convex CLI once per file — 418 process
 * starts. Sending the images as base64 arguments instead hit ARG_MAX and threw
 * `E2BIG`, which the uploader swallowed: it reported 418 files handled and
 * attached none. Handing back a batch of URLs keeps the bytes on an HTTP PUT
 * where they belong and costs one call per twenty files.
 */
export const generateCropUploadUrls = internalMutation({
  args: { count: v.number() },
  handler: async (ctx, args): Promise<string[]> => {
    const urls: string[] = []
    for (let i = 0; i < Math.min(args.count, 40); i += 1) {
      urls.push(await ctx.storage.generateUploadUrl())
    }
    return urls
  },
})

/**
 * Attach rendered page crops to the questions and groups of one booklet.
 *
 * Matched by question number within the upload, which is the only stable key:
 * the crop comes from the PDF and the row comes from the parser, and neither
 * knows the other's id.
 */
export const attachCrops = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    questions: v.array(v.object({ number: v.number(), storageId: v.id('_storage') })),
    groups: v.array(
      v.object({ first: v.number(), last: v.number(), storageId: v.id('_storage') }),
    ),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('questions')
      .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
      .collect()
    const byNumber = new Map(rows.map((row) => [row.questionNumber, row]))

    let attached = 0
    for (const crop of args.questions) {
      const row = byNumber.get(crop.number)
      if (row == null) continue
      await ctx.db.patch(row._id, { renderedStemImageId: crop.storageId })
      attached += 1
    }

    const groupRows = await ctx.db
      .query('questionGroups')
      .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
      .collect()
    let attachedGroups = 0
    for (const crop of args.groups) {
      const row = groupRows.find(
        (g) => g.firstNumber === crop.first && g.lastNumber === crop.last,
      )
      if (row == null) continue
      await ctx.db.patch(row._id, { renderedContextImageId: crop.storageId })
      attachedGroups += 1
    }

    return { attached, attachedGroups, skipped: args.questions.length - attached }
  },
})

/** Public URL for a stored crop, resolved at read time. */
export const cropUrl = internalQuery({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => ctx.storage.getUrl(args.storageId),
})
