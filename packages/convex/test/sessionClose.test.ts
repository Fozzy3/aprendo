import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { setupTest, signUp } from './signIn'

const SUBTOPIC = 'matematicas.functions_variation.functions_graphs'

/** An immediate-feedback topic practice of `count` questions on one subtopic, all answered. */
async function seedPractice(t: ReturnType<typeof setupTest>, studentId: Id<'students'>, correct: boolean[], usedTutor = false) {
  return t.run(async (ctx) => {
    const now = Date.now()
    const pdfStorageId = await ctx.storage.store(new Blob(['pdf']))
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: 'a', pdfStorageId, contentType: 'application/pdf',
      sizeBytes: 3, status: 'uploaded', createdAt: now, updatedAt: now,
    })
    const sessionId = await ctx.db.insert('sessions', {
      studentId, kind: 'topic', status: 'in_progress', recommendationSource: 'manual', feedbackMode: 'inmediata',
      subjectId: 'matematicas', startedAt: now, questionCount: correct.length, currentPosition: 1,
    })
    for (const [position, isCorrect] of correct.entries()) {
      const questionId = await ctx.db.insert('questions', {
        pdfUploadId, sequence: position, questionNumber: position + 1, bodyMarkdown: 'q',
        options: [{ label: 'A', bodyMarkdown: 'a' }, { label: 'B', bodyMarkdown: 'b' }],
        createdAt: now, subjectId: 'matematicas', categoryId: 'matematicas.functions_variation', primarySubtopicId: SUBTOPIC, answerCorrectOption: 'A',
      })
      const sessionQuestionId = await ctx.db.insert('sessionQuestions', {
        sessionId, questionId, position, selectionReason: 'topic_focus',
      })
      await ctx.db.insert('questionAttempts', {
        studentId, sessionId, questionId, sessionQuestionId, attemptType: 'topic',
        selectedOption: isCorrect ? 'A' : 'B', isCorrect, answeredAt: now, responseTimeMs: 1000,
        usedHint: false, usedTutor, hintCount: 0, tutorMessageCount: usedTutor ? 1 : 0, wasSkipped: false,
      })
    }
    return sessionId
  })
}

describe('closing a practice', () => {
  test('records how each subtopic moved, so the review can say it', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const sessionId = await seedPractice(t, studentId, [true, true, true, true])
    await as.mutation(api.sessions.completeSession, { sessionId })
    const session = await t.run((ctx) => ctx.db.get('sessions', sessionId))
    expect(session?.masteryChanges).toEqual([{ subtopicId: SUBTOPIC, from: 'sin_empezar', to: 'competente' }])
  })

  test('a perfect practice with the tutor stops at familiar', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const sessionId = await seedPractice(t, studentId, [true, true, true, true], true)
    await as.mutation(api.sessions.completeSession, { sessionId })
    const session = await t.run((ctx) => ctx.db.get('sessions', sessionId))
    expect(session?.masteryChanges).toEqual([{ subtopicId: SUBTOPIC, from: 'sin_empezar', to: 'familiar' }])
  })
})

describe('spaced review', () => {
  test('a miss makes the subtopic due tomorrow; a perfect session spaces it further', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const before = Date.now()
    const missed = await seedPractice(t, studentId, [true, false, true, true])
    await as.mutation(api.sessions.completeSession, { sessionId: missed })
    const aggregate = () => t.run((ctx) => ctx.db.query('learnerSubtopicAggregates')
      .withIndex('by_studentId_subtopicId', (q) => q.eq('studentId', studentId).eq('subtopicId', SUBTOPIC)).first())
    const afterMiss = await aggregate()
    expect(afterMiss?.reviewBox).toBe(0)
    expect(afterMiss!.reviewDueAt! - before).toBeGreaterThanOrEqual(86_400_000)

    // The same day: not due yet, so a perfect session does not space it (no cramming).
    const sameDay = await seedPractice(t, studentId, [true, true, true, true])
    await as.mutation(api.sessions.completeSession, { sessionId: sameDay })
    expect((await aggregate())?.reviewBox).toBe(0)

    // Once due, a perfect session moves it up a box.
    const aggregateId = (await aggregate())!._id
    await t.run((ctx) => ctx.db.patch('learnerSubtopicAggregates', aggregateId, { reviewDueAt: 0 }))
    const due = await seedPractice(t, studentId, [true, true, true, true])
    await as.mutation(api.sessions.completeSession, { sessionId: due })
    expect((await aggregate())?.reviewBox).toBe(1)
  })

  test('the repaso serves an unseen sibling of the missed question, not the one whose key was shown', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const missed = await seedPractice(t, studentId, [false])
    await as.mutation(api.sessions.completeSession, { sessionId: missed })
    const { missedQuestionId, siblingId } = await t.run(async (ctx) => {
      const [attempt] = await ctx.db.query('questionAttempts').withIndex('by_sessionId', (q) => q.eq('sessionId', missed)).collect()
      const original = await ctx.db.get('questions', attempt!.questionId)
      // Usable for a repaso, and an unseen sibling on the same subtopic.
      await ctx.db.patch('questions', original!._id, { eligibility: 'practice_only' })
      const siblingId = await ctx.db.insert('questions', {
        ...original!, _id: undefined, _creationTime: undefined, questionNumber: 99, sequence: 99, eligibility: 'practice_only',
      } as never)
      // Placement unlocks practice kinds; the subtopic falls due now.
      await ctx.db.insert('sessions', {
        studentId, kind: 'nivelacion', status: 'completed', recommendationSource: 'manual', subjectId: 'matematicas',
        startedAt: 0, completedAt: 1, questionCount: 0, currentPosition: 0,
      })
      const aggregate = await ctx.db.query('learnerSubtopicAggregates')
        .withIndex('by_studentId_subtopicId', (q) => q.eq('studentId', studentId).eq('subtopicId', SUBTOPIC)).first()
      await ctx.db.patch('learnerSubtopicAggregates', aggregate!._id, { reviewDueAt: 0 })
      return { missedQuestionId: original!._id, siblingId }
    })

    const repasoId = await as.mutation(api.sessions.createSession, { studentId, kind: 'repaso' })
    const served = await t.run((ctx) => ctx.db.query('sessionQuestions').withIndex('by_sessionId', (q) => q.eq('sessionId', repasoId)).collect())
    expect(served.map((row) => row.questionId)).toEqual([siblingId])
    expect(served.map((row) => row.questionId)).not.toContain(missedQuestionId)
  })
})
