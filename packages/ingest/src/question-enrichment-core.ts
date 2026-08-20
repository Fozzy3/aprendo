import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

const ANSWER_PROMPT_VERSION = '2026-08-20.answer.v3'
const TAXONOMY_PROMPT_VERSION = '2026-08-17.taxonomy.v2'
const GOOGLE_MODEL_ID = 'gemini-3-flash-preview'

/**
 * Option labels the bank actually contains.
 *
 * Not just A-D: the official Inglés booklets use 3-option items (A-C) and
 * matching items where five prompts share eight options (A-H). Capping the enum
 * at D silently broke enrichment for a large part of Lectura and Inglés — the
 * model cannot return a label it is not allowed to produce.
 */
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

const AnswerResultSchema = z.object({
  correctOption: z.enum(OPTION_LABELS),
  confidence: z.number().min(0).max(1),
  solutionMarkdown: z.string().min(1).optional(),
  /**
   * Why each wrong option attracts the students who pick it. One entry per
   * distractor — the reasoning error, not a restatement of the right answer.
   */
  distractorRationales: z
    .array(
      z.object({
        label: z.enum(OPTION_LABELS),
        rationaleMarkdown: z.string().min(1),
      }),
    )
    .optional(),
})

const TaxonomyResultSchema = z.object({
  subjectId: z.string().min(1),
  categoryId: z.string().min(1),
  primarySubtopicId: z.string().min(1),
  secondarySubtopicIds: z.array(z.string()).max(2).optional(),
  secondaryDimensions: z
    .array(
      z.object({
        dimension: z.string().min(1),
        value: z.string().min(1),
      }),
    )
    .optional(),
  confidence: z.number().min(0).max(1),
})

export interface EnrichmentQuestionInput {
  bodyMarkdown: string
  /**
   * The shared stimulus, when the question belongs to a group. Without it a
   * grouped question is enriched blind — the model only sees "¿Qué sugiere el
   * autor?" with no text — which is why reading-heavy areas (Lectura Crítica,
   * Sociales, Inglés) tagged so badly.
   */
  contextMarkdown?: string
  options: Array<{
    label: string
    bodyMarkdown: string
  }>
}

export interface TaxonomyDimension {
  dimension: string
  value: string
}

export interface TaxonomySubject {
  id: string
  categories: Array<{
    id: string
    subtopics: Array<{
      id: string
    }>
  }>
}

export interface TaxonomyContract {
  taxonomy_version: string
  taxonomy_release: string
  subjects: TaxonomySubject[]
}

export interface DistractorRationale {
  label: string
  rationaleMarkdown: string
}

export interface QuestionAnswerResult {
  correctOption: (typeof OPTION_LABELS)[number]
  confidence: number
  solutionMarkdown?: string
  distractorRationales: DistractorRationale[]
  modelId: string
  promptVersion: string
}

export interface QuestionTaxonomyResult {
  subjectId: string
  categoryId: string
  primarySubtopicId: string
  secondarySubtopicIds: string[]
  secondaryDimensions: TaxonomyDimension[]
  confidence: number
  taxonomyVersion: string
  taxonomyRelease: string
  modelId: string
  promptVersion: string
}

function buildQuestionMarkdown(question: EnrichmentQuestionInput) {
  const optionLines = question.options.map(
    (option) => `- ${option.label}. ${option.bodyMarkdown}`,
  )

  const contextSection =
    question.contextMarkdown == null || question.contextMarkdown.trim().length === 0
      ? []
      : ['## Shared stimulus', question.contextMarkdown, '']

  return [
    ...contextSection,
    '## Question',
    question.bodyMarkdown,
    '',
    '## Options',
    ...optionLines,
  ].join('\n')
}

function extractImageUrls(markdown: string) {
  const matches = markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)
  return [...matches]
    .map((match) => match[1])
    .filter((value): value is string => value != null && value.length > 0)
}

function guessImageMediaType(url: string) {
  if (url.endsWith('.png')) return 'image/png'
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg'
  if (url.endsWith('.gif')) return 'image/gif'
  if (url.endsWith('.webp')) return 'image/webp'
  return null
}

function buildFileParts(question: EnrichmentQuestionInput) {
  const imageUrls = [
    ...extractImageUrls(question.contextMarkdown ?? ''),
    ...extractImageUrls(question.bodyMarkdown),
    ...question.options.flatMap((option) => extractImageUrls(option.bodyMarkdown)),
  ]

  return imageUrls
    .map((url) => {
      const mediaType = guessImageMediaType(url)
      if (mediaType == null) return null

      return {
        type: 'file' as const,
        data: new URL(url),
        mediaType,
      }
    })
    .filter((part): part is { type: 'file'; data: URL; mediaType: string } => part != null)
}

function buildAnswerPrompt(question: EnrichmentQuestionInput) {
  return [
    'You are solving an ICFES-style multiple-choice question.',
    'Return the most likely correct option and a confidence score between 0 and 1.',
    'Use ONLY labels that actually appear in the options below. Items are not',
    'always A-D: the Inglés test uses 3-option items (A-C) and matching items',
    'where several prompts share up to eight options (A-H).',
    'If the question is ambiguous or low quality, lower the confidence.',
    'Preserve Spanish and math notation when writing the solution.',
    '',
    'Also return `distractorRationales`: one entry for EVERY option that is not',
    'the correct one. Each rationale must explain the specific reasoning error',
    'that leads a student to choose that option — the misconception, the step',
    'they skipped, the trap in the wording. Write it in Spanish, addressed to',
    'the student as "tú", in one or two sentences.',
    'Do NOT restate the correct answer, and do NOT write "es incorrecta porque',
    'no es la respuesta": a student who picked it already knows it was wrong.',
    'What they do not know is why it looked right.',
    '',
    buildQuestionMarkdown(question),
  ].join('\n')
}

function buildTaxonomyPrompt(args: {
  question: EnrichmentQuestionInput
  taxonomy: TaxonomyContract
}) {
  return [
    'You are tagging an ICFES-style multiple-choice question using a fixed taxonomy.',
    'You must return exactly one valid subject, one valid category, and one valid primary subtopic from the provided taxonomy.',
    'You may return up to two secondary subtopics from the same subject only when genuinely required.',
    'Do not invent labels or IDs outside the taxonomy.',
    '',
    '## Taxonomy Contract',
    JSON.stringify(
      {
        taxonomy_version: args.taxonomy.taxonomy_version,
        taxonomy_release: args.taxonomy.taxonomy_release,
        subjects: args.taxonomy.subjects,
      },
      null,
      2,
    ),
    '',
    buildQuestionMarkdown(args.question),
  ].join('\n')
}

function validateTaxonomyResult(args: {
  result: z.infer<typeof TaxonomyResultSchema>
  taxonomy: TaxonomyContract
}) {
  const subject = args.taxonomy.subjects.find(
    (candidate) => candidate.id === args.result.subjectId,
  )
  if (subject == null) {
    throw new Error(`Invalid taxonomy subject: ${args.result.subjectId}`)
  }

  const category = subject.categories.find(
    (candidate) => candidate.id === args.result.categoryId,
  )
  if (category == null) {
    throw new Error(`Invalid taxonomy category: ${args.result.categoryId}`)
  }

  const primarySubtopic = category.subtopics.find(
    (candidate) => candidate.id === args.result.primarySubtopicId,
  )
  if (primarySubtopic == null) {
    throw new Error(`Invalid primary subtopic: ${args.result.primarySubtopicId}`)
  }

  for (const secondarySubtopicId of args.result.secondarySubtopicIds ?? []) {
    const existsInSubject = subject.categories.some((candidate) =>
      candidate.subtopics.some((subtopic) => subtopic.id === secondarySubtopicId),
    )
    if (!existsInSubject) {
      throw new Error(`Invalid secondary subtopic: ${secondarySubtopicId}`)
    }
    if (secondarySubtopicId === args.result.primarySubtopicId) {
      throw new Error(`Duplicate primary/secondary subtopic: ${secondarySubtopicId}`)
    }
  }
}

export async function inferQuestionAnswer(args: {
  apiKey: string
  question: EnrichmentQuestionInput
}): Promise<QuestionAnswerResult> {
  const google = createGoogleGenerativeAI({ apiKey: args.apiKey })
  const fileParts = buildFileParts(args.question)
  const { object } = await generateObject({
    model: google(GOOGLE_MODEL_ID),
    schema: AnswerResultSchema,
    providerOptions: {
      google: {
        // Explaining why a distractor is tempting is a reasoning task, unlike
        // simply picking the right letter. With a zero budget the rationales
        // collapse into "esta opción es incorrecta".
        thinkingConfig: { thinkingBudget: 2048 },
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildAnswerPrompt(args.question) },
          ...fileParts,
        ],
      },
    ],
  })

  return {
    correctOption: object.correctOption,
    confidence: object.confidence,
    solutionMarkdown: object.solutionMarkdown,
    // A rationale for the correct option would contradict itself, and the model
    // occasionally emits one anyway. Drop it here rather than teaching the UI
    // to distrust its own data.
    distractorRationales: (object.distractorRationales ?? []).filter(
      (rationale) => rationale.label !== object.correctOption,
    ),
    modelId: GOOGLE_MODEL_ID,
    promptVersion: ANSWER_PROMPT_VERSION,
  }
}

export async function tagQuestionTaxonomy(args: {
  apiKey: string
  question: EnrichmentQuestionInput
  taxonomy: TaxonomyContract
}): Promise<QuestionTaxonomyResult> {
  const google = createGoogleGenerativeAI({ apiKey: args.apiKey })
  const fileParts = buildFileParts(args.question)
  const { object } = await generateObject({
    model: google(GOOGLE_MODEL_ID),
    schema: TaxonomyResultSchema,
    providerOptions: {
      google: {
        thinkingConfig: { thinkingBudget: 0 },
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildTaxonomyPrompt(args) },
          ...fileParts,
        ],
      },
    ],
  })

  validateTaxonomyResult({
    result: object,
    taxonomy: args.taxonomy,
  })

  return {
    subjectId: object.subjectId,
    categoryId: object.categoryId,
    primarySubtopicId: object.primarySubtopicId,
    secondarySubtopicIds: object.secondarySubtopicIds ?? [],
    secondaryDimensions: object.secondaryDimensions ?? [],
    confidence: object.confidence,
    taxonomyVersion: args.taxonomy.taxonomy_version,
    taxonomyRelease: args.taxonomy.taxonomy_release,
    modelId: GOOGLE_MODEL_ID,
    promptVersion: TAXONOMY_PROMPT_VERSION,
  }
}
