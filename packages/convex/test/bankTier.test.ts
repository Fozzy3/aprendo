import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { setupTest, signUp } from './signIn'

const SUBTOPIC = 'matematicas.functions_variation.functions_graphs'
const now = 1_700_000_000_000

/** Two usable items of one subtopic, one per tier, and a placed student in a school of `plan`. */
async function seed(t: ReturnType<typeof setupTest>, studentId: Id<'students'>, plan: 'pilot' | 'school' | null) {
  return t.run(async (ctx) => {
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['pdf'])), contentType: 'application/pdf',
      sizeBytes: 3, status: 'completed', createdAt: now, updatedAt: now,
    })
    let sequence = 0
    const insert = (bankTier?: 'icfes' | 'original') =>
      ctx.db.insert('questions', {
        pdfUploadId, sequence: ++sequence, questionNumber: sequence, bodyMarkdown: 'q',
        options: [{ label: 'A', bodyMarkdown: 'a' }, { label: 'B', bodyMarkdown: 'b' }], createdAt: now,
        subjectId: 'matematicas', categoryId: 'c', primarySubtopicId: SUBTOPIC, answerCorrectOption: 'A', eligibility: 'practice_only', bankTier,
      })
    const icfesId = await insert()
    const originalId = await insert('original')
    if (plan != null) {
      const orgId = await ctx.db.insert('organizations', { name: 'x', plan, seatLimit: 10, licenseEndsAt: now, createdAt: now })
      await ctx.db.insert('memberships', { orgId, accountId: studentId, role: 'student', createdAt: now })
    }
    await ctx.db.insert('sessions', {
      studentId, kind: 'nivelacion', status: 'completed', recommendationSource: 'manual', subjectId: 'matematicas',
      startedAt: 0, completedAt: 1, questionCount: 0, currentPosition: 0,
    })
    return { icfesId, originalId }
  })
}

async function servedIn(t: ReturnType<typeof setupTest>, sessionId: Id<'sessions'>) {
  return (await t.run((ctx) => ctx.db.query('sessionQuestions').withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId)).collect()))
    .map((row) => row.questionId)
}

describe('bank tier gate (G1)', () => {
  test('a free student draws ICFES and original', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const { icfesId, originalId } = await seed(t, studentId, null)
    const sessionId = await as.mutation(api.sessions.createSession, { studentId, kind: 'topic', subtopicId: SUBTOPIC })
    expect((await servedIn(t, sessionId)).sort()).toEqual([icfesId, originalId].sort())
  })

  test('a paying school draws only original in every launcher and in the builder counts', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const { originalId } = await seed(t, studentId, 'school')
    const sessionId = await as.mutation(api.sessions.createSession, { studentId, kind: 'topic', subtopicId: SUBTOPIC })
    expect(await servedIn(t, sessionId)).toEqual([originalId])

    const counts = await as.query(api.sessions.getPracticeBuilderCounts, { studentId, filters: { subjectId: 'matematicas', source: 'todas' } })
    expect(counts.available).toBe(1)

    const recommended = await as.mutation(api.sessions.createSession, { studentId, kind: 'recommended' })
    expect(await servedIn(t, recommended)).toEqual([originalId])
  })

  test('the retry re-check drops an ICFES miss for a paying school', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const { icfesId, originalId } = await seed(t, studentId, 'school')
    const missedSession = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert('sessions', {
        studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual', subjectId: 'matematicas',
        startedAt: now, completedAt: now, questionCount: 2, currentPosition: 2,
      })
      let position = 0
      for (const questionId of [icfesId, originalId]) {
        const sessionQuestionId = await ctx.db.insert('sessionQuestions', { sessionId, questionId, position: position++, selectionReason: 'topic_focus' })
        await ctx.db.insert('questionAttempts', {
          studentId, sessionId, questionId, sessionQuestionId, attemptType: 'topic', selectedOption: 'B', isCorrect: false, answeredAt: now,
          usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false,
        })
      }
      return sessionId
    })
    const retry = await as.mutation(api.sessions.createSession, { studentId, kind: 'repaso', retryFromSessionId: missedSession })
    expect(await servedIn(t, retry)).toEqual([originalId])
  })

  test('a voided question leaves the repaso re-check too', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const { icfesId } = await seed(t, studentId, null)
    await t.run((ctx) => ctx.db.patch('questions', icfesId, { voidedAt: now }))
    const sessionId = await as.mutation(api.sessions.createSession, { studentId, kind: 'topic', subtopicId: SUBTOPIC })
    expect(await servedIn(t, sessionId)).not.toContain(icfesId)
  })
})

describe('getSession and stemDisplay', () => {
  test('text hides the scan; scan or absent keep it', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const { icfesId, originalId } = await seed(t, studentId, null)
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(['png'])))
    await t.run(async (ctx) => {
      await ctx.db.patch('questions', icfesId, { renderedStemImageId: storageId, stemDisplay: 'scan' })
      await ctx.db.patch('questions', originalId, { renderedStemImageId: storageId, stemDisplay: 'text' })
    })
    const sessionId = await as.mutation(api.sessions.createSession, { studentId, kind: 'topic', subtopicId: SUBTOPIC })
    const session = await as.query(api.sessions.getSession, { sessionId })
    const urlFor = (id: Id<'questions'>) => session?.questions.find((item) => item.question._id === id)?.stemImageUrl
    expect(urlFor(icfesId)).toBeString()
    expect(urlFor(originalId)).toBeNull()
  })
})
