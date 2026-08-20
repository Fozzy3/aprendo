import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalMutation, internalQuery } from './_generated/server'
import taxonomyContract from '../../../docs/taxonomy.v1.json'
import { requireAuthenticatedStudentId } from './auth'
import { getSubtopicContext } from './taxonomy'
import { questionOptionValidator } from './validators'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const GENERATION_MODEL = 'deepseek/deepseek-v4-pro'
const AI_UPLOAD_SLUG = 'ai-generated'
const TAXONOMY_VERSION = taxonomyContract.taxonomy_version
const TAXONOMY_RELEASE = taxonomyContract.taxonomy_release
const MAX_QUESTIONS = 10

const generationSchema = z.object({
  questions: z.array(
    z.object({
      stem: z.string().describe('El enunciado de la pregunta (markdown; usa $...$ para fórmulas).'),
      options: z
        .array(
          z.object({
            label: z.enum(['A', 'B', 'C', 'D']),
            text: z.string().describe('Texto de la opción.'),
          }),
        )
        .length(4)
        .describe('Exactamente 4 opciones A, B, C y D.'),
      correctOption: z.enum(['A', 'B', 'C', 'D']).describe('La etiqueta de la única opción correcta.'),
      solution: z.string().describe('Explicación breve de por qué la respuesta es correcta.'),
    }),
  ),
})

const GENERATION_SYSTEM = [
  'Eres un experto en el diseño de preguntas del examen ICFES Saber 11 de Colombia.',
  'Generas preguntas de opción múltiple rigurosas, claras y CORRECTAS.',
  'La exactitud es crítica: la opción marcada como correcta debe ser inequívocamente la correcta y las demás claramente incorrectas pero plausibles.',
  'Responde SIEMPRE en español.',
].join(' ')

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

export const insertGeneratedQuestions = internalMutation({
  args: {
    pdfUploadId: v.id('pdfUploads'),
    subjectId: v.string(),
    categoryId: v.string(),
    subtopicId: v.string(),
    questions: v.array(
      v.object({
        bodyMarkdown: v.string(),
        options: v.array(questionOptionValidator),
        answerCorrectOption: v.string(),
        answerSolutionMarkdown: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('questions')
      .withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', args.pdfUploadId))
      .collect()
    let sequence = existing.length
    const now = Date.now()

    for (const question of args.questions) {
      sequence += 1
      await ctx.db.insert('questions', {
        pdfUploadId: args.pdfUploadId,
        questionNumber: sequence,
        sequence,
        bodyMarkdown: question.bodyMarkdown,
        options: question.options,
        createdAt: now,
        answerStatus: 'completed',
        answerCorrectOption: question.answerCorrectOption,
        answerSolutionMarkdown: question.answerSolutionMarkdown,
        answerCompletedAt: now,
        taxonomyStatus: 'completed',
        taxonomyVersion: TAXONOMY_VERSION,
        taxonomyRelease: TAXONOMY_RELEASE,
        subjectId: args.subjectId,
        categoryId: args.categoryId,
        primarySubtopicId: args.subtopicId,
        // AI-generated questions are for practice only, never the diagnostic.
        eligibility: 'practice_only',
        eligibilityEvaluatedAt: now,
      })
    }

    return { inserted: args.questions.length }
  },
})

/**
 * Generate practice questions for a subtopic with AI and add them to the bank
 * (as `practice_only`, attached to a synthetic "AI generated" upload so they
 * flow through the normal selection/session machinery). Used when a subtopic's
 * inventory is thin.
 */
export const generateSubtopicQuestions = action({
  args: {
    subtopicId: v.string(),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ inserted: number }> => {
    await requireAuthenticatedStudentId(ctx)
    const context = getSubtopicContext(args.subtopicId)
    if (context == null) {
      throw new ConvexError('Subtema no válido.')
    }
    const count = Math.min(Math.max(args.count ?? 5, 1), MAX_QUESTIONS)

    const { object } = await generateObject({
      model: openrouter(GENERATION_MODEL),
      schema: generationSchema,
      system: GENERATION_SYSTEM,
      prompt: [
        `Genera ${count} preguntas de opción múltiple estilo ICFES Saber 11 sobre:`,
        `- Materia: ${context.subjectLabel}`,
        `- Categoría: ${context.categoryLabel}`,
        `- Subtema: ${context.label}`,
        '',
        'Cada pregunta debe tener un enunciado claro, 4 opciones (A, B, C, D) con una sola correcta, y una solución que explique por qué. Varía el formato y la dificultad. No repitas preguntas entre sí.',
      ].join('\n'),
      maxOutputTokens: 8000,
    })

    const questions = object.questions.map((question) => ({
      bodyMarkdown: question.stem,
      options: question.options.map((option) => ({
        label: option.label,
        bodyMarkdown: option.text,
      })),
      answerCorrectOption: question.correctOption,
      answerSolutionMarkdown: question.solution,
    }))

    const existingUpload = await ctx.runQuery(internal.generatedQuestions.findAiUpload, {})
    const pdfUploadId = existingUpload?._id
      ?? (await ctx.runMutation(internal.generatedQuestions.createAiUpload, {
        pdfStorageId: await ctx.storage.store(new Blob(['aprendo-ai-generated'])),
      }))

    return ctx.runMutation(internal.generatedQuestions.insertGeneratedQuestions, {
      pdfUploadId,
      subjectId: context.subjectId,
      categoryId: context.categoryId,
      subtopicId: args.subtopicId,
      questions,
    })
  },
})
