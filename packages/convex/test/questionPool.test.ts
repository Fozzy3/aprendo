import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import schema from '../src/schema'
import type { Doc } from '../src/_generated/dataModel'
import { ALL_BANK_TIERS, bankTiersForStudent, collectUsableQuestions, hasUsableMetadata, isInEligibilityPool } from '../src/questionPool'
import { modules } from './convexModules'

const now = 1_700_000_000_000

describe('collectUsableQuestions', () => {
  test('returns the usable questions of the pools across every area, read by index', async () => {
    const t = convexTest(schema, modules)
    const numbers = await t.run(async (ctx) => {
      const pdfUploadId = await ctx.db.insert('pdfUploads', {
        fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['pdf'])),
        contentType: 'application/pdf', sizeBytes: 3, status: 'completed', createdAt: now, updatedAt: now,
      })
      let questionNumber = 0
      const insert = (fields: Record<string, string | undefined>) =>
        ctx.db.insert('questions', {
          pdfUploadId, questionNumber: ++questionNumber, sequence: questionNumber, bodyMarkdown: 'q',
          options: [], createdAt: now, answerCorrectOption: 'A', categoryId: 'c', primarySubtopicId: 's',
          ...fields,
        } as never)
      await insert({ subjectId: 'matematicas', eligibility: 'diagnostic' }) // 1 ✓
      await insert({ subjectId: 'ingles', eligibility: 'practice_only' }) // 2 ✓
      await insert({ subjectId: 'matematicas', eligibility: 'excluded' }) // 3 other pool
      await insert({ subjectId: 'lectura_critica', eligibility: 'diagnostic', answerCorrectOption: undefined }) // 4 no key
      await insert({ subjectId: undefined, eligibility: 'diagnostic' }) // 5 no area

      const questions = await collectUsableQuestions(ctx, ['diagnostic', 'practice_only'], ALL_BANK_TIERS)
      return questions.map((question) => question.questionNumber).sort()
    })
    expect(numbers).toEqual([1, 2])
  })

  test('filters by bank tier (absent means icfes) and never returns a voided question', async () => {
    const t = convexTest(schema, modules)
    const pools = ['diagnostic'] as const
    const numbers = await t.run(async (ctx) => {
      const pdfUploadId = await ctx.db.insert('pdfUploads', {
        fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['pdf'])),
        contentType: 'application/pdf', sizeBytes: 3, status: 'completed', createdAt: now, updatedAt: now,
      })
      let questionNumber = 0
      const insert = (fields: Record<string, string | number | undefined>) =>
        ctx.db.insert('questions', {
          pdfUploadId, questionNumber: ++questionNumber, sequence: questionNumber, bodyMarkdown: 'q', options: [],
          createdAt: now, answerCorrectOption: 'A', categoryId: 'c', primarySubtopicId: 's', subjectId: 'matematicas', eligibility: 'diagnostic',
          ...fields,
        } as never)
      await insert({}) // 1 absent → icfes
      await insert({ bankTier: 'icfes' }) // 2
      await insert({ bankTier: 'original' }) // 3
      await insert({ bankTier: 'original', voidedAt: now }) // 4 voided
      return {
        all: (await collectUsableQuestions(ctx, [...pools], ALL_BANK_TIERS)).map((q) => q.questionNumber).sort(),
        paying: (await collectUsableQuestions(ctx, [...pools], ['original'])).map((q) => q.questionNumber).sort(),
      }
    })
    expect(numbers.all).toEqual([1, 2, 3])
    expect(numbers.paying).toEqual([3])
  })
})

describe('re-checks of a stored question', () => {
  const base = {
    answerCorrectOption: 'A', subjectId: 'm', categoryId: 'c', primarySubtopicId: 's', eligibility: 'diagnostic',
  } as never as Doc<'questions'>

  test('a voided question is no longer usable', () => {
    expect(hasUsableMetadata(base)).toBe(true)
    expect(hasUsableMetadata({ ...base, voidedAt: 1 })).toBe(false)
  })

  test('isInEligibilityPool also holds the bank tier', () => {
    expect(isInEligibilityPool(base, ['diagnostic'], ALL_BANK_TIERS)).toBe(true)
    expect(isInEligibilityPool(base, ['diagnostic'], ['original'])).toBe(false)
    expect(isInEligibilityPool({ ...base, bankTier: 'original' }, ['diagnostic'], ['original'])).toBe(true)
  })
})

describe('bankTiersForStudent', () => {
  async function tiersFor(plans: ('pilot' | 'school')[]) {
    const t = convexTest(schema, modules)
    return t.run(async (ctx) => {
      const studentId = await ctx.db.insert('students', { email: 'a@x.co', normalizedEmail: 'a@x.co', createdAt: now, updatedAt: now, lastSeenAt: now })
      for (const plan of plans) {
        const orgId = await ctx.db.insert('organizations', { name: plan, plan, seatLimit: 10, licenseEndsAt: now, createdAt: now })
        await ctx.db.insert('memberships', { orgId, accountId: studentId, role: 'student', createdAt: now })
      }
      return bankTiersForStudent(ctx, studentId)
    })
  }

  test('no school: ICFES and original', async () => {
    expect(await tiersFor([])).toEqual(ALL_BANK_TIERS)
  })

  test('a pilot school is not a paying one', async () => {
    expect(await tiersFor(['pilot'])).toEqual(ALL_BANK_TIERS)
  })

  test('any paying school means original only (G1)', async () => {
    expect(await tiersFor(['school'])).toEqual(['original'])
    expect(await tiersFor(['pilot', 'school'])).toEqual(['original'])
  })
})
