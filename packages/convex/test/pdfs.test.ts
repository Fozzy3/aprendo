import { describe, expect, test } from 'bun:test'
import { api, internal } from '../src/_generated/api'
import { buildQuestionBodyMarkdown, gatedEligibility } from '../src/pdfPipeline'
import { answerResultPatch } from '../src/pdfs'
import { setupTest, signUp } from './signIn'

describe('retryPdfUpload', () => {
  // Reprocessing deletes the upload's questions and creates new ids, which
  // leaves every student answer pointing at nothing.
  test('refuses an upload students have already answered', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'equipo@aprendo.co', { isAdmin: true })
    const pdfUploadId = await t.run(async (ctx) => {
      const now = Date.now()
      const pdfUploadId = await ctx.db.insert('pdfUploads', {
        fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['x'])),
        contentType: 'application/pdf', sizeBytes: 1, status: 'failed', createdAt: now, updatedAt: now,
      })
      const questionId = await ctx.db.insert('questions', {
        pdfUploadId, questionNumber: 1, sequence: 1, bodyMarkdown: 'q', options: [], createdAt: now,
      })
      const sessionId = await ctx.db.insert('sessions', {
        studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual',
        startedAt: now, questionCount: 1, currentPosition: 0,
      })
      const sessionQuestionId = await ctx.db.insert('sessionQuestions', {
        sessionId, questionId, position: 0, selectionReason: 'topic_focus',
      })
      await ctx.db.insert('questionAttempts', {
        studentId, sessionId, questionId, sessionQuestionId, attemptType: 'topic',
        usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false,
      })
      return pdfUploadId
    })

    await expect(as.mutation(api.pdfs.retryPdfUpload, { pdfUploadId })).rejects.toThrow(/respuestas de estudiantes/)
  })
})

describe('answerResultPatch', () => {
  // Convex removes a field patched with undefined, so a failed model call used
  // to erase the key the row already had. `submitAnswer` throws without one.
  test('a failed call leaves every answer field out of the patch', () => {
    const patch = answerResultPatch({ status: 'failed', errorMessage: 'timeout' }, 1000)
    expect(patch).toEqual({ answerStatus: 'failed', answerErrorMessage: 'timeout', answerCompletedAt: 1000 })
    expect('answerCorrectOption' in patch).toBe(false)
  })

  test('a successful call writes the answer', () => {
    const patch = answerResultPatch({ status: 'completed', correctOption: 'B', confidence: 0.9 }, 1000)
    expect(patch).toMatchObject({ answerStatus: 'completed', answerCorrectOption: 'B', answerConfidence: 0.9 })
  })
})

describe('enrichment sees the images', () => {
  test('the crop, the group crop and the shared images of a question reach the model', async () => {
    const t = setupTest()
    const questionId = await t.run(async (ctx) => {
      const crop = await ctx.storage.store(new Blob(['png'], { type: 'image/png' }))
      const groupCrop = await ctx.storage.store(new Blob(['png2'], { type: 'image/png' }))
      const pdfUploadId = await ctx.db.insert('pdfUploads', {
        fileName: 'a.pdf', slug: 'a', pdfStorageId: crop, contentType: 'application/pdf', sizeBytes: 1, status: 'failed', createdAt: 1, updatedAt: 1,
      })
      const groupId = await ctx.db.insert('questionGroups', {
        pdfUploadId, contextKey: 'k', contextMarkdown: 'Texto', contextImages: ['https://x.co/shared'],
        renderedContextImageId: groupCrop, firstNumber: 1, lastNumber: 2, memberCount: 2, createdAt: 1,
      })
      return ctx.db.insert('questions', {
        pdfUploadId, groupId, questionNumber: 1, sequence: 1, bodyMarkdown: 'q', options: [], createdAt: 1, renderedStemImageId: crop,
      })
    })
    const [question] = await t.query(internal.pdfs.getQuestionsForEnrichment, { questionIds: [questionId] })
    expect(question?.images).toHaveLength(3)
    expect(question?.images?.map((image) => image.url)).toContain('https://x.co/shared')
  })
})

describe('loading a PDF goes through the audit', () => {
  async function upload(t: ReturnType<typeof setupTest>) {
    return t.run(async (ctx) => ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['x'])), contentType: 'application/pdf',
      sizeBytes: 1, status: 'enriching', createdAt: 1, updatedAt: 1,
    }))
  }

  test('a new question gets its audit row', async () => {
    const t = setupTest()
    const pdfUploadId = await upload(t)
    await t.mutation(internal.pdfs.insertPdfQuestionsChunk, {
      questions: [{ pdfUploadId, questionNumber: 1, sequence: 1, bodyMarkdown: 'q', options: [], createdAt: 1, eligibility: 'pending' }],
    })
    const audits = await t.run((ctx) => ctx.db.query('questionAudits').collect())
    expect(audits).toHaveLength(1)
    expect(audits[0]?.source.kind).toBe('ocr')
  })

  test('a PDF counts as processed while its questions wait for review', async () => {
    const t = setupTest()
    const pdfUploadId = await upload(t)
    await t.run((ctx) => ctx.db.insert('questions', {
      pdfUploadId, questionNumber: 1, sequence: 1, bodyMarkdown: 'q', options: [], createdAt: 1,
      answerStatus: 'completed', taxonomyStatus: 'completed', eligibility: 'pending',
    }))
    await t.mutation(internal.pdfs.refreshPdfEnrichmentStats, { pdfUploadId })
    expect((await t.run((ctx) => ctx.db.get('pdfUploads', pdfUploadId)))?.status).toBe('completed')
  })
})

describe('gatedEligibility', () => {
  test('a good automatic score waits in pending; a person publishes', () => {
    expect(gatedEligibility({ eligibility: 'diagnostic', reasons: ['diagnostic_ready'] })).toEqual({ eligibility: 'pending', reasons: ['diagnostic_ready'] })
    expect(gatedEligibility({ eligibility: 'practice_only', reasons: ['practice_only_confidence'] })).toEqual({ eligibility: 'pending', reasons: ['practice_only_confidence'] })
  })

  test('an automatic exclusion stays excluded', () => {
    expect(gatedEligibility({ eligibility: 'excluded', reasons: ['answer_inference_failed'] })).toEqual({ eligibility: 'excluded', reasons: ['answer_inference_failed'] })
  })
})

describe('the OCR text keeps its figures', () => {
  test('stem images are written into the body instead of dropped', () => {
    const body = buildQuestionBodyMarkdown({ questionNumber: 1, stem: 'Observa:', stemImages: ['img-1.png'], options: [] }, false)
    expect(body).toContain('![](img-1.png)')
  })
})
