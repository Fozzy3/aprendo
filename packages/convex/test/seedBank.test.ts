import { describe, expect, test } from 'bun:test'
import { internal } from '../src/_generated/api'
import { runDeterministicChecks, validateGuide } from '../src/auditChecks'
import { AI_UPLOAD_SLUG, questionSource } from '../src/questionSource'
import { SEED_ITEMS, seedOptions, seedQuestionText } from '../src/seedBank'
import { getSubtopicContext, SUBJECT_IDS } from '../src/taxonomy'
import { setupTest } from './signIn'

describe('the 100 seed items', () => {
  test('there are 100, twenty per area, with unique ids', () => {
    expect(SEED_ITEMS).toHaveLength(100)
    expect(new Set(SEED_ITEMS.map((item) => item.id)).size).toBe(100)
    for (const subjectId of SUBJECT_IDS) {
      expect(SEED_ITEMS.filter((item) => item.subjectId === subjectId)).toHaveLength(20)
    }
  })

  test.each(SEED_ITEMS.map((item) => [item.id, item] as const))('%s follows the rules', (_id, item) => {
    const options = seedOptions(item)

    // Labels, one key.
    expect(options.map((option) => option.label).join('')).toMatch(/^(ABC|ABCD)$/)
    expect(options.filter((option) => option.label === item.correctOption)).toHaveLength(1)

    // The taxonomy exists and belongs together.
    const context = getSubtopicContext(item.primarySubtopicId)
    expect(context?.subjectId).toBe(item.subjectId)
    expect(context?.categoryId).toBe(item.categoryId)

    // Every wrong option guided; nothing leaks the key; step limits.
    expect(validateGuide({ options, answerCorrectOption: item.correctOption }, item.guide)).toEqual([])

    // The deterministic audit has nothing to refuse.
    const checks = runDeterministicChecks({
      question: {
        bodyMarkdown: seedQuestionText(item), options, answerCorrectOption: item.correctOption,
        subjectId: item.subjectId, categoryId: item.categoryId, primarySubtopicId: item.primarySubtopicId,
      },
      group: null,
      unresolvedUrls: [],
      crop: null,
    })
    expect(checks.filter((check) => check.result === 'fail')).toEqual([])
  })
})

describe('importing the seed bank', () => {
  async function seeded() {
    const t = setupTest()
    const pdfUploadId = await t.run(async (ctx) => ctx.db.insert('pdfUploads', {
      fileName: 'Preguntas generadas por IA', slug: AI_UPLOAD_SLUG, pdfStorageId: await ctx.storage.store(new Blob(['x'])),
      contentType: 'application/x-aprendo-ai-generated', sizeBytes: 0, status: 'completed', createdAt: 1, updatedAt: 1,
    }))
    await t.mutation(internal.seedBank.importSeedBank, { pdfUploadId })
    return { t, pdfUploadId }
  }

  test('inserts every item as original and pending, with a guide and an audit row', async () => {
    const { t, pdfUploadId } = await seeded()
    const questions = await t.run((ctx) => ctx.db.query('questions').collect())
    expect(questions).toHaveLength(100)
    expect(questions.every((question) => question.bankTier === 'original' && question.eligibility === 'pending')).toBe(true)
    expect(questions.every((question) => question.pdfUploadId === pdfUploadId && question.answerCorrectOption != null)).toBe(true)

    const guides = await t.run((ctx) => ctx.db.query('questionGuides').collect())
    expect(guides).toHaveLength(100)
    expect(guides.every((guide) => guide.status === 'pending')).toBe(true)

    const audits = await t.run((ctx) => ctx.db.query('questionAudits').collect())
    expect(audits).toHaveLength(100)
    expect(audits.every((audit) => audit.source.kind === 'authored')).toBe(true)
  })

  test('importing twice adds nothing', async () => {
    const { t, pdfUploadId } = await seeded()
    await t.mutation(internal.seedBank.importSeedBank, { pdfUploadId })
    expect(await t.run((ctx) => ctx.db.query('questions').collect())).toHaveLength(100)
    expect(await t.run((ctx) => ctx.db.query('questionGuides').collect())).toHaveLength(100)
    expect(await t.run((ctx) => ctx.db.query('questionAudits').collect())).toHaveLength(100)
  })

  test('a re-run after a reviewer fixed a stem does not bring the original back', async () => {
    const { t, pdfUploadId } = await seeded()
    await t.run(async (ctx) => ctx.db.patch('questions', (await ctx.db.query('questions').first())!._id, { bodyMarkdown: 'Enunciado corregido por un revisor' }))
    await t.mutation(internal.seedBank.importSeedBank, { pdfUploadId })
    expect(await t.run((ctx) => ctx.db.query('questions').collect())).toHaveLength(100)
  })

  test('every row keeps the id of its seed item', async () => {
    const { t } = await seeded()
    const ids = (await t.run((ctx) => ctx.db.query('questions').collect())).map((question) => question.seedItemId)
    expect(new Set(ids)).toEqual(new Set(SEED_ITEMS.map((item) => item.id)))
  })

  test('a row imported before seed ids is found by its text and takes its id', async () => {
    const { t, pdfUploadId } = await seeded()
    const old = await t.run(async (ctx) => {
      const question = (await ctx.db.query('questions').first())!
      await ctx.db.patch('questions', question._id, { seedItemId: undefined })
      return question
    })
    await t.mutation(internal.seedBank.importSeedBank, { pdfUploadId })
    expect(await t.run((ctx) => ctx.db.query('questions').collect())).toHaveLength(100)
    expect((await t.run((ctx) => ctx.db.get('questions', old._id)))?.seedItemId).toBe(old.seedItemId!)
  })

  test('a passage two items share is one group, whole', async () => {
    const { t } = await seeded()
    const groups = await t.run((ctx) => ctx.db.query('questionGroups').collect())
    expect(groups.length).toBeGreaterThan(0)
    expect(groups.every((group) => group.memberCount === 2)).toBe(true)
    const questions = await t.run((ctx) => ctx.db.query('questions').collect())
    for (const group of groups) {
      const members = questions.filter((question) => question.groupId === group._id)
      expect(members).toHaveLength(group.memberCount)
      expect(members.map((member) => member.groupPosition).sort()).toEqual([0, 1])
      expect(group.firstNumber).toBe(members[0]!.questionNumber)
    }
  })

  test('publishing opens only seed rows: never another item of the shared upload, nor a rejected seed', async () => {
    const { t, pdfUploadId } = await seeded()
    const llmId = await t.run((ctx) => ctx.db.insert('questions', {
      pdfUploadId, sequence: 999, questionNumber: 999, bodyMarkdown: 'Generada por un modelo', options: [], createdAt: 1, eligibility: 'pending', eligibilityReasons: ['ai_generated'],
    }))
    const rejectedId = await t.run(async (ctx) => {
      const audit = (await ctx.db.query('questionAudits').first())!
      await ctx.db.patch('questionAudits', audit._id, { status: 'rejected' })
      return audit.questionId
    })
    const { published } = await t.mutation(internal.seedBank.publishSeedForDemo, { pdfUploadId })
    expect(published).toBe(99)
    expect((await t.run((ctx) => ctx.db.get('questions', llmId)))?.eligibility).toBe('pending')
    expect((await t.run((ctx) => ctx.db.get('questions', rejectedId)))?.eligibility).toBe('pending')
  })

  test('publishing for the demo makes them eligible and leaves the sign-off pending', async () => {
    const { t, pdfUploadId } = await seeded()
    await t.mutation(internal.seedBank.publishSeedForDemo, { pdfUploadId })
    const questions = await t.run((ctx) => ctx.db.query('questions').collect())
    expect(questions.every((question) => question.eligibility === 'diagnostic')).toBe(true)
    const audits = await t.run((ctx) => ctx.db.query('questionAudits').collect())
    expect(audits.every((audit) => audit.status === 'needs_review')).toBe(true)
  })

  test('the source shown under the question says Aprendo with AI', async () => {
    const { t, pdfUploadId } = await seeded()
    const upload = await t.run((ctx) => ctx.db.get('pdfUploads', pdfUploadId))
    expect(questionSource(upload).label).toContain('Aprendo con IA')
  })
})
