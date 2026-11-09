import { describe, expect, test } from 'bun:test'
import { internal } from '../src/_generated/api'
import { BOOKLET_CONTENT_TYPE } from '../src/audit'
import { bookletReloadPatch, planBookletFinish } from '../src/booklets'
import { setupTest } from './signIn'

type Q = { _id: string; questionNumber: number; groupId?: string }
type G = { _id: string; contextKey: string }

const ids = (rows: Array<{ _id: string }>) => rows.map((row) => row._id)

describe('bookletReloadPatch', () => {
  const content = { bodyMarkdown: 'texto' }
  const settled = { eligibility: 'diagnostic' as const }

  // A teacher's corrected key or a rejected question must survive re-running
  // the loader, which is what the parser-fix workflow does.
  test('a live row takes new text but keeps its key and eligibility', () => {
    const patch = bookletReloadPatch({ eligibilityReasons: ['icfes_answer_key'] }, content, settled)
    expect(patch).toEqual(content)
  })

  test('a row the audit excluded stays excluded', () => {
    const patch = bookletReloadPatch({ eligibilityReasons: ['audit_rejected'] }, content, settled)
    expect(patch).toEqual(content)
  })

  test('a row the booklet had dropped comes back whole', () => {
    const patch = bookletReloadPatch({ eligibilityReasons: ['removed_from_booklet'] }, content, settled)
    expect(patch).toEqual({ ...content, ...settled })
  })
})

describe('planBookletFinish', () => {
  // A number goes missing when the booklet changes, but also when the parser's
  // filters drop it. Deleting it orphaned every attempt and session question
  // that pointed at it, so the row is retired and keeps its id.
  test('a question missing from this run is retired, not dropped', () => {
    const questions: Q[] = [
      { _id: 'q1', questionNumber: 1 },
      { _id: 'q14', questionNumber: 14 },
    ]
    const plan = planBookletFinish(questions, [], new Set([1]), new Set())
    expect(ids(plan.kept)).toEqual(['q1'])
    expect(ids(plan.retired)).toEqual(['q14'])
  })

  test('a group gone from the booklet that no row references is deleted', () => {
    const groups: G[] = [{ _id: 'g-old', contextKey: 'old' }]
    const plan = planBookletFinish([{ _id: 'q1', questionNumber: 1 }], groups, new Set([1]), new Set())
    expect(ids(plan.orphanGroups)).toEqual(['g-old'])
  })

  // Review renders a question with its passage; dropping the group would show
  // a retired question's stem without the text it asks about.
  test('a gone group still referenced by a retired question is kept', () => {
    const questions: Q[] = [
      { _id: 'q1', questionNumber: 1 },
      { _id: 'q14', questionNumber: 14, groupId: 'g-old' },
    ]
    const groups: G[] = [{ _id: 'g-old', contextKey: 'old' }]
    const plan = planBookletFinish(questions, groups, new Set([1]), new Set())
    expect(plan.orphanGroups).toEqual([])
  })

  test('a group whose key is still in the booklet is never deleted', () => {
    const groups: G[] = [{ _id: 'g1', contextKey: 'k1' }]
    const plan = planBookletFinish([], groups, new Set(), new Set(['k1']))
    expect(plan.orphanGroups).toEqual([])
  })
})

describe('loading a booklet goes through the audit', () => {
  const baseQuestion = {
    stem: '¿Cuánto vale x?', options: [{ label: 'A', bodyMarkdown: 'uno' }, { label: 'B', bodyMarkdown: 'dos' }, { label: 'C', bodyMarkdown: 'tres' }],
    correctOption: 'B', categoryId: 'c', subtopicId: 's', tagConfidence: 1, confidentTag: true,
  }

  async function booklet(t: ReturnType<typeof setupTest>) {
    return t.run(async (ctx) => ctx.db.insert('pdfUploads', {
      fileName: 'b', slug: 'b', pdfStorageId: await ctx.storage.store(new Blob(['x'])), contentType: BOOKLET_CONTENT_TYPE,
      sizeBytes: 0, status: 'completed', createdAt: 1, updatedAt: 1,
    }))
  }

  test('a new question arrives pending with an audit row', async () => {
    const t = setupTest()
    const pdfUploadId = await booklet(t)
    await t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', questions: [{ number: 1, ...baseQuestion }] })
    const [question] = await t.run((ctx) => ctx.db.query('questions').collect())
    expect(question?.eligibility).toBe('pending')
    const [audit] = await t.run((ctx) => ctx.db.query('questionAudits').collect())
    expect(audit?.status).toBe('pending_checks')
    expect(audit?.source.kind).toBe('booklet')
  })

  describe('a later pass that only adds to the booklet', () => {
    const group = { key: 'g1', contextMarkdown: 'Texto', firstNumber: 1, lastNumber: 2, memberCount: 2, position: 0 }

    test('a new row is stamped as an ICFES item of grade 11 and keeps the printed key', async () => {
      const t = setupTest()
      const pdfUploadId = await booklet(t)
      await t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', addOnly: true, questions: [{ number: 1, ...baseQuestion }] })
      const [question] = await t.run((ctx) => ctx.db.query('questions').collect())
      expect(question).toMatchObject({ bankTier: 'icfes', targetGrade: 11, answerCorrectOption: 'B', answerModelId: 'icfes-booklet-key', eligibility: 'pending' })
    })

    test('a key we worked out ourselves is never labelled as printed', async () => {
      const t = setupTest()
      const pdfUploadId = await booklet(t)
      await t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', addOnly: true, questions: [{ number: 1, ...baseQuestion, answerModelId: 'two-solvers-v1' }] })
      const [question] = await t.run((ctx) => ctx.db.query('questions').collect())
      expect(question).toMatchObject({ answerCorrectOption: 'B', answerModelId: 'two-solvers-v1', answerConfidence: 0.8 })
    })

    test('a question or group already in the bank stays byte for byte', async () => {
      const t = setupTest()
      const pdfUploadId = await booklet(t)
      await t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', questions: [{ number: 1, ...baseQuestion, group }] })
      const before = await t.run(async (ctx) => [await ctx.db.query('questions').collect(), await ctx.db.query('questionGroups').collect(), await ctx.db.query('questionAudits').collect()])

      const result = await t.mutation(internal.booklets.upsertBookletQuestions, {
        pdfUploadId,
        subjectId: 'matematicas',
        addOnly: true,
        questions: [
          { number: 1, ...baseQuestion, stem: 'Otro', correctOption: 'A', group: { ...group, contextMarkdown: 'Otro', memberCount: 9 } },
          { number: 2, ...baseQuestion, group: { ...group, key: 'g2', contextMarkdown: 'Nuevo' } },
        ],
      })

      expect(result).toMatchObject({ inserted: 1, keyConflicts: [] })
      const after = await t.run(async (ctx) => [await ctx.db.query('questions').collect(), await ctx.db.query('questionGroups').collect(), await ctx.db.query('questionAudits').collect()])
      expect(after[0]!.slice(0, 1)).toEqual(before[0]!)
      expect(after[1]!.filter((row) => row.contextKey === 'g1')).toEqual(before[1]!)
      expect(after[2]!.slice(0, 1)).toEqual(before[2]!)
      expect(after[0]!).toHaveLength(2)
      expect(after[1]!.map((row) => row.contextKey).sort()).toEqual(['g1', 'g2'])
    })

    test('a second run inserts nothing', async () => {
      const t = setupTest()
      const pdfUploadId = await booklet(t)
      const load = () => t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', addOnly: true, questions: [{ number: 1, ...baseQuestion, group }] })
      expect((await load()).inserted).toBe(1)
      expect((await load()).inserted).toBe(0)
      expect(await t.run((ctx) => ctx.db.query('questions').collect())).toHaveLength(1)
      expect(await t.run((ctx) => ctx.db.query('questionGroups').collect())).toHaveLength(1)
    })
  })

  test('a figure question is kept for review, shown as its crop', async () => {
    const t = setupTest()
    const pdfUploadId = await booklet(t)
    await t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', questions: [{ number: 1, ...baseQuestion, needsArtwork: true }] })
    const [question] = await t.run((ctx) => ctx.db.query('questions').collect())
    expect(question?.eligibility).toBe('pending')
    expect(question?.stemDisplay).toBe('scan')
    const [audit] = await t.run((ctx) => ctx.db.query('questionAudits').collect())
    expect(audit?.status).toBe('needs_review')
  })

  test('a printed key that differs on reload is never applied, but reaches the audit', async () => {
    const t = setupTest()
    const pdfUploadId = await booklet(t)
    await t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', questions: [{ number: 1, ...baseQuestion }] })
    const { keyConflicts } = await t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', questions: [{ number: 1, ...baseQuestion, correctOption: 'A' }] })
    expect(keyConflicts).toEqual([1])
    const [question] = await t.run((ctx) => ctx.db.query('questions').collect())
    expect(question?.answerCorrectOption).toBe('B')
    const [audit] = await t.run((ctx) => ctx.db.query('questionAudits').collect())
    expect(audit?.history.at(-1)).toMatchObject({ field: 'key', after: 'A', source: 'printed_reread' })
    expect(audit?.status).toBe('needs_review')
  })

  describe('a reload and what the audit already holds', () => {
    const reworded = {
      stem: 'Texto que el parser arregló',
      options: [{ label: 'A', bodyMarkdown: 'uno bien' }, { label: 'B', bodyMarkdown: 'dos' }, { label: 'C', bodyMarkdown: 'tres' }],
    }

    async function loaded() {
      const t = setupTest()
      const pdfUploadId = await booklet(t)
      const load = (overrides: object = {}) => t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', questions: [{ number: 1, ...baseQuestion, ...overrides }] })
      await load()
      const rows = async () => ({
        question: (await t.run((ctx) => ctx.db.query('questions').first()))!,
        audit: (await t.run((ctx) => ctx.db.query('questionAudits').first()))!,
      })
      const patchAudit = async (fields: object) => t.run(async (ctx) => ctx.db.patch('questionAudits', (await ctx.db.query('questionAudits').first())!._id, fields))
      return { t, load, rows, patchAudit }
    }

    const reviewerId = (t: ReturnType<typeof setupTest>) => t.run((ctx) => ctx.db.insert('students', {
      email: 'p@x.co', normalizedEmail: 'p@x.co', createdAt: 1, updatedAt: 1, lastSeenAt: 1,
    }))

    test('a signed row keeps its text, and the difference goes to a person once', async () => {
      const { t, load, rows, patchAudit } = await loaded()
      await patchAudit({ status: 'approved', reviewedBy: await reviewerId(t), reviewedAt: 1 })
      await load(reworded)

      const { question, audit } = await rows()
      expect(question.bodyMarkdown).toBe(baseQuestion.stem)
      expect(question.options).toEqual(baseQuestion.options)
      expect(audit.status).toBe('needs_review')
      expect(audit.history.filter((entry) => entry.source === 'printed_reread').map((entry) => entry.field)).toEqual(['stem', 'options'])
      expect(audit.history.find((entry) => entry.field === 'stem' && entry.source === 'printed_reread')).toMatchObject({ before: baseQuestion.stem, after: reworded.stem })

      await patchAudit({ status: 'approved' })
      await load(reworded)
      const again = await rows()
      expect(again.audit.status).toBe('approved')
      expect(again.audit.history.filter((entry) => entry.source === 'printed_reread')).toHaveLength(2)
    })

    test('a reviewer\'s pending edit counts as signed too', async () => {
      const { t, load, rows, patchAudit } = await loaded()
      const by = await reviewerId(t)
      await t.run(async (ctx) => ctx.db.patch('questions', (await ctx.db.query('questions').first())!._id, { bodyMarkdown: 'Arreglado a mano' }))
      await patchAudit({ status: 'needs_review', history: [{ field: 'stem', before: 'x', after: 'Arreglado a mano', source: 'review', by, at: 1 }] })
      await load(reworded)
      expect((await rows()).question.bodyMarkdown).toBe('Arreglado a mano')
    })

    test('a model-passed row keeps the text it was checked against', async () => {
      const { load, rows, patchAudit } = await loaded()
      await patchAudit({ status: 'auto_passed' })
      await load(reworded)
      expect((await rows()).question.bodyMarkdown).toBe(baseQuestion.stem)
    })

    test('a parser fix still reaches a row nobody signed', async () => {
      const { load, rows } = await loaded()
      await load(reworded)
      const { question, audit } = await rows()
      expect(question.bodyMarkdown).toBe(reworded.stem)
      expect(question.options).toEqual(reworded.options)
      expect(audit.history.filter((entry) => entry.source === 'printed_reread')).toEqual([])
      expect(audit.status).toBe('pending_checks')
    })

    test('what a reviewer already replaced is not a difference', async () => {
      const { t, load, rows, patchAudit } = await loaded()
      const by = await reviewerId(t)
      await t.run(async (ctx) => ctx.db.patch('questions', (await ctx.db.query('questions').first())!._id, { bodyMarkdown: 'Corregido' }))
      await patchAudit({ status: 'fixed', reviewedBy: by, history: [{ field: 'stem', before: baseQuestion.stem, after: 'Corregido', source: 'review', by, at: 1 }] })
      await load()
      const { audit, question } = await rows()
      expect(question.bodyMarkdown).toBe('Corregido')
      expect(audit.status).toBe('fixed')
      expect(audit.history.filter((entry) => entry.source === 'printed_reread')).toEqual([])
    })

    test('a difference on a rejected row is recorded, and the rejection stands', async () => {
      const { t, load, rows, patchAudit } = await loaded()
      await patchAudit({ status: 'rejected', reviewedBy: await reviewerId(t) })
      await load(reworded)
      const { audit } = await rows()
      expect(audit.status).toBe('rejected')
      expect(audit.history.some((entry) => entry.field === 'stem' && entry.source === 'printed_reread')).toBe(true)
    })

    test('a retired row comes back without its printed key', async () => {
      const { t, load, rows } = await loaded()
      await t.run(async (ctx) => ctx.db.patch('questions', (await ctx.db.query('questions').first())!._id, { eligibility: 'excluded', eligibilityReasons: ['removed_from_booklet'] }))
      const { keyConflicts } = await load({ correctOption: 'A' })
      const { question, audit } = await rows()
      expect(keyConflicts).toEqual([1])
      expect(question.answerCorrectOption).toBe('B')
      expect(question.eligibility).toBe('pending')
      expect(audit.history.at(-1)).toMatchObject({ field: 'key', before: 'B', after: 'A', source: 'printed_reread' })
    })

    test('the same printed key is not recorded twice', async () => {
      const { load, rows } = await loaded()
      await load({ correctOption: 'A' })
      await load({ correctOption: 'A' })
      expect((await rows()).audit.history.filter((entry) => entry.source === 'printed_reread')).toHaveLength(1)
    })

    test('the pipeline still reads the printed key after a text difference', async () => {
      const { t, load, patchAudit } = await loaded()
      await load({ correctOption: 'A' })
      await patchAudit({ status: 'approved', reviewedBy: await reviewerId(t) })
      await load({ correctOption: 'A', ...reworded })
      await patchAudit({ status: 'pending_checks' })
      const [item] = await t.query(internal.audit.loadAuditBatch, { limit: 1 })
      expect(item?.printedKey).toBe('A')
    })
  })

  test('attaching crops records the page and reports the crops with no question', async () => {
    const t = setupTest()
    const pdfUploadId = await booklet(t)
    await t.mutation(internal.booklets.upsertBookletQuestions, { pdfUploadId, subjectId: 'matematicas', questions: [{ number: 1, ...baseQuestion }] })
    const [crop, page] = await t.run(async (ctx) => [
      await ctx.storage.store(new Blob(['a'])),
      await ctx.storage.store(new Blob(['b'])),
    ])
    const result = await t.mutation(internal.booklets.attachCrops, {
      pdfUploadId,
      questions: [
        { number: 1, storageId: crop!, page: 3, y: 120, pageStorageId: page },
        { number: 9, storageId: crop!, page: 4, y: 60 },
      ],
      groups: [],
    })
    expect(result.orphans).toEqual([9])
    const [audit] = await t.run((ctx) => ctx.db.query('questionAudits').collect())
    expect(audit?.source).toMatchObject({ page: 3, yStart: 120, pageImageId: page })
  })
})
