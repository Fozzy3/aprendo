import { describe, expect, test } from 'bun:test'
import { convexTest } from 'convex-test'
import schema from '../src/schema'
import { collectUsableQuestions } from '../src/questionPool'
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

      const questions = await collectUsableQuestions(ctx, ['diagnostic', 'practice_only'])
      return questions.map((question) => question.questionNumber).sort()
    })
    expect(numbers).toEqual([1, 2])
  })
})
