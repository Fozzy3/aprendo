/**
 * The question audit (F62-F65): one row per question, from inventory to a
 * person's signature. Every model here only leaves an opinion in the row; only a
 * reviewer writes to the question. See plans/reconstruccion-estudiante-y-banco.md.
 *
 * Run by hand, a pilot first:
 *   bunx convex run audit:startInventory
 *   bunx convex run audit:runAuditBatch '{"limit": 20}'
 *   bunx convex run audit:drawAuditSample '{"seed": "2026-11"}'
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server'
import { tagQuestionTaxonomy, type TaxonomyContract } from '@aprendo/ingest/question-enrichment-core'
import taxonomyContractJson from '../../../docs/taxonomy.v1.json'
import { aprendoModel } from './aiProvider'
import { requireAuthenticatedStudentId, requirePlatformAdmin, requireReviewer } from './auth'
import {
  checkOptionCount,
  checkOptionsFilled,
  duplicateStemIndex,
  markdownImageUrls,
  matchOcrPage,
  runDeterministicChecks,
  validateGuide,
  type AuditCheck,
  type CheckGroup,
  type CheckQuestion,
  type GuideForCheck,
} from './auditChecks'
import {
  auditDecision,
  auditRank,
  keyChangeStep,
  keyProposalSource,
  keyTextProposal,
  pendingKeyProposal,
  proposedKeyText,
  proposedStemDisplay,
  publishedEligibility,
  repairedIsCorrect,
  selectAuditSample,
  type Solver,
  type Vision,
} from './auditDecision'
import { AI_UPLOAD_SLUG, questionSource } from './questionSource'
import { computeSessionSummary } from './sessions'
import { SUBJECT_IDS, getSubtopicContext } from './taxonomy'
import { questionAuditDocumentValidator, questionGuideDocumentValidator, questionOptionValidator } from './validators'

export const AUDIT_PIPELINE_VERSION = 'audit-v1'
export const BOOKLET_CONTENT_TYPE = 'application/x-aprendo-icfes-booklet'

/** Two vendors with vision, so one family's blind spot cannot agree with itself. */
export const AUDIT_SOLVER_MODELS = ['google/gemini-3.8-flash', 'anthropic/claude-sonnet-5'] as const
const VISION_MODEL = 'google/gemini-3.8-flash'
const GUIDE_MODEL = 'anthropic/claude-sonnet-5'
const GUIDE_PROMPT_VERSION = 'guide-v1'

const BATCH_SIZE = 20
const INVENTORY_PAGE = 200
const REPAIR_PAGE = 50
const SAMPLE_FLOOR = 60

const taxonomyContract = taxonomyContractJson as TaxonomyContract

type AuditRow = Doc<'questionAudits'>
type HistoryEntry = AuditRow['history'][number]

function sourceKindOf(upload: Pick<Doc<'pdfUploads'>, 'contentType' | 'slug'> | null): AuditRow['source']['kind'] {
  if (upload?.slug === AI_UPLOAD_SLUG) return 'authored'
  return upload?.contentType === BOOKLET_CONTENT_TYPE ? 'booklet' : 'ocr'
}

/** A new row: the current key opens the history, so every later change is visible. */
export function newAuditRow(
  question: Pick<Doc<'questions'>, '_id' | 'subjectId' | 'answerCorrectOption'>,
  kind: AuditRow['source']['kind'],
  now: number,
  extra: Partial<AuditRow> = {},
): Omit<AuditRow, '_id' | '_creationTime'> {
  return {
    questionId: question._id,
    subjectId: question.subjectId ?? '',
    status: 'pending_checks',
    pipelineVersion: AUDIT_PIPELINE_VERSION,
    source: { kind },
    checks: [],
    solvers: [],
    history: [{ field: 'key', after: question.answerCorrectOption, source: 'inventory', at: now }],
    updatedAt: now,
    ...extra,
  }
}

const findAudit = (ctx: Pick<QueryCtx, 'db'>, questionId: Id<'questions'>) =>
  ctx.db.query('questionAudits').withIndex('by_questionId', (q) => q.eq('questionId', questionId)).unique()

/** The question's audit row, created the first time it is needed. */
export async function ensureAudit(ctx: MutationCtx, question: Doc<'questions'>, extra: Partial<AuditRow> = {}): Promise<AuditRow> {
  const existing = await findAudit(ctx, question._id)
  if (existing != null) return existing
  const upload = await ctx.db.get('pdfUploads', question.pdfUploadId)
  const id = await ctx.db.insert('questionAudits', newAuditRow(question, sourceKindOf(upload), Date.now(), extra))
  return (await ctx.db.get('questionAudits', id))!
}

/** An open report on the answer or the image sends the question back to a person. */
export async function returnToReview(ctx: MutationCtx, questionId: Id<'questions'>) {
  const question = await ctx.db.get('questions', questionId)
  if (question == null) return
  const audit = await ensureAudit(ctx, question, { status: 'needs_review' })
  // Still in the pipeline: it reaches a person when the checks say so. Rejected is a person's call: it stands.
  if (audit.status !== 'needs_review' && audit.status !== 'pending_checks' && audit.status !== 'rejected') {
    await ctx.db.patch('questionAudits', audit._id, { status: 'needs_review', updatedAt: Date.now() })
  }
}

/** Grants the audit tab for those areas; run by hand when a teacher is hired. */
export const grantReviewer = internalMutation({
  args: { email: v.string(), subjects: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (args.subjects.some((subject) => !SUBJECT_IDS.includes(subject))) throw new ConvexError('Área no válida.')
    const normalized = args.email.trim().toLowerCase()
    const student = await ctx.db.query('students').withIndex('by_normalizedEmail', (q) => q.eq('normalizedEmail', normalized)).unique()
    if (student == null) return { granted: false }
    await ctx.db.patch('students', student._id, { reviewerSubjects: args.subjects, updatedAt: Date.now() })
    return { granted: true }
  },
})

export const startInventory = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query('questions').paginate({ numItems: INVENTORY_PAGE, cursor: args.cursor ?? null })
    for (const question of page.page) await ensureAudit(ctx, question)
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.audit.startInventory, { cursor: page.continueCursor })
    return { audited: page.page.length, done: page.isDone }
  },
})

/** The real count by source and status (the plan's documented figures disagree). */
export const inventoryCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const audits = await ctx.db.query('questionAudits').collect()
    const counts = new Map<string, number>()
    for (const audit of audits) {
      const key = `${audit.source.kind}|${audit.subjectId}|${audit.status}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts].map(([key, count]) => ({ key, count }))
  },
})

export type BlindView = { bodyMarkdown: string; contextMarkdown?: string; options: Array<{ label: string; bodyMarkdown: string }>; images: string[] }

export type AuditItem = {
  auditId: Id<'questionAudits'>
  sourceKind: AuditRow['source']['kind']
  question: CheckQuestion & { answerSolutionMarkdown?: string; taxonomyModelId?: string; taxonomyStatus?: string }
  group: CheckGroup | null
  cropUrl: string | null
  groupCropUrl: string | null
  pageImageUrl: string | null
  crop: { size: number; contentType?: string } | null
  printedKey?: string
  duplicateOf?: string
  ocrPagesUrl?: string | null
}

/** What a solver may see. Built field by field: nothing about the answer can slip in. */
export function blindView(item: AuditItem): BlindView {
  return {
    bodyMarkdown: item.question.bodyMarkdown,
    ...(item.group == null ? {} : { contextMarkdown: item.group.contextMarkdown }),
    options: item.question.options,
    images: [item.cropUrl, item.groupCropUrl, ...(item.group?.contextImages ?? [])].filter((url): url is string => url != null),
  }
}

export function solverPrompt(view: BlindView) {
  return [
    'Solve this multiple-choice question from the Colombian Saber 11 exam. The attached images are the question as printed.',
    'Answer with the label of the single best option and your confidence between 0 and 1.',
    '',
    ...(view.contextMarkdown == null ? [] : ['## Shared stimulus', view.contextMarkdown, '']),
    '## Question',
    view.bodyMarkdown,
    '',
    '## Options',
    ...view.options.map((option) => `- ${option.label}. ${option.bodyMarkdown}`),
  ].join('\n')
}

export function needsRetag(question: { taxonomyModelId?: string; taxonomyStatus?: string }) {
  return question.taxonomyModelId === 'keyword-rules' || question.taxonomyStatus !== 'completed'
}

export type AuditDeps = {
  compareVision: (input: { item: AuditItem; images: string[] }) => Promise<Vision>
  solvers: Array<(view: BlindView) => Promise<Solver>>
  retag: (view: BlindView) => Promise<Awaited<ReturnType<typeof tagQuestionTaxonomy>>>
  urlResolves: (url: string) => Promise<boolean>
  loadOcrPages?: (url: string | null | undefined) => Promise<Array<{ pageNumber: number; markdown: string }>>
}

/**
 * Stages 3-6 for one question. Injected so tests never reach a model; a question
 * that already failed hard spends no model call.
 */
export async function auditItem(item: AuditItem, deps: AuditDeps) {
  const { question, group } = item
  const text = [group?.contextMarkdown ?? '', question.bodyMarkdown, ...question.options.map((option) => option.bodyMarkdown)].join('\n')
  const urls = [...new Set([...markdownImageUrls(text), ...(group?.contextImages ?? [])].filter((url) => /^https?:\/\//.test(url)))]
  const unresolvedUrls: string[] = []
  for (const url of urls) {
    if (!(await deps.urlResolves(url))) unresolvedUrls.push(url)
  }

  const checks = runDeterministicChecks({
    question,
    group,
    printedKey: item.printedKey,
    unresolvedUrls,
    crop: item.crop,
    duplicateOf: item.duplicateOf,
  })

  let page: number | undefined
  if (item.sourceKind === 'ocr' && deps.loadOcrPages != null) {
    page = matchOcrPage(question.bodyMarkdown, await deps.loadOcrPages(item.ocrPagesUrl)) ?? undefined
  }

  if (checks.some((check) => check.result === 'fail')) return { checks, vision: undefined, solvers: [] as Solver[], retag: undefined, page }

  const images = [item.pageImageUrl, item.cropUrl, item.groupCropUrl].filter((url): url is string => url != null)
  const vision = item.sourceKind === 'authored' || images.length === 0 ? undefined : await deps.compareVision({ item, images })

  const view = blindView(item)
  const solvers = await Promise.all(deps.solvers.map((solve) => solve(view)))
  const retag = needsRetag(question) ? await deps.retag(view) : undefined
  return { checks, vision, solvers, retag, page }
}

const imageParts = (urls: string[]) => urls.map((url) => ({ type: 'image' as const, image: new URL(url) }))

const SOLVER_SCHEMA = z.object({ option: z.string(), confidence: z.number().min(0).max(1) })

const VISION_SCHEMA = z.object({
  stemMatches: z.boolean().describe('The stored stem says the same as the page, word for word in substance.'),
  optionsMatch: z.boolean().describe('Every stored option matches the printed one under the same letter.'),
  figureNeeded: z.boolean().describe('A figure, table or diagram is needed to answer.'),
  figureLegible: z.boolean().describe('Any needed figure is legible in the crop.'),
  textSufficient: z.boolean().describe('The stored text alone is enough to answer, with no image at all.'),
})

const visionPrompt = (item: AuditItem) => [
  'Compare the printed exam question in these images (the whole page, and a crop of the question) with the text we stored for it.',
  'Report only what you can see. Say so if an option or a figure is missing.',
  '',
  '## Stored stem',
  item.question.bodyMarkdown,
  '',
  '## Stored options',
  ...item.question.options.map((option) => `- ${option.label}. ${option.bodyMarkdown}`),
].join('\n')

function liveDeps(): AuditDeps {
  const pages = new Map<string, Array<{ pageNumber: number; markdown: string }>>()
  return {
    compareVision: async ({ item, images }) => {
      const { object } = await generateObject({
        model: aprendoModel(VISION_MODEL),
        schema: VISION_SCHEMA,
        messages: [{ role: 'user', content: [{ type: 'text', text: visionPrompt(item) }, ...imageParts(images)] }],
      })
      return { ...object, modelId: VISION_MODEL }
    },
    solvers: AUDIT_SOLVER_MODELS.map((modelId) => async (view) => {
      const { object } = await generateObject({
        model: aprendoModel(modelId),
        schema: SOLVER_SCHEMA,
        messages: [{ role: 'user', content: [{ type: 'text', text: solverPrompt(view) }, ...imageParts(view.images)] }],
      })
      return { modelId, option: object.option.trim().toUpperCase(), confidence: object.confidence }
    }),
    retag: async (view) => {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error('Falta GEMINI_API_KEY para el reetiquetado.')
      return tagQuestionTaxonomy({ apiKey, question: { ...view, images: view.images.map((url) => ({ url })) }, taxonomy: taxonomyContract })
    },
    urlResolves: async (url) => {
      try {
        return (await fetch(url, { method: 'HEAD' })).ok
      } catch {
        return false
      }
    },
    loadOcrPages: async (url) => {
      if (url == null) return []
      if (!pages.has(url)) pages.set(url, await (await fetch(url)).json())
      return pages.get(url)!
    },
  }
}

export const loadAuditBatch = internalQuery({
  args: { limit: v.number(), skipIds: v.optional(v.array(v.id('questionAudits'))) },
  handler: async (ctx, args): Promise<AuditItem[]> => {
    const skip = new Set(args.skipIds ?? [])
    const audits: AuditRow[] = []
    for (const subjectId of [...SUBJECT_IDS, '']) {
      if (audits.length >= args.limit) break
      const rows = await ctx.db.query('questionAudits')
        .withIndex('by_subjectId_status', (q) => q.eq('subjectId', subjectId).eq('status', 'pending_checks'))
        .take(args.limit + skip.size)
      audits.push(...rows.filter((row) => !skip.has(row._id)))
    }

    // ponytail: reads the whole bank; when it nears the query limit, match duplicates per subject.
    const bank = await ctx.db.query('questions').collect()
    const duplicates = duplicateStemIndex(bank)
    const items: AuditItem[] = []
    for (const audit of audits.slice(0, args.limit)) {
      const question = await ctx.db.get('questions', audit.questionId)
      if (question == null) continue
      const group = question.groupId == null ? null : await ctx.db.get('questionGroups', question.groupId)
      const cropMeta = question.renderedStemImageId == null ? null : await ctx.db.system.get('_storage', question.renderedStemImageId)
      const upload = audit.source.kind === 'ocr' ? await ctx.db.get('pdfUploads', question.pdfUploadId) : null
      items.push({
        auditId: audit._id,
        sourceKind: audit.source.kind,
        question,
        group,
        cropUrl: question.renderedStemImageId == null ? null : await ctx.storage.getUrl(question.renderedStemImageId),
        groupCropUrl: group?.renderedContextImageId == null ? null : await ctx.storage.getUrl(group.renderedContextImageId),
        pageImageUrl: audit.source.pageImageId == null ? null : await ctx.storage.getUrl(audit.source.pageImageId),
        crop: cropMeta == null ? null : { size: cropMeta.size, contentType: cropMeta.contentType },
        printedKey: audit.history.filter((entry) => entry.field === 'key' && entry.source === 'printed_reread').at(-1)?.after,
        duplicateOf: duplicates.get(question._id),
        ocrPagesUrl: upload?.ocrPagesStorageId == null ? null : await ctx.storage.getUrl(upload.ocrPagesStorageId),
      })
    }
    return items
  },
})

const retagValidator = v.object({
  status: v.literal('completed'),
  taxonomyVersion: v.string(),
  taxonomyRelease: v.string(),
  subjectId: v.string(),
  categoryId: v.string(),
  primarySubtopicId: v.string(),
  secondarySubtopicIds: v.array(v.string()),
  secondaryDimensions: v.array(v.object({ dimension: v.string(), value: v.string() })),
  confidence: v.number(),
  modelId: v.string(),
  promptVersion: v.string(),
})

/** Stages 6-7 land here: the re-tag touches the taxonomy fields and nothing else. */
export const recordAuditResult = internalMutation({
  args: {
    auditId: v.id('questionAudits'),
    checks: questionAuditDocumentValidator.fields.checks,
    vision: questionAuditDocumentValidator.fields.vision,
    solvers: questionAuditDocumentValidator.fields.solvers,
    retag: v.optional(retagValidator),
    page: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const audit = await ctx.db.get('questionAudits', args.auditId)
    if (audit == null) return
    const question = await ctx.db.get('questions', audit.questionId)
    if (question == null) return

    const now = Date.now()
    const history: HistoryEntry[] = []
    let retagged = false
    if (args.retag != null && args.retag.subjectId === audit.subjectId) {
      const { status, confidence, modelId, promptVersion, ...tags } = args.retag
      await ctx.db.patch('questions', question._id, {
        ...tags,
        taxonomyStatus: status,
        taggingConfidence: confidence,
        taxonomyModelId: modelId,
        taxonomyPromptVersion: promptVersion,
        taxonomyCompletedAt: now,
      })
      history.push({ field: 'taxonomy', before: question.primarySubtopicId, after: args.retag.primarySubtopicId, source: modelId, at: now })
      retagged = question.primarySubtopicId !== args.retag.primarySubtopicId
    }

    const decision = auditDecision(args.checks as AuditCheck[], args.vision, args.solvers, {
      key: question.answerCorrectOption,
      sourceKind: audit.source.kind,
    })

    await ctx.db.patch('questionAudits', audit._id, {
      status: decision.status,
      checks: args.checks,
      vision: args.vision,
      solvers: args.solvers,
      source: args.page == null ? audit.source : { ...audit.source, page: args.page },
      history: [...audit.history, ...history],
      updatedAt: now,
    })

    if (decision.exclude) {
      await ctx.db.patch('questions', question._id, {
        eligibility: 'excluded',
        eligibilityReasons: ['audit_hard_failure'],
        eligibilityEvaluatedAt: now,
        ...(decision.status === 'rejected' ? { voidedAt: now } : {}),
      })
    }
    // Answers filed under the old subtopic, or graded on a question now voided, are rebuilt.
    if (retagged || decision.status === 'rejected') await startRepair(ctx, audit, false)
    return decision
  },
})

/** Stages 3-7 for a batch of questions. A model failure leaves its row untouched for the next run. */
export const runAuditBatch = internalAction({
  args: { limit: v.optional(v.number()), skipIds: v.optional(v.array(v.id('questionAudits'))), continue: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ processed: number; failedIds: string[] }> => {
    const limit = args.limit ?? BATCH_SIZE
    const items: AuditItem[] = await ctx.runQuery(internal.audit.loadAuditBatch, { limit, skipIds: args.skipIds })
    const deps = liveDeps()
    const failedIds: Id<'questionAudits'>[] = [...(args.skipIds ?? [])]
    let processed = 0
    for (const item of items) {
      try {
        const { retag, ...result } = await auditItem(item, deps)
        await ctx.runMutation(internal.audit.recordAuditResult, {
          auditId: item.auditId,
          ...result,
          ...(retag == null ? {} : { retag: { status: 'completed' as const, ...retag } }),
        })
        processed += 1
      } catch (error) {
        console.warn(`audit ${item.auditId} failed:`, error)
        failedIds.push(item.auditId)
      }
    }
    if (args.continue && items.length === limit) {
      await ctx.scheduler.runAfter(0, internal.audit.runAuditBatch, { limit, skipIds: failedIds, continue: true })
    }
    return { processed, failedIds }
  },
})

/** Stage 8. Rate 1 is today's rule: the current bank is reviewed whole. */
export const drawAuditSample = internalMutation({
  args: { seed: v.string(), rate: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const passed: AuditRow[] = []
    for (const subjectId of SUBJECT_IDS) {
      passed.push(...await ctx.db.query('questionAudits')
        .withIndex('by_subjectId_status', (q) => q.eq('subjectId', subjectId).eq('status', 'auto_passed'))
        .collect())
    }
    const rows = await Promise.all(passed.map(async (audit) => ({
      id: audit._id as string,
      subjectId: audit.subjectId,
      subtopicId: (await ctx.db.get('questions', audit.questionId))?.primarySubtopicId,
    })))
    const chosen = selectAuditSample(rows, { seed: args.seed, rate: args.rate ?? 1, floor: SAMPLE_FLOOR })
    for (const audit of passed) await ctx.db.patch('questionAudits', audit._id, { sampled: chosen.has(audit._id) })
    return { passed: passed.length, sampled: chosen.size }
  },
})

/** Stage 10 for what no person had to read. An original item always waits for a signature. */
export const publishAutoPassed = internalMutation({
  args: {},
  handler: async (ctx) => {
    let published = 0
    for (const subjectId of SUBJECT_IDS) {
      const audits = await ctx.db.query('questionAudits')
        .withIndex('by_subjectId_status', (q) => q.eq('subjectId', subjectId).eq('status', 'auto_passed'))
        .collect()
      for (const audit of audits.filter((row) => row.sampled === false)) {
        const question = await ctx.db.get('questions', audit.questionId)
        if (question == null || question.bankTier === 'original') continue
        await publish(ctx, audit, question)
        published += 1
      }
    }
    return { published }
  },
})

/** Publishing: into the pool, the text if vision says it stands alone, and only then a guide. */
async function publish(ctx: MutationCtx, audit: AuditRow, question: Doc<'questions'>) {
  const stemDisplay = question.stemDisplay ?? proposedStemDisplay(audit.vision, question.renderedStemImageId != null)
  await ctx.db.patch('questions', question._id, {
    eligibility: publishedEligibility(question),
    eligibilityReasons: ['audit_approved'],
    eligibilityEvaluatedAt: Date.now(),
    voidedAt: undefined,
    ...(stemDisplay == null ? {} : { stemDisplay }),
  })
  // Back in the bank: its answers count again.
  if (question.voidedAt != null) await startRepair(ctx, audit, false)

  // G1: a guide is new text on top of an item, so ICFES items get none.
  if (question.bankTier !== 'original') return
  const guide = await ctx.db.query('questionGuides').withIndex('by_questionId', (q) => q.eq('questionId', question._id)).unique()
  if (guide == null || guide.status === 'rejected') {
    await ctx.scheduler.runAfter(0, internal.audit.generateGuide, { questionId: question._id })
  }
}

const reviewerRole = (reviewer: { isAdmin: boolean }) => (reviewer.isAdmin ? 'admin' as const : 'teacher' as const)

const reviewPatch = (reviewerId: Id<'students'>, status: AuditRow['status'], note: string | undefined, now: number) => ({
  status,
  reviewedBy: reviewerId,
  reviewedAt: now,
  updatedAt: now,
  ...(note == null ? {} : { reviewNote: note }),
})

async function loadForReview(ctx: QueryCtx, auditId: Id<'questionAudits'>) {
  const audit = await ctx.db.get('questionAudits', auditId)
  if (audit == null) throw new ConvexError('Auditoría no encontrada.')
  const reviewer = await requireReviewer(ctx, audit.subjectId)
  const question = await ctx.db.get('questions', audit.questionId)
  if (question == null) throw new ConvexError('Pregunta no encontrada.')
  return { audit, question, reviewer }
}

export const approveAudit = mutation({
  args: { auditId: v.id('questionAudits'), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { audit, question, reviewer } = await loadForReview(ctx, args.auditId)
    if (question.answerCorrectOption == null) throw new ConvexError('La pregunta no tiene clave: corrígela antes de aprobar.')

    const now = Date.now()
    if (pendingKeyProposal(audit.history) != null) {
      throw new ConvexError('Esta clave está en disputa: firma o descarta la propuesta antes de aprobar.')
    }
    const next = { ...audit, ...reviewPatch(reviewer.studentId, 'approved', args.note, now) }
    await ctx.db.patch('questionAudits', audit._id, reviewPatch(reviewer.studentId, 'approved', args.note, now))
    await publish(ctx, next, question)
    return { approved: true }
  },
})

type FixArgs = {
  stem?: string
  options?: Doc<'questions'>['options']
  key?: string
  subtopicId?: string
  stemDisplay?: 'text' | 'scan'
  note?: string
}

/** A correction. Only `signKeyProposal` passes `signing`: a plain fix never completes a second signature. */
async function applyFix(
  ctx: MutationCtx,
  { audit, question, reviewer }: Awaited<ReturnType<typeof loadForReview>>,
  args: FixArgs,
  signing = false,
) {
  const now = Date.now()
  const history: HistoryEntry[] = [...audit.history]
  const patch: Partial<Doc<'questions'>> = {}
  const entry = (field: HistoryEntry['field'], before: string | undefined, after: string | undefined, source: string) =>
    history.push({ field, before, after, source, by: reviewer.studentId, at: now })
  const role = reviewerRole(reviewer)
  const signature = (change: string) => {
    const step = keyChangeStep(history, { key: change, by: reviewer.studentId, role })
    if (step === 'wait') throw new ConvexError('Esta clave ya tiene una propuesta pendiente: falta la firma de la otra persona (un docente y un administrador).')
    if (step === 'apply' && !signing) throw new ConvexError('Esa propuesta se resuelve con «Firmar propuesta».')
    return step
  }
  const keyIsChanging = args.key != null && args.key !== question.answerCorrectOption
  const textChanged = (edited: { label: string; bodyMarkdown: string } | undefined) =>
    edited != null && edited.bodyMarkdown !== question.options.find((option) => option.label === edited.label)?.bodyMarkdown
  let keyChange: 'proposed' | 'applied' | null = null

  if (args.stem != null && args.stem !== question.bodyMarkdown) {
    if (args.stem.trim().length === 0) throw new ConvexError('El enunciado no puede quedar vacío.')
    patch.bodyMarkdown = args.stem
    entry('stem', question.bodyMarkdown, args.stem, 'review')
  }

  if (args.options != null) {
    const sameLabels = args.options.map((option) => option.label).join() === question.options.map((option) => option.label).join()
    if (!sameLabels || checkOptionCount(args.options).result === 'fail' || checkOptionsFilled(args.options).result === 'fail') {
      throw new ConvexError('Las opciones deben conservar sus letras y no pueden quedar vacías.')
    }
    const keyed = args.options.find((option) => option.label === question.answerCorrectOption)
    const keyTextChanged = textChanged(keyed)
    const targetTextChanged = textChanged(args.options.find((option) => option.label === args.key))
    if (keyIsChanging && (keyTextChanged || targetTextChanged)) {
      throw new ConvexError('Cambia la clave y el texto de su opción por separado.')
    }
    const proposal = keyTextChanged ? keyTextProposal(keyed!.bodyMarkdown) : null
    const step = proposal == null ? 'apply' : signature(proposal)
    if (step === 'propose') {
      entry('key', question.answerCorrectOption, proposal!, keyProposalSource(role))
      keyChange = 'proposed'
      // Only the keyed option waits; a typo in another one needs one signature.
      const held = args.options.map((option) => (option.label === keyed!.label ? question.options.find((current) => current.label === keyed!.label)! : option))
      if (JSON.stringify(held) !== JSON.stringify(question.options)) {
        patch.options = held
        entry('options', JSON.stringify(question.options), JSON.stringify(held), 'review')
      }
    } else if (JSON.stringify(args.options) !== JSON.stringify(question.options)) {
      patch.options = args.options
      entry('options', JSON.stringify(question.options), JSON.stringify(args.options), 'review')
      if (proposal != null) {
        entry('key', question.answerCorrectOption, proposal, 'key_text_applied')
        keyChange = 'applied'
      }
    }
  }

  let retagged = false
  if (args.subtopicId != null && args.subtopicId !== question.primarySubtopicId) {
    const context = getSubtopicContext(args.subtopicId)
    if (context == null || context.subjectId !== audit.subjectId) throw new ConvexError('Ese subtema no pertenece a esta área.')
    patch.categoryId = context.categoryId
    patch.primarySubtopicId = context.subtopicId
    entry('taxonomy', question.primarySubtopicId, context.subtopicId, 'review')
    retagged = true
  }

  if (args.stemDisplay != null) patch.stemDisplay = args.stemDisplay

  let keyMoved = false
  if (args.key != null && args.key !== question.answerCorrectOption) {
    if (!question.options.some((option) => option.label === args.key)) throw new ConvexError('La clave debe ser una de las opciones.')
    if (signature(args.key) === 'propose') {
      entry('key', question.answerCorrectOption, args.key, keyProposalSource(role))
      keyChange = 'proposed'
    } else {
      entry('key', question.answerCorrectOption, args.key, 'key_applied')
      // Convex removes a field patched with undefined: the old explanation goes, the key never does.
      Object.assign(patch, { answerCorrectOption: args.key, answerSolutionMarkdown: undefined, answerDistractorRationales: undefined })
      keyChange = 'applied'
      keyMoved = true
    }
  }

  if (Object.keys(patch).length > 0) await ctx.db.patch('questions', question._id, patch)

  // A guide is written on the text and the key it saw: either changing voids it.
  if (keyMoved || patch.bodyMarkdown != null || patch.options != null) {
    const guide = await ctx.db.query('questionGuides').withIndex('by_questionId', (q) => q.eq('questionId', question._id)).unique()
    if (guide != null) await ctx.db.patch('questionGuides', guide._id, { status: 'rejected' })
  }
  if (keyMoved || retagged) await startRepair(ctx, audit, keyMoved)

  const waitingForSecondSignature = pendingKeyProposal(history) != null
  await ctx.db.patch('questionAudits', audit._id, {
    ...(waitingForSecondSignature
      ? { status: 'needs_review' as const, updatedAt: now, ...(args.note == null ? {} : { reviewNote: args.note }) }
      : reviewPatch(reviewer.studentId, 'fixed', args.note, now)),
    history,
  })

  if (!waitingForSecondSignature) await publish(ctx, { ...audit, history }, { ...question, ...patch })
  return { keyChange }
}

export const fixAudit = mutation({
  args: {
    auditId: v.id('questionAudits'),
    stem: v.optional(v.string()),
    options: v.optional(v.array(questionOptionValidator)),
    key: v.optional(v.string()),
    subtopicId: v.optional(v.string()),
    stemDisplay: v.optional(v.union(v.literal('text'), v.literal('scan'))),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { auditId, ...fix }) => applyFix(ctx, await loadForReview(ctx, auditId), fix),
})

function requireProposal(audit: AuditRow) {
  const pending = pendingKeyProposal(audit.history)
  if (pending == null) throw new ConvexError('Esta pregunta no tiene una propuesta pendiente.')
  return pending
}

/** "Firmar propuesta": the second signature, the only way a proposal is applied. */
export const signKeyProposal = mutation({
  args: { auditId: v.id('questionAudits'), note: v.optional(v.string()) },
  handler: async (ctx, { auditId, note }) => {
    const loaded = await loadForReview(ctx, auditId)
    const { question } = loaded
    const pending = requireProposal(loaded.audit)
    const text = proposedKeyText(pending.after)
    const change = text == null
      ? { key: pending.after! }
      : { options: question.options.map((option) => (option.label === question.answerCorrectOption ? { ...option, bodyMarkdown: text } : option)) }
    return applyFix(ctx, loaded, { ...change, note }, true)
  },
})

/** "Descartar propuesta": settles a disputed key, so it takes the second signature too. The question still waits for its approval. */
export const dismissKeyProposal = mutation({
  args: { auditId: v.id('questionAudits'), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { audit, question, reviewer } = await loadForReview(ctx, args.auditId)
    const pending = requireProposal(audit)
    if (keyChangeStep(audit.history, { key: pending.after!, by: reviewer.studentId, role: reviewerRole(reviewer) }) !== 'apply') {
      throw new ConvexError('Esta clave está en disputa: la propuesta la resuelve la firma de la otra persona (un docente y un administrador).')
    }
    const now = Date.now()
    await ctx.db.patch('questionAudits', audit._id, {
      history: [...audit.history, { field: 'key', before: question.answerCorrectOption, after: question.answerCorrectOption, source: 'key_proposal_dismissed', by: reviewer.studentId, at: now }],
      updatedAt: now,
      ...(args.note == null ? {} : { reviewNote: args.note }),
    })
    return { dismissed: true }
  },
})

export const rejectAudit = mutation({
  args: { auditId: v.id('questionAudits'), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { audit, question, reviewer } = await loadForReview(ctx, args.auditId)
    const now = Date.now()
    await ctx.db.patch('questionAudits', audit._id, reviewPatch(reviewer.studentId, 'rejected', args.note, now))
    await ctx.db.patch('questions', question._id, {
      eligibility: 'excluded',
      eligibilityReasons: ['audit_rejected'],
      eligibilityEvaluatedAt: now,
      voidedAt: now,
    })
    await startRepair(ctx, audit, false)
    return { rejected: true }
  },
})

/** Opens a repair on the audit row; a regrade already running is never downgraded to a rebuild. */
async function startRepair(ctx: MutationCtx, audit: AuditRow, regrade: boolean) {
  const running = (await ctx.db.get('questionAudits', audit._id))?.repair
  await ctx.db.patch('questionAudits', audit._id, {
    repair: { status: 'running', regrade: regrade || (running?.status === 'running' && running.regrade), repaired: 0, updatedAt: Date.now() },
  })
  await ctx.scheduler.runAfter(0, internal.audit.repairAttempts, { questionId: audit.questionId })
}

/**
 * After a key changes (`regrade`) or a question is voided: recompute the answers
 * it touched against the key current on each page, keep what each student
 * picked, and rebuild their aggregates. One page per run, and one job per
 * session's score: a question can have thousands of attempts. Each page commits
 * where it got to on the audit row, so a run that fails leaves `running` with
 * its cursor, and running this again resumes it.
 */
export const repairAttempts = internalMutation({
  args: { questionId: v.id('questions') },
  handler: async (ctx, args) => {
    const [audit, question] = await Promise.all([findAudit(ctx, args.questionId), ctx.db.get('questions', args.questionId)])
    if (audit?.repair?.status !== 'running' || question == null) return { repaired: 0 }
    const { regrade, cursor, repaired } = audit.repair

    const page = await ctx.db.query('questionAttempts')
      .withIndex('by_questionId', (q) => q.eq('questionId', args.questionId))
      .paginate({ numItems: REPAIR_PAGE, cursor: cursor ?? null })

    const key = regrade ? question.answerCorrectOption : undefined
    if (key != null) {
      for (const attempt of page.page) {
        if (attempt.selectedOption == null || attempt.isCorrect == null) continue
        await ctx.db.patch('questionAttempts', attempt._id, { isCorrect: repairedIsCorrect(attempt.selectedOption, key) })
      }
      for (const sessionId of new Set(page.page.map((attempt) => attempt.sessionId))) {
        await ctx.scheduler.runAfter(0, internal.audit.recomputeSessionSummary, { sessionId })
      }
    }

    for (const studentId of new Set(page.page.map((attempt) => attempt.studentId))) {
      await ctx.scheduler.runAfter(0, internal.progress.rebuildStudentProgress, { studentId })
    }
    await ctx.db.patch('questionAudits', audit._id, {
      repair: {
        status: page.isDone ? 'done' : 'running',
        regrade,
        repaired: repaired + page.page.length,
        updatedAt: Date.now(),
        ...(page.isDone ? {} : { cursor: page.continueCursor }),
      },
    })
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.audit.repairAttempts, { questionId: args.questionId })
    return { repaired: page.page.length }
  },
})

/** One session's scores after a repair: on its own, so no page of them can outgrow a transaction. */
export const recomputeSessionSummary = internalMutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get('sessions', sessionId)
    if (session?.status !== 'completed' || session.summary == null) return
    const [sessionQuestions, attempts] = await Promise.all([
      ctx.db.query('sessionQuestions').withIndex('by_sessionId_position', (q) => q.eq('sessionId', sessionId)).collect(),
      ctx.db.query('questionAttempts').withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId)).collect(),
    ])
    const questionIds = [...new Set(sessionQuestions.map((row) => row.questionId))]
    const byId = new Map(await Promise.all(questionIds.map(async (id) => [id, await ctx.db.get('questions', id)] as const)))
    await ctx.db.patch('sessions', sessionId, {
      summary: computeSessionSummary(session, sessionQuestions, sessionQuestions.map((row) => byId.get(row.questionId) ?? null), attempts, session.summary.durationMs),
    })
  },
})

/** The history source of a correction made against the printed page, by a model: no person signed it. */
const PAGE_REVIEW_SOURCE = 'ai_page_review'

const pageReviewGroupValidator = v.object({
  key: v.string(),
  contextMarkdown: v.optional(v.string()),
  contextImageId: v.optional(v.id('_storage')),
  firstNumber: v.number(),
  lastNumber: v.number(),
  memberCount: v.number(),
  position: v.number(),
})

const findBookletQuestion = async (ctx: Pick<MutationCtx, 'db'>, pdfUploadId: Id<'pdfUploads'>, number: number) =>
  ctx.db.query('questions').withIndex('by_pdfUploadId_questionNumber', (q) => q.eq('pdfUploadId', pdfUploadId).eq('questionNumber', number)).first()

const findUpload = async (ctx: Pick<MutationCtx, 'db'>, slug: string) => {
  const upload = await ctx.db.query('pdfUploads').withIndex('by_slug', (q) => q.eq('slug', slug)).unique()
  if (upload == null) throw new ConvexError(`No existe el cuadernillo ${slug}.`)
  return upload
}

/**
 * One booklet of the page review (2026-11): text, passage, display and duplicates
 * of each question, read against the printed page. It records what changed and
 * marks the row `auto_passed` only when every check passes; it never writes the
 * key and never signs the row. Re-running it changes nothing.
 */
export const applyPageReview = internalMutation({
  args: {
    slug: v.string(),
    questions: v.array(v.object({
      number: v.number(),
      checks: questionAuditDocumentValidator.fields.checks,
      page: v.optional(v.number()),
      yStart: v.optional(v.number()),
      stem: v.optional(v.string()),
      options: v.optional(v.array(questionOptionValidator)),
      stemDisplay: v.optional(v.union(v.literal('text'), v.literal('scan'))),
      stemImageId: v.optional(v.id('_storage')),
      group: v.optional(pageReviewGroupValidator),
      leaveGroup: v.optional(v.boolean()),
      duplicateOf: v.optional(v.object({ slug: v.string(), number: v.number() })),
      /** A new row joins the pool once every check passes; a person's rejection still stands. */
      publish: v.optional(v.boolean()),
      excludeReason: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const upload = await findUpload(ctx, args.slug)
    const now = Date.now()
    const missing: number[] = []
    const contextChanges = new Map<Id<'questionGroups'>, { before: string; after: string }>()

    for (const decision of args.questions) {
      const question = await findBookletQuestion(ctx, upload._id, decision.number)
      if (question == null) {
        missing.push(decision.number)
        continue
      }
      const audit = await ensureAudit(ctx, question)
      const history = [...audit.history]
      const record = (field: HistoryEntry['field'], before: string | undefined, after: string | undefined) =>
        history.push({ field, before, after, source: PAGE_REVIEW_SOURCE, at: now })
      const patch: Partial<Doc<'questions'>> = {}

      if (decision.stem != null && decision.stem !== question.bodyMarkdown) {
        if (decision.stem.trim().length === 0) throw new ConvexError('El enunciado no puede quedar vacío.')
        patch.bodyMarkdown = decision.stem
        record('stem', question.bodyMarkdown, decision.stem)
      }
      if (decision.options != null && JSON.stringify(decision.options) !== JSON.stringify(question.options)) {
        if (checkOptionsFilled(decision.options).result === 'fail' || !decision.options.some((option) => option.label === question.answerCorrectOption)) {
          throw new ConvexError(`La pregunta ${decision.number}: las opciones perderían la clave.`)
        }
        patch.options = decision.options
        record('options', JSON.stringify(question.options), JSON.stringify(decision.options))
      }
      if (decision.stemDisplay != null) patch.stemDisplay = decision.stemDisplay
      if (decision.stemImageId != null) patch.renderedStemImageId = decision.stemImageId

      if (decision.group != null) {
        const { key, contextMarkdown, contextImageId, firstNumber, lastNumber, memberCount, position } = decision.group
        const existing = await ctx.db.query('questionGroups').withIndex('by_pdfUploadId_contextKey', (q) => q.eq('pdfUploadId', upload._id).eq('contextKey', key)).first()
        const fields = { firstNumber, lastNumber, memberCount, ...(contextImageId == null ? {} : { renderedContextImageId: contextImageId }) }
        let groupId = existing?._id
        if (existing == null) {
          groupId = await ctx.db.insert('questionGroups', { pdfUploadId: upload._id, contextKey: key, contextMarkdown: contextMarkdown ?? '', createdAt: now, ...fields })
          if ((contextMarkdown ?? '') !== '') contextChanges.set(groupId, { before: '', after: contextMarkdown! })
        } else {
          await ctx.db.patch('questionGroups', existing._id, { ...fields, ...(contextMarkdown == null ? {} : { contextMarkdown }) })
          if (contextMarkdown != null && contextMarkdown !== existing.contextMarkdown) {
            contextChanges.set(existing._id, { before: existing.contextMarkdown, after: contextMarkdown })
          }
        }
        const change = contextChanges.get(groupId!)
        if (change != null) record('context', change.before, change.after)
        patch.groupId = groupId
        patch.groupPosition = position
      }
      if (decision.leaveGroup) {
        patch.groupId = undefined
        patch.groupPosition = undefined
      }

      if (decision.duplicateOf != null) {
        const original = await findBookletQuestion(ctx, (await findUpload(ctx, decision.duplicateOf.slug))._id, decision.duplicateOf.number)
        if (original == null) throw new ConvexError(`Pregunta original no encontrada para ${decision.number}.`)
        patch.eligibility = 'excluded'
        patch.eligibilityReasons = [`duplicate_of:${original._id}`]
        patch.eligibilityEvaluatedAt = now
      }

      const passed = decision.checks.every((check) => check.result === 'pass')
      if (decision.excludeReason != null) {
        patch.eligibility = 'excluded'
        patch.eligibilityReasons = [decision.excludeReason]
        patch.eligibilityEvaluatedAt = now
      } else if (decision.publish && decision.duplicateOf == null && passed && audit.status !== 'rejected') {
        patch.eligibility = publishedEligibility(question)
        patch.eligibilityReasons = ['audit_approved']
        patch.eligibilityEvaluatedAt = now
      }

      if (Object.keys(patch).length > 0) await ctx.db.patch('questions', question._id, patch)

      const signed = audit.status === 'approved' || audit.status === 'fixed' || audit.status === 'rejected'
      await ctx.db.patch('questionAudits', audit._id, {
        status: signed ? audit.status : (passed ? 'auto_passed' : 'needs_review'),
        checks: decision.checks,
        source: { ...audit.source, ...(decision.page == null ? {} : { page: decision.page }), ...(decision.yStart == null ? {} : { yStart: decision.yStart }) },
        history,
        updatedAt: now,
      })
    }
    return { applied: args.questions.length - missing.length, missing }
  },
})

/**
 * The same review for the seed items: the corrected guide and passage reach the
 * rows and `questionGuides`. Their audit keeps waiting for a person's signature.
 */
export const applySeedReview = internalMutation({
  args: {
    items: v.array(v.object({
      seedItemId: v.string(),
      /** The text a row from before `seedItemId` is matched on, as `importSeedBank` does. */
      previousBody: v.string(),
      bodyMarkdown: v.optional(v.string()),
      contextMarkdown: v.optional(v.string()),
      guide: v.optional(v.object({ hint: v.string(), byOption: questionGuideDocumentValidator.fields.byOption, reveal: v.string() })),
    })),
  },
  handler: async (ctx, args) => {
    const upload = await findUpload(ctx, AI_UPLOAD_SLUG)
    const rows = await ctx.db.query('questions').withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', upload._id)).collect()
    const now = Date.now()
    const missing: string[] = []
    for (const item of args.items) {
      const question = rows.find((row) => row.seedItemId === item.seedItemId)
        ?? rows.find((row) => row.seedItemId == null && row.bodyMarkdown === item.previousBody)
      if (question == null) {
        missing.push(item.seedItemId)
        continue
      }
      if (question.seedItemId == null) await ctx.db.patch('questions', question._id, { seedItemId: item.seedItemId })
      const audit = await ensureAudit(ctx, question)
      const history = [...audit.history]
      const record = (field: HistoryEntry['field'], before: string | undefined, after: string | undefined) =>
        history.push({ field, before, after, source: PAGE_REVIEW_SOURCE, at: now })

      if (item.bodyMarkdown != null && item.bodyMarkdown !== question.bodyMarkdown) {
        record('stem', question.bodyMarkdown, item.bodyMarkdown)
        await ctx.db.patch('questions', question._id, { bodyMarkdown: item.bodyMarkdown })
      }
      if (item.contextMarkdown != null && question.groupId != null) {
        const group = (await ctx.db.get('questionGroups', question.groupId))!
        if (group.contextMarkdown !== item.contextMarkdown) {
          record('context', group.contextMarkdown, item.contextMarkdown)
          await ctx.db.patch('questionGroups', group._id, { contextMarkdown: item.contextMarkdown })
        }
      }
      if (item.guide != null) {
        const guide = await ctx.db.query('questionGuides').withIndex('by_questionId', (q) => q.eq('questionId', question._id)).unique()
        if (guide != null) {
          const before = JSON.stringify({ hint: guide.hint, byOption: guide.byOption, reveal: guide.reveal })
          if (before !== JSON.stringify(item.guide)) {
            record('guide', before, JSON.stringify(item.guide))
            await ctx.db.patch('questionGuides', guide._id, item.guide)
          }
        }
      }
      await ctx.db.patch('questionAudits', audit._id, { history, updatedAt: now })
    }
    return { applied: args.items.length - missing.length, missing }
  },
})

/** Everything the reviewer's screen needs for one question. */
export const getAuditItem = query({
  args: { questionId: v.id('questions') },
  handler: async (ctx, args) => {
    const audit = await findAudit(ctx, args.questionId)
    if (audit == null) {
      await requirePlatformAdmin(ctx)
      return null
    }
    const reviewer = await requireReviewer(ctx, audit.subjectId)
    const question = await ctx.db.get('questions', args.questionId)
    if (question == null) return null
    const [group, upload, guide, reports] = await Promise.all([
      question.groupId == null ? null : ctx.db.get('questionGroups', question.groupId),
      ctx.db.get('pdfUploads', question.pdfUploadId),
      ctx.db.query('questionGuides').withIndex('by_questionId', (q) => q.eq('questionId', question._id)).unique(),
      ctx.db.query('questionReports').withIndex('by_status_createdAt', (q) => q.eq('status', 'open')).collect(),
    ])
    const url = (id: Id<'_storage'> | undefined) => (id == null ? null : ctx.storage.getUrl(id))
    const pending = pendingKeyProposal(audit.history)
    return {
      audit,
      question,
      group: group == null ? null : { contextMarkdown: group.contextMarkdown, contextImageUrl: await url(group.renderedContextImageId) },
      source: questionSource(upload).label,
      pageImageUrl: await url(audit.source.pageImageId),
      cropUrl: await url(question.renderedStemImageId),
      guide,
      rank: auditRank({ ...audit, key: question.answerCorrectOption }),
      pendingKey: pending == null ? null : { ...pending, keyText: proposedKeyText(pending.after) },
      reviewerRole: reviewerRole(reviewer),
      subtopics: subtopicsOf(audit.subjectId),
      openReports: reports.filter((report) => report.questionId === question._id).map((report) => ({ reason: report.reason, note: report.note })),
    }
  },
})

function subtopicsOf(subjectId: string) {
  const subject = taxonomyContract.subjects.find((candidate) => candidate.id === subjectId)
  return subject?.categories.flatMap((category) => category.subtopics.map((subtopic) => ({
    id: subtopic.id,
    label: getSubtopicContext(subtopic.id)?.label ?? subtopic.id,
  }))) ?? []
}

/** The audit row of a question opened from the bank or a report. */
export const openAudit = mutation({
  args: { questionId: v.id('questions') },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx)
    const question = await ctx.db.get('questions', args.questionId)
    if (question == null) throw new ConvexError('Pregunta no encontrada.')
    const audit = await ensureAudit(ctx, question)
    if (audit.status === 'pending_checks') await ctx.db.patch('questionAudits', audit._id, { status: 'needs_review', updatedAt: Date.now() })
  },
})

const STATUSES_BY_VIEW = {
  queue: ['needs_review', 'auto_passed'],
  rejected: ['rejected'],
  done: ['approved', 'fixed'],
} as const

const QUEUE_LIMIT = 100

export const getAuditQueue = query({
  args: {
    subjectId: v.optional(v.string()),
    view: v.optional(v.union(v.literal('queue'), v.literal('rejected'), v.literal('done'))),
  },
  handler: async (ctx, args) => {
    const subjects = await reviewableSubjects(ctx)
    const wanted = args.subjectId == null ? subjects : subjects.filter((subjectId) => subjectId === args.subjectId)
    const statuses = STATUSES_BY_VIEW[args.view ?? 'queue']

    const rows: AuditRow[] = []
    for (const subjectId of wanted) {
      for (const status of statuses) {
        const found = await ctx.db.query('questionAudits')
          .withIndex('by_subjectId_status', (q) => q.eq('subjectId', subjectId).eq('status', status))
          .collect()
        rows.push(...found.filter((row) => row.status !== 'auto_passed' || row.sampled === true))
      }
    }

    const items = await Promise.all(rows.map(async (audit) => {
      const question = await ctx.db.get('questions', audit.questionId)
      return {
        auditId: audit._id,
        questionId: audit.questionId,
        subjectId: audit.subjectId,
        status: audit.status,
        rank: auditRank({ ...audit, key: question?.answerCorrectOption }),
        questionNumber: question?.questionNumber ?? 0,
        excerpt: (question?.bodyMarkdown ?? '').slice(0, 140),
        failed: audit.checks.filter((check) => check.result === 'fail').length,
        warned: audit.checks.filter((check) => check.result === 'warn').length,
      }
    }))
    items.sort((a, b) => a.rank - b.rank || a.questionNumber - b.questionNumber)
    return { items: items.slice(0, QUEUE_LIMIT), total: items.length, subjects: wanted }
  },
})

async function reviewableSubjects(ctx: QueryCtx) {
  const studentId = await requireAuthenticatedStudentId(ctx)
  const student = await ctx.db.get('students', studentId)
  if (student?.isAdmin) return SUBJECT_IDS
  const subjects = student?.reviewerSubjects ?? []
  if (subjects.length === 0) throw new ConvexError('Necesitas permisos de revisor.')
  return subjects
}

export const reviewGuide = mutation({
  args: { guideId: v.id('questionGuides'), status: v.union(v.literal('approved'), v.literal('rejected')) },
  handler: async (ctx, args) => {
    const guide = await ctx.db.get('questionGuides', args.guideId)
    if (guide == null) throw new ConvexError('Guía no encontrada.')
    const question = await ctx.db.get('questions', guide.questionId)
    const { studentId } = await requireReviewer(ctx, question?.subjectId ?? '')
    if (args.status === 'approved') {
      if (guide.status === 'rejected') {
        throw new ConvexError('Esta guía fue rechazada o invalidada por un cambio en la pregunta: se genera una nueva al publicarla.')
      }
      const audit = await findAudit(ctx, guide.questionId)
      if (audit != null && pendingKeyProposal(audit.history) != null) {
        throw new ConvexError('La clave de esta pregunta está en disputa: la guía se aprueba cuando se resuelva.')
      }
    }
    await ctx.db.patch('questionGuides', guide._id, { status: args.status, reviewedBy: studentId, reviewedAt: Date.now() })
    return { status: args.status }
  },
})

/** What a reviewer has signed, for pay: approved, fixed and rejected questions. */
export const getReviewerCounts = query({
  args: { since: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const callerId = await requireAuthenticatedStudentId(ctx)
    const caller = await ctx.db.get('students', callerId)
    const since = args.since ?? 0
    const mine = await ctx.db.query('questionAudits')
      .withIndex('by_reviewedBy_reviewedAt', (q) => q.eq('reviewedBy', callerId).gte('reviewedAt', since))
      .collect()
    if (!caller?.isAdmin) return { mine: mine.length, byReviewer: null }

    const reviewed = await ctx.db.query('questionAudits').withIndex('by_reviewedBy_reviewedAt', (q) => q.gt('reviewedBy', undefined)).collect()
    const counts = new Map<Id<'students'>, number>()
    for (const audit of reviewed) {
      if (audit.reviewedBy == null || (audit.reviewedAt ?? 0) < since) continue
      counts.set(audit.reviewedBy, (counts.get(audit.reviewedBy) ?? 0) + 1)
    }
    const byReviewer = await Promise.all([...counts].map(async ([studentId, count]) => {
      const student = await ctx.db.get('students', studentId)
      return { studentId, name: student?.name ?? student?.email ?? 'Sin nombre', count }
    }))
    return { mine: mine.length, byReviewer: byReviewer.sort((a, b) => b.count - a.count) }
  },
})

const GUIDE_CHOICE = z.object({ text: z.string(), correct: z.boolean().optional() })
const GUIDE_STEP = z.object({ prompt: z.string(), choices: z.array(GUIDE_CHOICE).min(2).max(3) })

/** One entry per wrong option, in a form every provider's structured output accepts. */
export const GUIDE_SCHEMA = z.object({
  hint: z.string(),
  paths: z.array(z.object({ label: z.string(), diagnose: GUIDE_STEP, steps: z.array(GUIDE_STEP).min(1).max(3) })),
  reveal: z.string(),
})

export type GuideDraft = z.infer<typeof GUIDE_SCHEMA>

export const toGuide = (draft: GuideDraft): GuideForCheck => ({
  hint: draft.hint,
  byOption: Object.fromEntries(draft.paths.map(({ label, diagnose, steps }) => [label, { diagnose, steps }])),
  reveal: draft.reveal,
})

export const GUIDE_RULES = [
  'Reglas de la guía (en español, tuteando al estudiante):',
  '- hint: una pregunta guía. Nunca elimina una opción.',
  '- paths: una entrada por cada opción incorrecta, con su label.',
  '- diagnose: "¿Qué te hizo elegir la X?" y de 2 a 3 razones para tocar, propias de esa opción, sin campo correct.',
  '- steps: de 1 a 3 preguntas de máximo 20 palabras, una sola pregunta por paso, con 2 o 3 opciones y exactamente una marcada correct: true. Terminan en una contradicción de la opción elegida.',
  '- Ni hint, ni diagnose, ni steps pueden nombrar la letra de la opción correcta ni copiar su texto.',
  '- reveal: de 2 a 3 frases, se muestra solo al final; ahí sí se dice la respuesta.',
].join('\n')

export function guidePrompt(question: Pick<Doc<'questions'>, 'bodyMarkdown' | 'options' | 'answerCorrectOption' | 'answerSolutionMarkdown'>, contextMarkdown?: string) {
  return [
    'Escribe el camino socrático para esta pregunta de opción múltiple.',
    GUIDE_RULES,
    '',
    ...(contextMarkdown == null ? [] : ['## Texto compartido', contextMarkdown, '']),
    '## Pregunta',
    question.bodyMarkdown,
    '',
    '## Opciones',
    ...question.options.map((option) => `- ${option.label}. ${option.bodyMarkdown}`),
    '',
    `Respuesta correcta: ${question.answerCorrectOption}`,
    ...(question.answerSolutionMarkdown == null ? [] : ['', question.answerSolutionMarkdown]),
  ].join('\n')
}

/** The approved question a guide may be written from; null while the key is not signed. */
export const guideSource = internalQuery({
  args: { questionId: v.id('questions') },
  handler: async (ctx, args) => {
    const audit = await findAudit(ctx, args.questionId)
    const question = await ctx.db.get('questions', args.questionId)
    if (question == null || question.bankTier !== 'original') return null
    if (audit?.status !== 'approved' && audit?.status !== 'fixed') return null
    const group = question.groupId == null ? null : await ctx.db.get('questionGroups', question.groupId)
    return { question, contextMarkdown: group?.contextMarkdown }
  },
})

export const saveGuide = internalMutation({
  args: { questionId: v.id('questions'), guide: v.object({ hint: v.string(), byOption: questionGuideDocumentValidator.fields.byOption, reveal: v.string() }), modelId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('questionGuides').withIndex('by_questionId', (q) => q.eq('questionId', args.questionId)).unique()
    const fields = { ...args.guide, modelId: args.modelId, promptVersion: GUIDE_PROMPT_VERSION, status: 'pending' as const, createdAt: Date.now() }
    if (existing != null) await ctx.db.patch('questionGuides', existing._id, { ...fields, reviewedBy: undefined, reviewedAt: undefined })
    else await ctx.db.insert('questionGuides', { questionId: args.questionId, ...fields })
  },
})

/** Stage 11. A guide that fails the deterministic rules is logged and left out. */
export const generateGuide = internalAction({
  args: { questionId: v.id('questions') },
  handler: async (ctx, args) => {
    const source: { question: Doc<'questions'>; contextMarkdown?: string } | null = await ctx.runQuery(internal.audit.guideSource, args)
    if (source == null) return { generated: false }
    const { object } = await generateObject({
      model: aprendoModel(GUIDE_MODEL),
      schema: GUIDE_SCHEMA,
      prompt: guidePrompt(source.question, source.contextMarkdown),
    })
    const guide = toGuide(object)
    const problems = validateGuide(source.question, guide)
    if (problems.length > 0) {
      console.warn(`guide for ${args.questionId} refused:`, problems)
      return { generated: false, problems }
    }
    await ctx.runMutation(internal.audit.saveGuide, { questionId: args.questionId, guide, modelId: GUIDE_MODEL })
    return { generated: true }
  },
})
