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

/**
 * Insert or update one slice of a booklet's questions.
 *
 * Re-running the loader must not touch ids: attempts, session questions, the
 * review queue and the Elo calibration all point at a question's `_id`, and a
 * delete-and-reinsert left every one of them dangling. So a question is matched
 * by its number within the booklet and a group by its context key, and a reload
 * patches the row that already exists. Fields this loader does not own (Elo,
 * rendered crops) survive the patch.
 *
 * Group ranges and positions arrive computed over the whole booklet
 * (`groupSlots`), so a passage that straddles two slices is still one row.
 */
export const upsertBookletQuestions = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    subjectId: v.string(),
    questions: v.array(
      v.object({
        number: v.number(),
        stem: v.string(),
        group: v.optional(
          v.object({
            key: v.string(),
            contextMarkdown: v.string(),
            firstNumber: v.number(),
            lastNumber: v.number(),
            memberCount: v.number(),
            position: v.number(),
          }),
        ),
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
    const [existingQuestions, existingGroups] = await Promise.all([
      ctx.db
        .query('questions')
        .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
        .collect(),
      ctx.db
        .query('questionGroups')
        .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
        .collect(),
    ])
    const questionByNumber = new Map(existingQuestions.map((row) => [row.questionNumber, row]))
    const groupIdByKey = new Map(existingGroups.map((row) => [row.contextKey, row._id]))

    // One group row per distinct stimulus, so members share the text instead of
    // each carrying a copy — the arrangement `expandToGroups` expects.
    const written = new Set<string>()
    for (const { group } of args.questions) {
      if (group == null || written.has(group.key)) continue
      written.add(group.key)
      const fields = {
        contextMarkdown: group.contextMarkdown,
        firstNumber: group.firstNumber,
        lastNumber: group.lastNumber,
        memberCount: group.memberCount,
      }
      const groupId = groupIdByKey.get(group.key)
      if (groupId != null) {
        await ctx.db.patch("questionGroups", groupId, fields)
      } else {
        groupIdByKey.set(
          group.key,
          await ctx.db.insert('questionGroups', {
            pdfUploadId: args.pdfUploadId,
            contextKey: group.key,
            ...fields,
            createdAt: now,
          }),
        )
      }
    }

    let inserted = 0
    for (const question of args.questions) {
      const fields = {
        sequence: question.number,
        bodyMarkdown: question.stem,
        options: question.options,
        groupId: question.group == null ? undefined : groupIdByKey.get(question.group.key),
        groupPosition: question.group?.position,

        // Printed in the booklet, so it is settled — not inferred, not scored.
        answerStatus: 'completed' as const,
        answerCorrectOption: question.correctOption,
        answerConfidence: 1,
        answerModelId: 'icfes-booklet-key',
        answerPromptVersion: 'deterministic-v1',
        answerCompletedAt: now,

        // The one field the booklet does not carry. Flagged for review so the
        // model pipeline can improve it later without re-importing anything.
        taxonomyStatus: question.confidentTag ? ('completed' as const) : ('needs_review' as const),
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
        eligibility: 'diagnostic' as const,
        eligibilityReasons: question.confidentTag
          ? ['icfes_answer_key', 'keyword_taxonomy_confident']
          : ['icfes_answer_key', 'keyword_taxonomy_low_confidence'],
        eligibilityEvaluatedAt: now,
      }

      const existing = questionByNumber.get(question.number)
      if (existing != null) {
        await ctx.db.patch("questions", existing._id, fields)
      } else {
        await ctx.db.insert('questions', {
          pdfUploadId: args.pdfUploadId,
          questionNumber: question.number,
          createdAt: now,
          ...fields,
        })
        inserted += 1
      }
    }

    return { inserted, updated: args.questions.length - inserted, groups: written.size }
  },
})

/**
 * Split a reload into the questions it kept, the ones it no longer has, and the
 * groups nothing points at any more.
 *
 * A missing question is retired, never deleted: a number also goes missing when
 * the parser's filters drop it, and attempts and session questions point at its
 * id (with no index to check them cheaply). A group stays while any row, retired
 * included, still references it, so review can show a question with its text.
 */
export function planBookletFinish<
  Q extends { questionNumber: number; groupId?: string },
  G extends { _id: string; contextKey: string },
>(questions: Q[], groups: G[], keepNumbers: ReadonlySet<number>, keepKeys: ReadonlySet<string>) {
  const referenced = new Set(questions.map((question) => question.groupId))
  return {
    kept: questions.filter((question) => keepNumbers.has(question.questionNumber)),
    retired: questions.filter((question) => !keepNumbers.has(question.questionNumber)),
    orphanGroups: groups.filter((group) => !keepKeys.has(group.contextKey) && !referenced.has(group._id)),
  }
}

/**
 * Close a (re)load once every slice is in: retire what the booklet no longer
 * has, then recount. The counts are read from the rows rather than from the
 * last slice, which is how `/admin` came to report 8 Sociales questions out of
 * 48. A retired question leaves every pool (they draw by eligibility), and a
 * later reload that finds it again makes it `diagnostic` once more.
 */
export const finishBookletLoad = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    questionNumbers: v.array(v.number()),
    contextKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const [questions, groups] = await Promise.all([
      ctx.db
        .query('questions')
        .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
        .collect(),
      ctx.db
        .query('questionGroups')
        .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
        .collect(),
    ])
    const { kept, retired, orphanGroups } = planBookletFinish(
      questions,
      groups,
      new Set(args.questionNumbers),
      new Set(args.contextKeys),
    )

    const now = Date.now()
    for (const question of retired) {
      await ctx.db.patch("questions", question._id, {
        eligibility: 'excluded',
        eligibilityReasons: ['removed_from_booklet'],
        eligibilityEvaluatedAt: now,
      })
    }
    for (const group of orphanGroups) await ctx.db.delete("questionGroups", group._id)

    const confident = kept.filter((question) => question.taxonomyStatus === 'completed')
    await ctx.db.patch("pdfUploads", args.pdfUploadId, {
      questionCount: kept.length,
      answerCompletedCount: kept.length,
      taxonomyCompletedCount: kept.length,
      diagnosticEligibleCount: confident.length,
      excludedQuestionCount: retired.length,
      updatedAt: now,
      processedAt: now,
      enrichedAt: now,
    })

    return { questions: kept.length, retiredQuestions: retired.length, removedGroups: orphanGroups.length }
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
    await ctx.db.patch("students", student._id, { isAdmin: true, updatedAt: Date.now() })
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
      await ctx.db.patch("questions", row._id, { renderedStemImageId: crop.storageId })
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
      await ctx.db.patch("questionGroups", row._id, { renderedContextImageId: crop.storageId })
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
