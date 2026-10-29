import { describe, expect, test } from 'bun:test'
import { api, internal } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { setupTest, signUp } from './signIn'

// The tutor agent builds its model when the module loads; no test reaches it.
process.env.OPENROUTER_API_KEY ??= 'test'
const { OFF_TOPIC_REPLY, buildTutorSystemPrompt } = await import('../src/tutor')

const now = 1_700_000_000_000

async function seedReview(t: ReturnType<typeof setupTest>, studentId: Id<'students'>, subtopicIds: string[]) {
  return t.run(async (ctx) => {
    const pdfStorageId = await ctx.storage.store(new Blob(['pdf']))
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: 'a', pdfStorageId, contentType: 'application/pdf',
      sizeBytes: 3, status: 'uploaded', createdAt: now, updatedAt: now,
    })
    const practiceSessionId = await ctx.db.insert('sessions', {
      studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual',
      startedAt: now, questionCount: subtopicIds.length, currentPosition: 0,
    })
    const questionIds: Id<'questions'>[] = []
    for (const [position, primarySubtopicId] of subtopicIds.entries()) {
      const questionId = await ctx.db.insert('questions', {
        pdfUploadId, sequence: position, questionNumber: position + 1, bodyMarkdown: 'q', options: [],
        createdAt: now, subjectId: primarySubtopicId.split('.')[0], primarySubtopicId,
      })
      await ctx.db.insert('sessionQuestions', {
        sessionId: practiceSessionId, questionId, position, selectionReason: 'topic_focus',
      })
      questionIds.push(questionId)
    }
    return { practiceSessionId, questionIds }
  })
}

describe('tutor while solving', () => {
  test('asking about an unchecked question marks it as helped; review and checked questions do not', async () => {
    const t = setupTest()
    const { studentId } = await signUp(t, 'ana@x.co')
    const { practiceSessionId, questionIds: [first, second] } = await seedReview(t, studentId, [
      'matematicas.functions_variation.functions_graphs',
      'matematicas.geometry_measurement.plane_geometry',
    ])
    await t.run((ctx) => ctx.db.patch('sessions', practiceSessionId, { status: 'in_progress', feedbackMode: 'inmediata' }))
    const sessionQuestions = await t.run((ctx) =>
      ctx.db.query('sessionQuestions').withIndex('by_sessionId', (q) => q.eq('sessionId', practiceSessionId)).collect())
    // The second was already checked: its key is on screen, so asking about it is review.
    await t.run((ctx) => ctx.db.insert('questionAttempts', {
      studentId, sessionId: practiceSessionId, questionId: second!, sessionQuestionId: sessionQuestions[1]!._id,
      attemptType: 'topic', selectedOption: 'A', isCorrect: true, checkedAt: now,
      usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false,
    }))

    await t.mutation(internal.sessions.recordTutorUse, { sessionId: practiceSessionId, questionId: first! })
    await t.mutation(internal.sessions.recordTutorUse, { sessionId: practiceSessionId, questionId: first! })
    await t.mutation(internal.sessions.recordTutorUse, { sessionId: practiceSessionId, questionId: second! })
    const attempts = await t.run((ctx) =>
      ctx.db.query('questionAttempts').withIndex('by_sessionId', (q) => q.eq('sessionId', practiceSessionId)).collect())
    expect(attempts.find((a) => a.questionId === first)).toMatchObject({ usedTutor: true, tutorMessageCount: 2 })
    expect(attempts.find((a) => a.questionId === second)).toMatchObject({ usedTutor: false })

    // Mid-session the tutor knows the key only where the student already saw it.
    await t.run(async (ctx) => {
      await ctx.db.patch('questions', first!, { answerCorrectOption: 'B' })
      await ctx.db.patch('questions', second!, { answerCorrectOption: 'A' })
    })
    await t.run((ctx) => ctx.db.patch('sessions', practiceSessionId, { kind: 'topic' }))
    const context = (questionId: Id<'questions'>) =>
      t.query(internal.tutor.getPracticeQuestionContext, { practiceSessionId, studentId, questionId })
    expect((await context(first!))?.correctOption).toBeNull()
    expect((await context(second!))?.correctOption).toBe('A')

    await t.run((ctx) => ctx.db.patch('sessions', practiceSessionId, { status: 'completed' }))
    await t.mutation(internal.sessions.recordTutorUse, { sessionId: practiceSessionId, questionId: first! })
    const after = await t.run((ctx) =>
      ctx.db.query('questionAttempts').withIndex('by_sessionId', (q) => q.eq('sessionId', practiceSessionId)).collect())
    expect(after.find((a) => a.questionId === first)).toMatchObject({ tutorMessageCount: 2 })
  })
})

describe('tutor and the career', () => {
  test('knows the student’s career, to say in one line what this is for', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const { practiceSessionId, questionIds } = await seedReview(t, studentId, ['matematicas.functions_variation.functions_graphs'])
    await as.mutation(api.students.setCareerFamily, { studentId, careerFamily: 'ingenierias' })
    const context = await t.query(internal.tutor.getPracticeQuestionContext, { practiceSessionId, studentId, questionId: questionIds[0]! })
    expect(buildTutorSystemPrompt(context)).toContain('Quiere estudiar: Ingenierías y tecnología')
  })
})

describe('review tutor', () => {
  test('each question of a session has its own chat', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const { practiceSessionId, questionIds: [first, second] } = await seedReview(t, studentId, [
      'matematicas.functions_variation.functions_graphs',
      'matematicas.geometry_measurement.plane_geometry',
    ])
    const open = (questionId: Id<'questions'>) =>
      as.mutation(api.tutor.createOrGetPracticeTutorThread, { practiceSessionId, studentId, questionId })

    const firstThread = (await open(first!)).threadId
    expect((await open(second!)).threadId).not.toBe(firstThread)
    expect((await open(first!)).threadId).toBe(firstThread)
  })

  test('suggests a demo for the topic, the category first and the area otherwise', async () => {
    const t = setupTest()
    const { studentId } = await signUp(t, 'ana@x.co')
    const { practiceSessionId, questionIds } = await seedReview(t, studentId, [
      'ciencias_naturales.chemistry_component.chemical_changes_reactions',
      'ingles.lexis.vocab_definitions',
    ])
    const contextOf = (questionId: Id<'questions'>) =>
      t.query(internal.tutor.getPracticeQuestionContext, { practiceSessionId, studentId, questionId })

    const chemistry = await contextOf(questionIds[0]!)
    const english = await contextOf(questionIds[1]!)

    expect(chemistry?.demoIdea).toContain('3Dmol')
    expect(english?.demoIdea).toContain('arrastra')
    expect(buildTutorSystemPrompt(chemistry)).toContain(chemistry!.demoIdea!)
  })

  test('keeps the question as data and closes on the scope, with or without a question', async () => {
    const t = setupTest()
    const { studentId } = await signUp(t, 'ana@x.co')
    const { practiceSessionId, questionIds } = await seedReview(t, studentId, ['ingles.lexis.vocab_definitions'])
    const context = await t.query(internal.tutor.getPracticeQuestionContext, {
      practiceSessionId, studentId, questionId: questionIds[0]!,
    })

    const withQuestion = buildTutorSystemPrompt(context)
    expect(withQuestion).toMatch(/<pregunta_actual>[\s\S]*Enunciado:\nq[\s\S]*<\/pregunta_actual>/)
    // The last thing the model reads is the scope and its fixed refusal.
    for (const prompt of [withQuestion, buildTutorSystemPrompt(null)]) {
      const ending = prompt.slice(prompt.lastIndexOf('</pregunta_actual>') + 1)
      expect(ending).toContain(OFF_TOPIC_REPLY)
      expect(ending).toContain('HTML')
      // Socratic by default, but never an interrogation: a stuck student gets told.
      expect(ending).toContain('Una sola pregunta por mensaje')
      expect(ending).toContain('se traba dos veces')
    }
  })
})
