import { generateObject } from 'ai'
import { z } from 'zod'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import taxonomyContract from '../../../docs/taxonomy.v1.json'
import { GUIDE_RULES, GUIDE_SCHEMA, ensureAudit, toGuide } from './audit'
import { checkOptionCount, similarityGate, validateGuide } from './auditChecks'
import { getCompetenciaLabel, getSubtopicContext } from './taxonomy'
import { questionGuideDocumentValidator } from './validators'
import { APRENDO_MODEL_ID, aprendoModel } from './aiProvider'
import { AI_UPLOAD_SLUG } from './questionSource'

/**
 * The authoring pipeline for the original bank (F66): one blueprint cell at a
 * time (`docs/bank-blueprint.v1.json`), Inglés first. Items land `pending` and
 * go through the same audit as any other bank.
 *
 * The generator never reads an ICFES row: paraphrasing them is forbidden, so the
 * corpus exists only for the similarity gate, after the text is written. Run
 * cell by cell:
 *   bunx convex run generatedQuestions:authorBlueprintCell '{"subtopicId":"…","competencia":"…","difficulty":"media","targetGrade":11,"count":5}'
 */

const GENERATION_MODEL = APRENDO_MODEL_ID
const TAXONOMY_VERSION = taxonomyContract.taxonomy_version
const TAXONOMY_RELEASE = taxonomyContract.taxonomy_release
const MAX_QUESTIONS = 10
const PROMPT_VERSION = 'authoring-v1'

export type BlueprintCell = {
  subtopicId: string
  competencia: string
  difficulty: 'baja' | 'media' | 'alta'
  targetGrade: number
  count: number
}

const DRAFT_SCHEMA = z.object({
  context: z.string().optional().describe('Pasaje original o de dominio público, si la pregunta lo necesita.'),
  passageLicense: z.string().optional().describe('Si el pasaje no es original: autor, obra y licencia o dominio público.'),
  stem: z.string().describe('El enunciado (markdown; usa $...$ para fórmulas).'),
  options: z.array(z.object({ label: z.enum(['A', 'B', 'C', 'D']), text: z.string() })).min(3).max(4),
  correctOption: z.string(),
  solution: z.string().describe('Explicación breve de por qué la respuesta es correcta.'),
  guide: GUIDE_SCHEMA,
})

export type AuthoredDraft = z.infer<typeof DRAFT_SCHEMA>

const GENERATION_SYSTEM = [
  'Eres un autor de preguntas de opción múltiple para jóvenes colombianos de 15 a 17 años que preparan el examen Saber 11.',
  'Escribes reactivos ORIGINALES: situaciones, datos y pasajes inventados por ti, o pasajes de dominio público con la licencia registrada.',
  'La opción marcada como correcta debe ser inequívocamente la correcta y las demás incorrectas pero plausibles.',
  'Responde SIEMPRE en español, salvo los pasajes de Inglés.',
].join(' ')

/** Only the blueprint cell goes in: there is no way to hand this an ICFES row. */
export function authorPrompt(cell: BlueprintCell) {
  const context = getSubtopicContext(cell.subtopicId)
  return [
    `Escribe ${cell.count} preguntas originales de opción múltiple sobre:`,
    `- Área: ${context?.subjectLabel ?? ''}`,
    `- Categoría: ${context?.categoryLabel ?? ''}`,
    `- Subtema: ${context?.label ?? cell.subtopicId}`,
    `- Competencia: ${getCompetenciaLabel(cell.competencia)}`,
    `- Dificultad: ${cell.difficulty}`,
    `- Grado: ${cell.targetGrade}`,
    '',
    'Cada pregunta lleva 4 opciones A, B, C y D (en Inglés pueden ser 3: A, B y C), una sola correcta, solución y guía.',
    'Nunca copies ni parafrasees preguntas de exámenes ICFES ni de ningún banco: las paráfrasis están prohibidas. Inventa contextos colombianos propios.',
    '',
    GUIDE_RULES,
  ].join('\n')
}

/**
 * One cell's drafts through the deterministic gates. The two steps are injected
 * and run in this order: the generator is finished before the ICFES corpus is
 * read, and its only input is the cell.
 */
export async function authorCell(
  cell: BlueprintCell,
  deps: {
    generate: (prompt: string) => Promise<AuthoredDraft[]>
    loadIcfesCorpus: () => Promise<Array<{ id: string; text: string }>>
  },
) {
  const drafts = await deps.generate(authorPrompt(cell))
  const corpus = await deps.loadIcfesCorpus()

  const accepted: AuthoredDraft[] = []
  const rejected: Array<{ stem: string; reason: string }> = []
  for (const draft of drafts) {
    const options = draft.options.map((option) => ({ label: option.label, bodyMarkdown: option.text }))
    const similar = similarityGate(`${draft.context ?? ''}\n${draft.stem}`, corpus)
    const problems = [
      ...(similar.ok ? [] : [`Se parece a ${similar.matchId}.`]),
      ...(checkOptionCount(options).result === 'fail' ? ['Opciones inválidas.'] : []),
      ...(options.some((option) => option.label === draft.correctOption) ? [] : ['La clave no es una opción.']),
      ...validateGuide({ options, answerCorrectOption: draft.correctOption }, toGuide(draft.guide)),
    ]
    if (problems.length === 0) accepted.push(draft)
    else rejected.push({ stem: draft.stem, reason: problems.join(' ') })
  }
  return { accepted, rejected }
}

export const findAiUpload = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query('pdfUploads')
      .withIndex('by_slug', (q) => q.eq('slug', AI_UPLOAD_SLUG))
      .unique()
  },
})

export const createAiUpload = internalMutation({
  args: {
    pdfStorageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return ctx.db.insert('pdfUploads', {
      fileName: 'Preguntas generadas por IA',
      slug: AI_UPLOAD_SLUG,
      pdfStorageId: args.pdfStorageId,
      contentType: 'application/x-aprendo-ai-generated',
      sizeBytes: 0,
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    })
  },
})

/** ICFES rows, only ever read by the similarity gate. */
export const icfesCorpus = internalQuery({
  args: { subjectId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('questions')
      .withIndex('by_subjectId_eligibility', (q) => q.eq('subjectId', args.subjectId))
      .collect()
    const icfes = rows.filter((row) => row.bankTier !== 'original')
    const groups = await Promise.all(icfes.map((row) => (row.groupId == null ? null : ctx.db.get('questionGroups', row.groupId))))
    return icfes.map((row, index) => ({
      id: row._id as string,
      text: [groups[index]?.contextMarkdown, row.bodyMarkdown].filter(Boolean).join('\n'),
    }))
  },
})

const cellValidator = v.object({
  subtopicId: v.string(),
  competencia: v.string(),
  difficulty: v.union(v.literal('baja'), v.literal('media'), v.literal('alta')),
  targetGrade: v.number(),
  count: v.number(),
})

export const insertAuthoredQuestions = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    cell: cellValidator,
    modelId: v.string(),
    drafts: v.array(v.object({
      context: v.optional(v.string()),
      passageLicense: v.optional(v.string()),
      stem: v.string(),
      options: v.array(v.object({ label: v.string(), text: v.string() })),
      correctOption: v.string(),
      solution: v.string(),
      guide: v.object({
        hint: v.string(),
        byOption: questionGuideDocumentValidator.fields.byOption,
        reveal: v.string(),
      }),
    })),
  },
  handler: async (ctx, args) => {
    const context = getSubtopicContext(args.cell.subtopicId)
    if (context == null) throw new ConvexError('Subtema no válido.')
    const existing = await ctx.db.query('questions').withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId)).collect()
    let sequence = existing.length
    const now = Date.now()

    for (const draft of args.drafts) {
      sequence += 1
      const questionId = await ctx.db.insert('questions', {
        pdfUploadId: args.pdfUploadId,
        questionNumber: sequence,
        sequence,
        bodyMarkdown: [draft.context, draft.stem].filter(Boolean).join('\n\n'),
        options: draft.options.map((option) => ({ label: option.label, bodyMarkdown: option.text })),
        createdAt: now,
        answerStatus: 'completed',
        answerCorrectOption: draft.correctOption,
        answerSolutionMarkdown: draft.solution,
        answerCompletedAt: now,
        answerModelId: args.modelId,
        answerPromptVersion: PROMPT_VERSION,
        explanationSource: 'ai_generated',
        taxonomyStatus: 'completed',
        taxonomyVersion: TAXONOMY_VERSION,
        taxonomyRelease: TAXONOMY_RELEASE,
        subjectId: context.subjectId,
        categoryId: context.categoryId,
        primarySubtopicId: context.subtopicId,
        secondaryDimensions: [
          { dimension: 'competencia_oficial', value: args.cell.competencia },
          { dimension: 'dificultad_autor', value: args.cell.difficulty },
        ],
        taxonomyCompletedAt: now,
        eligibility: 'pending',
        eligibilityEvaluatedAt: now,
        bankTier: 'original',
        stemDisplay: 'text',
        targetGrade: args.cell.targetGrade,
      })
      await ctx.db.insert('questionGuides', {
        questionId,
        ...draft.guide,
        modelId: args.modelId,
        promptVersion: PROMPT_VERSION,
        status: 'pending',
        createdAt: now,
      })
      const audit = await ensureAudit(ctx, (await ctx.db.get('questions', questionId))!)
      if (draft.passageLicense != null) {
        await ctx.db.patch('questionAudits', audit._id, { source: { ...audit.source, licenseNote: draft.passageLicense } })
      }
    }

    return { inserted: args.drafts.length }
  },
})

/**
 * Write one blueprint cell's items. Internal: what the model writes lands in the
 * shared bank, so no account may trigger it. Every item it keeps still waits in
 * `pending` for the audit and a teacher.
 */
export const authorBlueprintCell = internalAction({
  args: cellValidator.fields,
  handler: async (ctx, args): Promise<{ inserted: number; rejected: Array<{ stem: string; reason: string }> }> => {
    const context = getSubtopicContext(args.subtopicId)
    if (context == null) throw new ConvexError('Subtema no válido.')
    const count = Math.min(Math.max(args.count, 1), MAX_QUESTIONS)

    const { accepted, rejected } = await authorCell({ ...args, count }, {
      generate: async (prompt) => {
        const { object } = await generateObject({
          model: aprendoModel(GENERATION_MODEL),
          schema: z.object({ questions: z.array(DRAFT_SCHEMA) }),
          system: GENERATION_SYSTEM,
          prompt,
          maxOutputTokens: 12000,
        })
        return object.questions
      },
      loadIcfesCorpus: () => ctx.runQuery(internal.generatedQuestions.icfesCorpus, { subjectId: context.subjectId }),
    })

    if (accepted.length === 0) return { inserted: 0, rejected }

    const existingUpload = await ctx.runQuery(internal.generatedQuestions.findAiUpload, {})
    const pdfUploadId = existingUpload?._id
      ?? (await ctx.runMutation(internal.generatedQuestions.createAiUpload, {
        pdfStorageId: await ctx.storage.store(new Blob(['aprendo-ai-generated'])),
      }))

    const { inserted } = await ctx.runMutation(internal.generatedQuestions.insertAuthoredQuestions, {
      pdfUploadId,
      cell: { ...args, count },
      modelId: GENERATION_MODEL,
      drafts: accepted.map(({ guide, ...draft }) => ({ ...draft, guide: toGuide(guide) })),
    })
    return { inserted, rejected }
  },
})
