import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import { internal } from '../src/_generated/api'
import schema from '../src/schema'
import { modules } from './convexModules'
import {
  EXPLANATION_FLAG_PREFIX,
  MIN_EXPLANATION_CONFIDENCE,
  decideExplanation,
  needsExplanation,
} from '../src/explanations'

const LABELS = ['A', 'B', 'C', 'D']

function result(overrides: Partial<Parameters<typeof decideExplanation>[0]['result']> = {}) {
  return {
    correctOption: 'C',
    confidence: 0.9,
    solutionMarkdown: 'Paso 1. Despeja $x$…',
    distractorRationales: [
      { label: 'A', rationaleMarkdown: 'Sumaste en vez de restar.' },
      { label: 'B', rationaleMarkdown: 'Confundiste el área con el perímetro.' },
      { label: 'D', rationaleMarkdown: 'Olvidaste el signo.' },
    ],
    ...overrides,
  }
}

describe('decideExplanation', () => {
  test('stores the solution and rationales when the model agrees with the official key', () => {
    const decision = decideExplanation({ officialKey: 'C', optionLabels: LABELS, result: result() })
    expect(decision).toEqual({
      action: 'store',
      solutionMarkdown: 'Paso 1. Despeja $x$…',
      distractorRationales: result().distractorRationales,
    })
  })

  test('never stores anything when the model disagrees with the key: it flags it', () => {
    const decision = decideExplanation({
      officialKey: 'C',
      optionLabels: LABELS,
      result: result({ correctOption: 'B', confidence: 0.83 }),
    })
    expect(decision.action).toBe('flag')
    if (decision.action !== 'flag') return
    expect(decision.message.startsWith(EXPLANATION_FLAG_PREFIX)).toBe(true)
    expect(decision.message).toContain('B')
    expect(decision.message).toContain('C')
  })

  test('flags an agreement the model is not sure of', () => {
    const decision = decideExplanation({
      officialKey: 'C',
      optionLabels: LABELS,
      result: result({ confidence: MIN_EXPLANATION_CONFIDENCE - 0.01 }),
    })
    expect(decision.action).toBe('flag')
  })

  test('flags an agreement without a written solution', () => {
    expect(
      decideExplanation({ officialKey: 'C', optionLabels: LABELS, result: result({ solutionMarkdown: '  ' }) }).action,
    ).toBe('flag')
    expect(
      decideExplanation({ officialKey: 'C', optionLabels: LABELS, result: result({ solutionMarkdown: undefined }) }).action,
    ).toBe('flag')
  })

  test('keeps only one rationale per real wrong option', () => {
    const decision = decideExplanation({
      officialKey: 'C',
      optionLabels: LABELS,
      result: result({
        distractorRationales: [
          { label: 'A', rationaleMarkdown: 'primera' },
          { label: 'A', rationaleMarkdown: 'repetida' },
          { label: 'C', rationaleMarkdown: 'la clave no tiene distractor' },
          { label: 'G', rationaleMarkdown: 'no existe' },
        ],
      }),
    })
    expect(decision).toMatchObject({
      action: 'store',
      distractorRationales: [{ label: 'A', rationaleMarkdown: 'primera' }],
    })
  })
})

describe('needsExplanation', () => {
  const booklet = {
    answerModelId: 'icfes-booklet-key',
    answerCorrectOption: 'C',
    eligibility: 'diagnostic',
  }

  test('an official key with no written solution needs one', () => {
    expect(needsExplanation(booklet)).toBe(true)
  })

  test('skips questions already explained, flagged, excluded or without an official key', () => {
    expect(needsExplanation({ ...booklet, answerSolutionMarkdown: 'ya está' })).toBe(false)
    expect(needsExplanation({ ...booklet, answerErrorMessage: `${EXPLANATION_FLAG_PREFIX} discrepa` })).toBe(false)
    expect(needsExplanation({ ...booklet, eligibility: 'excluded' })).toBe(false)
    expect(needsExplanation({ ...booklet, answerModelId: 'gemini-3-flash-preview' })).toBe(false)
    expect(needsExplanation({ ...booklet, answerCorrectOption: undefined })).toBe(false)
  })
})

describe('the backfill reads the bank a page at a time', () => {
  async function seedBank(pendingAtEnd: number, flaggedAtEnd = 0) {
    const t = convexTest(schema, modules)
    await t.run(async (ctx) => {
      const now = Date.now()
      const pdfUploadId = await ctx.db.insert('pdfUploads', {
        fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['pdf'])),
        contentType: 'application/pdf', sizeBytes: 3, status: 'completed', createdAt: now, updatedAt: now,
      })
      const official = { answerModelId: 'icfes-booklet-key', answerCorrectOption: 'A' }
      const rows = [
        ...Array.from({ length: 250 }, () => ({ ...official, answerSolutionMarkdown: 'ya' })),
        ...Array.from({ length: pendingAtEnd }, () => official),
        ...Array.from({ length: flaggedAtEnd }, () => ({ ...official, answerErrorMessage: `${EXPLANATION_FLAG_PREFIX} x` })),
      ]
      for (const [index, fields] of rows.entries()) {
        await ctx.db.insert('questions', {
          pdfUploadId, questionNumber: index + 1, sequence: index, bodyMarkdown: 'q', options: [], createdAt: now, ...fields,
        })
      }
    })
    return t
  }

  test('one call reads one page and says where to continue', async () => {
    const t = await seedBank(3)
    const first = await t.query(internal.explanations.listExplanationCandidates, { cursor: null })
    expect(first.isDone).toBe(false)
    expect(first.questions).toHaveLength(0)
  })

  test('a dry run walks every page to find what is pending', async () => {
    const t = await seedBank(3)
    const result = await t.action(internal.explanations.backfillExplanations, { limit: 10, dryRun: true })
    expect(result.questionIds).toHaveLength(3)
  })

  test('the flags are listed page by page from the console', async () => {
    const t = await seedBank(0, 2)
    let cursor: string | null = null
    const flags = []
    for (;;) {
      const page: { flags: unknown[]; continueCursor: string; isDone: boolean } = await t.query(
        internal.explanations.listExplanationFlags, { cursor },
      )
      flags.push(...page.flags)
      if (page.isDone) break
      cursor = page.continueCursor
    }
    expect(flags).toHaveLength(2)
  })
})
