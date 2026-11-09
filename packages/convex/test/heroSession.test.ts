import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { setupTest, signUp } from './signIn'

const SUBTOPIC = 'matematicas.functions_variation.functions_graphs'

async function seedTopic(t: ReturnType<typeof setupTest>, studentId: Id<'students'>, count: number) {
  await t.run(async (ctx) => {
    await ctx.db.insert('sessions', {
      studentId, kind: 'nivelacion', status: 'completed', recommendationSource: 'manual',
      subjectId: 'matematicas', startedAt: 0, completedAt: 1, questionCount: 0, currentPosition: 0,
    })
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['pdf'])), contentType: 'application/pdf',
      sizeBytes: 3, status: 'uploaded', createdAt: 0, updatedAt: 0,
    })
    for (let position = 0; position < count; position += 1) {
      await ctx.db.insert('questions', {
        pdfUploadId, sequence: position, questionNumber: position + 1, bodyMarkdown: 'q',
        options: [{ label: 'A', bodyMarkdown: 'a' }, { label: 'B', bodyMarkdown: 'b' }], createdAt: 0,
        subjectId: 'matematicas', categoryId: 'matematicas.functions_variation', primarySubtopicId: SUBTOPIC,
        answerCorrectOption: 'A', eligibility: 'practice_only', bankTier: 'original',
      })
    }
  })
}

// Hoy's button names one topic and promises five questions (F54).
describe('createSession questionLimit', () => {
  test('trims a topic session to the limit', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    await seedTopic(t, studentId, 8)
    const sessionId = await as.mutation(api.sessions.createSession, { studentId, kind: 'topic', subtopicId: SUBTOPIC, questionLimit: 5 })
    const session = await t.run((ctx) => ctx.db.get('sessions', sessionId))
    expect(session?.questionCount).toBe(5)
  })

  test('a topic session keeps its full length without one', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    await seedTopic(t, studentId, 8)
    const sessionId = await as.mutation(api.sessions.createSession, { studentId, kind: 'topic', subtopicId: SUBTOPIC })
    const session = await t.run((ctx) => ctx.db.get('sessions', sessionId))
    expect(session?.questionCount).toBe(8)
  })

  test('cannot lengthen a session or shrink it to nothing', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    await seedTopic(t, studentId, 8)
    const longer = await as.mutation(api.sessions.createSession, { studentId, kind: 'topic', subtopicId: SUBTOPIC, questionLimit: 99 })
    expect((await t.run((ctx) => ctx.db.get('sessions', longer)))?.questionCount).toBe(8)
    await t.run((ctx) => ctx.db.patch('sessions', longer, { status: 'abandoned' }))
    const atLeastOne = await as.mutation(api.sessions.createSession, { studentId, kind: 'topic', subtopicId: SUBTOPIC, questionLimit: 0 })
    expect((await t.run((ctx) => ctx.db.get('sessions', atLeastOne)))?.questionCount).toBe(1)
  })
})
