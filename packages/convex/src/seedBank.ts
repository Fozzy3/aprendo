/**
 * The demo's original question bank: docs/seed-bank/*.json, 100 items written
 * for Aprendo (20 per area), each with its guided path. Rectors only ever see
 * these, so they load like any future bank: pending, with an audit row and a
 * guide that wait for a teacher's signature. `seedDemoBank` then opens them for
 * the demo without marking anything as verified.
 *
 *   bunx convex run seedBank:seedDemoBank
 */
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalAction, internalMutation } from './_generated/server'
import ciencias from '../../../docs/seed-bank/ciencias_naturales.json'
import ingles from '../../../docs/seed-bank/ingles.json'
import lectura from '../../../docs/seed-bank/lectura_critica.json'
import matematicas from '../../../docs/seed-bank/matematicas.json'
import sociales from '../../../docs/seed-bank/sociales_ciudadanas.json'
import taxonomyContract from '../../../docs/taxonomy.v1.json'
import { newAuditRow } from './audit'
import { runDeterministicChecks, type GuideForCheck } from './auditChecks'
import { auditDecision } from './auditDecision'

type SeedItem = {
  id: string
  subjectId: string
  categoryId: string
  primarySubtopicId: string
  competencia: string
  difficulty: string
  targetGrade: number
  context?: string
  stem: string
  options: Array<{ label: string; text: string }>
  correctOption: string
  solution: string
  guide: GuideForCheck
}

export const SEED_ITEMS = [...ciencias, ...ingles, ...lectura, ...matematicas, ...sociales] as unknown as SeedItem[]

const SEED_MODEL_ID = 'aprendo-seed'
const SEED_PROMPT_VERSION = 'seed-v1'

export const seedOptions = (item: SeedItem) => item.options.map((option) => ({ label: option.label, bodyMarkdown: option.text }))

/** A passage only one item reads travels in its body; shared passages become a group. */
export const seedQuestionText = (item: SeedItem, grouped = false) =>
  (grouped || item.context == null ? item.stem : `${item.context}\n\n${item.stem}`)

export const importSeedBank = internalMutation({
  args: { pdfUploadId: v.id('pdfUploads') },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('questions').withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId)).collect()
    const imported = new Set(existing.flatMap((question) => question.seedItemId ?? []))
    // Rows from before `seedItemId` are found by their text, once, and take the id.
    const unkeyed = new Map(existing.filter((question) => question.seedItemId == null).map((question) => [question.bodyMarkdown, question._id]))
    let sequence = existing.length

    // A passage two items share is one group row, written once.
    const readers = new Map<string, SeedItem[]>()
    for (const item of SEED_ITEMS) {
      if (item.context != null) readers.set(item.context, [...(readers.get(item.context) ?? []), item])
    }
    const shared = (item: SeedItem) => item.context != null && (readers.get(item.context)?.length ?? 0) > 1
    const groupIdByContext = new Map<string, Id<'questionGroups'>>()

    const now = Date.now()
    let inserted = 0
    for (const item of SEED_ITEMS) {
      if (imported.has(item.id)) continue
      const bodyMarkdown = seedQuestionText(item, shared(item))
      const unkeyedId = unkeyed.get(bodyMarkdown)
      if (unkeyedId != null) {
        await ctx.db.patch('questions', unkeyedId, { seedItemId: item.id })
        continue
      }
      sequence += 1

      let groupId: Id<'questionGroups'> | undefined
      if (shared(item)) {
        const members = readers.get(item.context!)!
        groupId = groupIdByContext.get(item.context!)
        if (groupId == null) {
          groupId = await ctx.db.insert('questionGroups', {
            pdfUploadId: args.pdfUploadId,
            contextKey: `seed-${members[0]!.id}`,
            contextMarkdown: item.context!,
            firstNumber: sequence,
            lastNumber: sequence + members.length - 1,
            memberCount: members.length,
            createdAt: now,
          })
          groupIdByContext.set(item.context!, groupId)
        }
      }

      const fields = {
        pdfUploadId: args.pdfUploadId,
        questionNumber: sequence,
        sequence,
        seedItemId: item.id,
        bodyMarkdown,
        options: seedOptions(item),
        createdAt: now,
        ...(groupId == null ? {} : { groupId, groupPosition: readers.get(item.context!)!.indexOf(item) }),
        answerStatus: 'completed' as const,
        answerCorrectOption: item.correctOption,
        answerSolutionMarkdown: item.solution,
        answerCompletedAt: now,
        answerModelId: SEED_MODEL_ID,
        answerPromptVersion: SEED_PROMPT_VERSION,
        explanationSource: 'ai_generated' as const,
        taxonomyStatus: 'completed' as const,
        taxonomyVersion: taxonomyContract.taxonomy_version,
        taxonomyRelease: taxonomyContract.taxonomy_release,
        subjectId: item.subjectId,
        categoryId: item.categoryId,
        primarySubtopicId: item.primarySubtopicId,
        secondaryDimensions: [
          { dimension: 'competencia_oficial', value: item.competencia },
          { dimension: 'dificultad_autor', value: item.difficulty },
        ],
        taxonomyCompletedAt: now,
        eligibility: 'pending' as const,
        eligibilityReasons: ['seed_bank'],
        eligibilityEvaluatedAt: now,
        bankTier: 'original' as const,
        stemDisplay: 'text' as const,
        targetGrade: item.targetGrade,
      }
      const questionId = await ctx.db.insert('questions', fields)
      inserted += 1

      await ctx.db.insert('questionGuides', {
        questionId,
        hint: item.guide.hint,
        byOption: item.guide.byOption,
        reveal: item.guide.reveal,
        modelId: SEED_MODEL_ID,
        promptVersion: SEED_PROMPT_VERSION,
        status: 'pending',
        createdAt: now,
      })

      const checks = runDeterministicChecks({
        question: fields,
        group: groupId == null ? null : { contextMarkdown: item.context! },
        unresolvedUrls: [],
        crop: null,
      })
      await ctx.db.insert('questionAudits', newAuditRow({ _id: questionId, subjectId: item.subjectId, answerCorrectOption: item.correctOption }, 'authored', now, {
        checks,
        status: auditDecision(checks, undefined, [], { key: item.correctOption, sourceKind: 'authored' }).status,
        source: { kind: 'authored', licenseNote: 'Texto original escrito para Aprendo.' },
      }))
    }

    await ctx.db.patch('pdfUploads', args.pdfUploadId, { questionCount: existing.length + inserted, updatedAt: now })
    return { inserted, skipped: SEED_ITEMS.length - inserted }
  },
})

/** Opens the pending seed items for the demo. Their audit stays pending: no one has signed them. */
export const publishSeedForDemo = internalMutation({
  args: { pdfUploadId: v.id('pdfUploads') },
  handler: async (ctx, args) => {
    const pending: Doc<'questions'>[] = await ctx.db.query('questions').withIndex('by_pdfUploadId_eligibility', (q) => q.eq('pdfUploadId', args.pdfUploadId).eq('eligibility', 'pending')).collect()
    const now = Date.now()
    let published = 0
    // The upload is shared with the AI-generated items, which wait for their own review.
    for (const question of pending.filter((row) => row.eligibilityReasons?.includes('seed_bank'))) {
      const audit = await ctx.db.query('questionAudits').withIndex('by_questionId', (q) => q.eq('questionId', question._id)).unique()
      if (audit?.status === 'rejected') continue
      await ctx.db.patch('questions', question._id, { eligibility: 'diagnostic', eligibilityReasons: ['seed_demo'], eligibilityEvaluatedAt: now })
      published += 1
    }
    return { published }
  },
})

export const seedDemoBank = internalAction({
  args: {},
  handler: async (ctx): Promise<{ inserted: number; skipped: number; published: number }> => {
    const upload = await ctx.runQuery(internal.generatedQuestions.findAiUpload, {})
    const pdfUploadId: Id<'pdfUploads'> = upload?._id
      ?? await ctx.runMutation(internal.generatedQuestions.createAiUpload, {
        pdfStorageId: await ctx.storage.store(new Blob(['aprendo-seed-bank'])),
      })
    const imported = await ctx.runMutation(internal.seedBank.importSeedBank, { pdfUploadId })
    const { published } = await ctx.runMutation(internal.seedBank.publishSeedForDemo, { pdfUploadId })
    return { ...imported, published }
  },
})
