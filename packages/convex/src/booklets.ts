import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { BOOKLET_CONTENT_TYPE, ensureAudit } from './audit'

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
 * rendered crops, a signed key or text) survive the patch.
 *
 * Group ranges and positions arrive computed over the whole booklet
 * (`groupSlots`), so a passage that straddles two slices is still one row.
 */
export const upsertBookletQuestions = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    subjectId: v.string(),
    /** A later pass over a booklet already in the bank: what exists is left exactly as it is. */
    addOnly: v.optional(v.boolean()),
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
        /** Set only when the booklet prints no key and ours comes from solving it. */
        answerModelId: v.optional(v.string()),
        categoryId: v.string(),
        subtopicId: v.string(),
        tagConfidence: v.number(),
        confidentTag: v.boolean(),
        /** Leans on a figure: kept for a person to read against the crop, not dropped. */
        needsArtwork: v.optional(v.boolean()),
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
        if (!args.addOnly) await ctx.db.patch("questionGroups", groupId, fields)
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
    const keyConflicts: number[] = []
    for (const question of args.questions) {
      const layout = {
        sequence: question.number,
        groupId: question.group == null ? undefined : groupIdByKey.get(question.group.key),
        groupPosition: question.group?.position,
      }
      const text = { bodyMarkdown: question.stem, options: question.options }
      // Printed in the booklet, so it is settled — not inferred, not scored.
      // Only a new row takes it: a reload reports a difference, never applies it.
      const answer = {
        answerStatus: 'completed' as const,
        answerCorrectOption: question.correctOption,
        answerConfidence: question.answerModelId == null ? 1 : 0.8,
        answerModelId: question.answerModelId ?? 'icfes-booklet-key',
        answerPromptVersion: 'deterministic-v1',
        answerCompletedAt: now,
      }
      const settled = {
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

        // Every new row waits for the audit (stage 10). Once published it joins
        // the placement pool whatever the subtopic tag says: placement reads
        // accuracy per AREA, and the area is certain here.
        eligibility: 'pending' as const,
        eligibilityReasons: question.confidentTag
          ? ['icfes_answer_key', 'keyword_taxonomy_confident']
          : ['icfes_answer_key', 'keyword_taxonomy_low_confidence'],
        eligibilityEvaluatedAt: now,
      }

      const existing = questionByNumber.get(question.number)
      if (existing != null && args.addOnly) continue
      if (existing != null) {
        const audit = await ensureAudit(ctx, existing)
        const textIsSettled = auditSettlesText(audit)
        await ctx.db.patch("questions", existing._id, bookletReloadPatch(existing, textIsSettled ? layout : { ...layout, ...text }, settled))
        if (existing.answerCorrectOption !== question.correctOption) keyConflicts.push(question.number)
        const differences = printedDifferences(audit.history, [
          { field: 'key', stored: existing.answerCorrectOption, printed: question.correctOption },
          ...(textIsSettled
            ? [
                { field: 'stem' as const, stored: existing.bodyMarkdown, printed: question.stem },
                { field: 'options' as const, stored: JSON.stringify(existing.options), printed: JSON.stringify(question.options) },
              ]
            : []),
        ], now)
        if (differences.length > 0) {
          await ctx.db.patch('questionAudits', audit._id, {
            // A rejection is a person's call: the difference is on record and the rejection stands.
            ...(audit.status === 'rejected' ? {} : { status: 'needs_review' as const }),
            history: [...audit.history, ...differences],
            updatedAt: now,
          })
        }
      } else {
        const questionId = await ctx.db.insert('questions', {
          pdfUploadId: args.pdfUploadId,
          questionNumber: question.number,
          createdAt: now,
          ...layout,
          ...text,
          ...answer,
          ...settled,
          ...(args.addOnly ? { bankTier: 'icfes' as const, targetGrade: 11 } : {}),
          ...(question.needsArtwork ? { stemDisplay: 'scan' as const } : {}),
        })
        await ensureAudit(ctx, (await ctx.db.get('questions', questionId))!, question.needsArtwork
          ? { status: 'needs_review', checks: [{ id: 'missing_figure', result: 'warn', detail: 'Depende de una figura: compárala con el recorte.' }] }
          : {})
        inserted += 1
      }
    }

    return { inserted, updated: args.questions.length - inserted, groups: written.size, keyConflicts }
  },
})

/**
 * What a reload may change on a row that already exists. Taxonomy and
 * eligibility belong to the audit from here on; only a question the booklet had
 * dropped takes them back. The key is never here: a printed key that differs is
 * reported as a `keyConflict`, never applied.
 */
export function bookletReloadPatch<C extends object, S extends object>(
  existing: { eligibilityReasons?: string[] },
  content: C,
  settled: S,
): C | (C & S) {
  return existing.eligibilityReasons?.includes('removed_from_booklet') ? { ...content, ...settled } : content
}

/** A person's mark on the audit, or a model's pass over this text: from then on a parser only reports. */
function auditSettlesText(audit: Doc<'questionAudits'>) {
  return audit.reviewedBy != null
    || audit.history.some((entry) => entry.by != null)
    || !['pending_checks', 'needs_review'].includes(audit.status)
}

/**
 * The `printed_reread` entries for what a reload read that the row does not say:
 * each once, and never what a reviewer already replaced on purpose.
 */
function printedDifferences(
  history: Doc<'questionAudits'>['history'],
  fields: { field: 'key' | 'stem' | 'options'; stored: string | undefined; printed: string }[],
  at: number,
): Doc<'questionAudits'>['history'] {
  return fields.flatMap(({ field, stored, printed }) => {
    const ofField = history.filter((entry) => entry.field === field)
    const known = ofField.filter((entry) => entry.source === 'printed_reread').at(-1)?.after === printed
      || ofField.some((entry) => entry.by != null && entry.before === printed)
    return stored === printed || known ? [] : [{ field, before: stored, after: printed, source: 'printed_reread', at }]
  })
}

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

    await ctx.db.patch("pdfUploads", args.pdfUploadId, {
      questionCount: kept.length,
      answerCompletedCount: kept.length,
      taxonomyCompletedCount: kept.length,
      diagnosticEligibleCount: kept.filter((question) => question.eligibility === 'diagnostic').length,
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
    questions: v.array(v.object({
      number: v.number(),
      storageId: v.id('_storage'),
      page: v.optional(v.number()),
      y: v.optional(v.number()),
      pageStorageId: v.optional(v.id('_storage')),
    })),
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
    const orphans: number[] = []
    for (const crop of args.questions) {
      const row = byNumber.get(crop.number)
      if (row == null) {
        orphans.push(crop.number)
        continue
      }
      await ctx.db.patch("questions", row._id, { renderedStemImageId: crop.storageId })
      attached += 1
      if (crop.page == null) continue
      const audit = await ensureAudit(ctx, row)
      await ctx.db.patch('questionAudits', audit._id, {
        source: { ...audit.source, page: crop.page, yStart: crop.y, ...(crop.pageStorageId == null ? {} : { pageImageId: crop.pageStorageId }) },
      })
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

    return { attached, attachedGroups, skipped: args.questions.length - attached, orphans }
  },
})

/** Public URL for a stored crop, resolved at read time. */
export const cropUrl = internalQuery({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => ctx.storage.getUrl(args.storageId),
})
