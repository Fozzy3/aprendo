import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { internal } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { BOOKLET_CONTENT_TYPE } from '../src/audit'
import { setupTest } from './signIn'

const now = 1_700_000_000_000
const SUBTOPIC = 'matematicas.number_proportionality.ratios_proportions_percent'
const CATEGORY = 'matematicas.number_proportionality'

type Test = ReturnType<typeof setupTest>

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const OPTIONS = [
  { label: 'A', bodyMarkdown: 'uno' }, { label: 'B', bodyMarkdown: 'dos' },
  { label: 'C', bodyMarkdown: 'tres' }, { label: 'D', bodyMarkdown: 'cuatro' },
]
const CHECKS = ['key_matches_printed', 'stem_matches_page', 'options_match_page', 'context_present', 'figure_visible'].map((id) => ({ id, result: 'pass' as const }))

async function booklet(t: Test, slug: string, numbers: number[]) {
  return t.run(async (ctx) => {
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: `${slug}.pdf`, slug, pdfStorageId: await ctx.storage.store(new Blob(['pdf'])), contentType: BOOKLET_CONTENT_TYPE,
      sizeBytes: 3, status: 'completed', createdAt: now, updatedAt: now,
    })
    const ids: Record<number, Id<'questions'>> = {}
    for (const number of numbers) {
      ids[number] = await ctx.db.insert('questions', {
        pdfUploadId, sequence: number, questionNumber: number, bodyMarkdown: `Enunciado ${number} con errata`,
        options: OPTIONS, createdAt: now, subjectId: 'matematicas', categoryId: CATEGORY, primarySubtopicId: SUBTOPIC,
        answerCorrectOption: 'C', answerStatus: 'completed', eligibility: 'diagnostic',
      })
    }
    return { pdfUploadId, ids }
  })
}

const getQuestion = (t: Test, id: Id<'questions'>) => t.run((ctx) => ctx.db.get('questions', id))
const getAudit = (t: Test, id: Id<'questions'>) => t.run((ctx) =>
  ctx.db.query('questionAudits').withIndex('by_questionId', (q) => q.eq('questionId', id)).unique())
const groups = (t: Test, pdfUploadId: Id<'pdfUploads'>) => t.run((ctx) =>
  ctx.db.query('questionGroups').withIndex('by_pdfUploadId', (q) => q.eq('pdfUploadId', pdfUploadId)).collect())
const crop = (t: Test) => t.run((ctx) => ctx.storage.store(new Blob(['png'])))

describe('applyPageReview', () => {
  test('applies the text, records it, and leaves the key and the signature alone', async () => {
    const t = setupTest()
    const { ids } = await booklet(t, 'icfes-x', [1])

    await t.mutation(internal.audit.applyPageReview, {
      slug: 'icfes-x',
      questions: [{
        number: 1, checks: CHECKS, page: 12, yStart: 118, stemDisplay: 'text',
        stem: 'Enunciado 1 corregido',
        options: [...OPTIONS.slice(0, 3), { label: 'D', bodyMarkdown: 'cuatro bien' }],
      }],
    })

    const question = (await getQuestion(t, ids[1]!))!
    expect(question.bodyMarkdown).toBe('Enunciado 1 corregido')
    expect(question.options.at(-1)?.bodyMarkdown).toBe('cuatro bien')
    expect(question.stemDisplay).toBe('text')
    expect(question.answerCorrectOption).toBe('C')
    expect(question.eligibility).toBe('diagnostic')

    const audit = (await getAudit(t, ids[1]!))!
    expect(audit.status).toBe('auto_passed')
    expect(audit.reviewedBy).toBeUndefined()
    expect(audit.source).toMatchObject({ kind: 'booklet', page: 12, yStart: 118 })
    expect(audit.checks.map((check) => check.id)).toEqual(CHECKS.map((check) => check.id))
    const entries = audit.history.filter((entry) => entry.source === 'ai_page_review')
    expect(entries.map((entry) => entry.field).sort()).toEqual(['options', 'stem'])
    expect(entries.every((entry) => entry.by === undefined)).toBe(true)
    expect(audit.history.some((entry) => entry.field === 'key' && entry.source === 'ai_page_review')).toBe(false)
  })

  test('running it twice adds no second history entry', async () => {
    const t = setupTest()
    const { ids } = await booklet(t, 'icfes-x', [1])
    const review = { slug: 'icfes-x', questions: [{ number: 1, checks: CHECKS, stem: 'Enunciado 1 corregido' }] }
    await t.mutation(internal.audit.applyPageReview, review)
    await t.mutation(internal.audit.applyPageReview, review)
    expect((await getAudit(t, ids[1]!))!.history.filter((entry) => entry.source === 'ai_page_review')).toHaveLength(1)
  })

  test('a warning check keeps the row in the queue instead of passing it', async () => {
    const t = setupTest()
    const { ids } = await booklet(t, 'icfes-x', [1])
    await t.mutation(internal.audit.applyPageReview, {
      slug: 'icfes-x',
      questions: [{ number: 1, checks: [...CHECKS.slice(0, 4), { id: 'figure_visible', result: 'warn' as const }] }],
    })
    expect((await getAudit(t, ids[1]!))!.status).toBe('needs_review')
  })

  test('refuses options that lose the printed key, and never writes the key', async () => {
    const t = setupTest()
    const { ids } = await booklet(t, 'icfes-x', [1])
    await expect(t.mutation(internal.audit.applyPageReview, {
      slug: 'icfes-x',
      questions: [{ number: 1, checks: CHECKS, options: OPTIONS.filter((option) => option.label !== 'C') }],
    })).rejects.toThrow()
    expect((await getQuestion(t, ids[1]!))!.answerCorrectOption).toBe('C')
  })

  test('a person\'s approval or rejection is never overwritten', async () => {
    const t = setupTest()
    const { ids } = await booklet(t, 'icfes-x', [1, 2])
    await t.run(async (ctx) => {
      for (const [number, status] of [[1, 'approved'], [2, 'rejected']] as const) {
        await ctx.db.insert('questionAudits', {
          questionId: ids[number]!, subjectId: 'matematicas', status, pipelineVersion: 'audit-v1',
          source: { kind: 'booklet' }, checks: [], solvers: [], history: [], updatedAt: now,
        })
      }
    })
    await t.mutation(internal.audit.applyPageReview, {
      slug: 'icfes-x',
      questions: [{ number: 1, checks: CHECKS }, { number: 2, checks: CHECKS }],
    })
    expect((await getAudit(t, ids[1]!))!.status).toBe('approved')
    expect((await getAudit(t, ids[2]!))!.status).toBe('rejected')
  })

  test('shares one group per passage: creates it, reuses an existing one, records the text change', async () => {
    const t = setupTest()
    const { ids, pdfUploadId } = await booklet(t, 'icfes-x', [4, 5, 6])
    const image = await crop(t)
    const existingGroupId = await t.run((ctx) => ctx.db.insert('questionGroups', {
      pdfUploadId, contextKey: 'q4', contextMarkdown: 'Texto con cabecera', firstNumber: 4, lastNumber: 4, memberCount: 1, createdAt: now,
    }))
    await t.run((ctx) => ctx.db.patch('questions', ids[4]!, { groupId: existingGroupId, groupPosition: 0 }))

    const passage = { key: 'q4', contextMarkdown: 'Texto limpio', contextImageId: image, firstNumber: 4, lastNumber: 5, memberCount: 2 }
    await t.mutation(internal.audit.applyPageReview, {
      slug: 'icfes-x',
      questions: [
        { number: 4, checks: CHECKS, group: { ...passage, position: 0 } },
        { number: 5, checks: CHECKS, group: { ...passage, position: 1 } },
        { number: 6, checks: CHECKS, group: { key: 'page-review-g6-6', contextMarkdown: '', contextImageId: image, firstNumber: 6, lastNumber: 6, memberCount: 1, position: 0 } },
      ],
    })

    const rows = await groups(t, pdfUploadId)
    expect(rows).toHaveLength(2)
    const shared = rows.find((row) => row.contextKey === 'q4')!
    expect(shared.contextMarkdown).toBe('Texto limpio')
    expect(shared.renderedContextImageId).toBe(image)
    expect([shared.firstNumber, shared.lastNumber, shared.memberCount]).toEqual([4, 5, 2])

    const [four, five] = await Promise.all([getQuestion(t, ids[4]!), getQuestion(t, ids[5]!)])
    expect(five!.groupId).toBe(four!.groupId!)
    expect(five!.groupPosition).toBe(1)
    expect((await getAudit(t, ids[5]!))!.history.filter((entry) => entry.source === 'ai_page_review' && entry.field === 'context')).toHaveLength(1)
    expect(rows.find((row) => row.contextKey === 'page-review-g6-6')!.renderedContextImageId).toBe(image)
  })

  test('a question that must not carry a passage leaves its group', async () => {
    const t = setupTest()
    const { ids, pdfUploadId } = await booklet(t, 'icfes-x', [2])
    const groupId = await t.run((ctx) => ctx.db.insert('questionGroups', {
      pdfUploadId, contextKey: 'q2', contextMarkdown: 'No era de esta', firstNumber: 2, lastNumber: 2, memberCount: 1, createdAt: now,
    }))
    await t.run((ctx) => ctx.db.patch('questions', ids[2]!, { groupId, groupPosition: 0 }))

    await t.mutation(internal.audit.applyPageReview, { slug: 'icfes-x', questions: [{ number: 2, checks: CHECKS, leaveGroup: true }] })

    const question = (await getQuestion(t, ids[2]!))!
    expect(question.groupId).toBeUndefined()
    expect(question.groupPosition).toBeUndefined()
  })

  test('a scan crop replaces the stem image', async () => {
    const t = setupTest()
    const { ids } = await booklet(t, 'icfes-x', [6])
    const image = await crop(t)
    await t.mutation(internal.audit.applyPageReview, { slug: 'icfes-x', questions: [{ number: 6, checks: CHECKS, stemDisplay: 'scan', stemImageId: image }] })
    const question = (await getQuestion(t, ids[6]!))!
    expect(question.renderedStemImageId).toBe(image)
    expect(question.stemDisplay).toBe('scan')
  })

  test('a duplicate is excluded, pointing at the row it repeats, and is not voided', async () => {
    const t = setupTest()
    const first = await booklet(t, 'icfes-a', [3])
    const second = await booklet(t, 'icfes-b', [3])

    await t.mutation(internal.audit.applyPageReview, { slug: 'icfes-b', questions: [{ number: 3, checks: CHECKS, duplicateOf: { slug: 'icfes-a', number: 3 } }] })

    const row = (await getQuestion(t, second.ids[3]!))!
    expect(row.eligibility).toBe('excluded')
    expect(row.eligibilityReasons).toEqual([`duplicate_of:${first.ids[3]}`])
    expect(row.voidedAt).toBeUndefined()
    expect((await getQuestion(t, first.ids[3]!))!.eligibility).toBe('diagnostic')
  })
})

describe('applyPageReview, publication of a new row', () => {
  async function pending(t: Test) {
    const { ids } = await booklet(t, 'icfes-new', [1])
    await t.run((ctx) => ctx.db.patch('questions', ids[1]!, { eligibility: 'pending' }))
    return ids[1]!
  }

  test('publish makes it eligible when every check passes', async () => {
    const t = setupTest()
    const id = await pending(t)
    await t.mutation(internal.audit.applyPageReview, { slug: 'icfes-new', questions: [{ number: 1, checks: CHECKS, publish: true }] })
    expect(await getQuestion(t, id)).toMatchObject({ eligibility: 'diagnostic', eligibilityReasons: ['audit_approved'] })
    expect((await getAudit(t, id))!.status).toBe('auto_passed')
  })

  test('publish does not reach a student when a check failed', async () => {
    const t = setupTest()
    const id = await pending(t)
    await t.mutation(internal.audit.applyPageReview, { slug: 'icfes-new', questions: [{ number: 1, checks: [{ id: 'key_matches_printed', result: 'fail' as const }], publish: true }] })
    expect((await getQuestion(t, id))!.eligibility).toBe('pending')
    expect((await getAudit(t, id))!.status).toBe('needs_review')
  })

  test('excludeReason keeps it from students and sends it to a person', async () => {
    const t = setupTest()
    const id = await pending(t)
    await t.mutation(internal.audit.applyPageReview, { slug: 'icfes-new', questions: [{ number: 1, checks: [{ id: 'key_matches_printed', result: 'fail' as const }], excludeReason: 'needs_person' }] })
    expect(await getQuestion(t, id)).toMatchObject({ eligibility: 'excluded', eligibilityReasons: ['needs_person'] })
    expect((await getAudit(t, id))!.status).toBe('needs_review')
  })
})

describe('applySeedReview', () => {
  test('finds an unkeyed row by its text and gives it the seed id', async () => {
    const t = setupTest()
    const { ids } = await booklet(t, 'ai-generated', [7])
    const guideId = await t.run(async (ctx) => {
      await ctx.db.patch('questions', ids[7]!, { bankTier: 'original' })
      await ctx.db.insert('questionAudits', {
        questionId: ids[7]!, subjectId: 'ingles', status: 'needs_review', pipelineVersion: 'audit-v1',
        source: { kind: 'authored' }, checks: [], solvers: [], history: [], updatedAt: now,
      })
      return ctx.db.insert('questionGuides', { questionId: ids[7]!, hint: 'h', byOption: {}, reveal: 'viejo', modelId: 'm', promptVersion: 'v', status: 'pending', createdAt: now })
    })

    const result = await t.mutation(internal.audit.applySeedReview, {
      items: [{ seedItemId: 'ing-01', previousBody: 'Enunciado 7 con errata', bodyMarkdown: 'Enunciado 7 corregido', guide: { hint: 'h', byOption: {}, reveal: 'nuevo' } }],
    })

    expect(result).toEqual({ applied: 1, missing: [] })
    expect(await getQuestion(t, ids[7]!)).toMatchObject({ seedItemId: 'ing-01', bodyMarkdown: 'Enunciado 7 corregido' })
    expect((await t.run((ctx) => ctx.db.get('questionGuides', guideId)))!.reveal).toBe('nuevo')
  })

  test('corrects the guide and a shared context; the audit keeps waiting for a person', async () => {
    const t = setupTest()
    const { ids, pdfUploadId } = await booklet(t, 'ai-generated', [41])
    const { guideId, groupId } = await t.run(async (ctx) => {
      await ctx.db.patch('questions', ids[41]!, { seedItemId: 'lc-01', bankTier: 'original' })
      const groupId = await ctx.db.insert('questionGroups', {
        pdfUploadId, contextKey: 'seed-lc-01', contextMarkdown: 'Texto viejo', firstNumber: 41, lastNumber: 42, memberCount: 2, createdAt: now,
      })
      await ctx.db.patch('questions', ids[41]!, { groupId })
      await ctx.db.insert('questionAudits', {
        questionId: ids[41]!, subjectId: 'lectura_critica', status: 'needs_review', pipelineVersion: 'audit-v1',
        source: { kind: 'authored' }, checks: [], solvers: [], history: [], updatedAt: now,
      })
      const guideId = await ctx.db.insert('questionGuides', {
        questionId: ids[41]!, hint: 'h', byOption: {}, reveal: 'viejo', modelId: 'm', promptVersion: 'v', status: 'pending', createdAt: now,
      })
      return { guideId, groupId }
    })

    await t.mutation(internal.audit.applySeedReview, {
      items: [{ seedItemId: 'lc-01', previousBody: 'irrelevante', contextMarkdown: 'Texto nuevo', guide: { hint: 'h', byOption: {}, reveal: 'nuevo' } }],
    })

    const guide = (await t.run((ctx) => ctx.db.get('questionGuides', guideId)))!
    expect(guide.reveal).toBe('nuevo')
    expect(guide.status).toBe('pending')
    expect((await t.run((ctx) => ctx.db.get('questionGroups', groupId)))!.contextMarkdown).toBe('Texto nuevo')
    const audit = (await getAudit(t, ids[41]!))!
    expect(audit.status).toBe('needs_review')
    expect(audit.history.map((entry) => entry.field).sort()).toEqual(['context', 'guide'])
    expect(audit.history.every((entry) => entry.source === 'ai_page_review')).toBe(true)
    expect((await getQuestion(t, ids[41]!))!.answerCorrectOption).toBe('C')
  })
})
