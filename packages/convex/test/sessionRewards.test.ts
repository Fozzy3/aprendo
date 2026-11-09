import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import { MIN_ANSWER_MS, XP_PER_ANSWER, XP_PER_GUIDED_PATH } from '../src/rewards'
import { setupTest, signUp } from './signIn'

const SUBTOPIC = 'matematicas.functions_variation.functions_graphs'

async function seedSession(
  t: ReturnType<typeof setupTest>,
  studentId: Id<'students'>,
  answers: { isCorrect: boolean; timeMs: number; guidedOutcome?: 'self_corrected' | 'revealed'; guidedStep?: number }[],
) {
  return t.run(async (ctx) => {
    const now = Date.now()
    const pdfUploadId = await ctx.db.insert('pdfUploads', {
      fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['pdf'])), contentType: 'application/pdf',
      sizeBytes: 3, status: 'uploaded', createdAt: now, updatedAt: now,
    })
    const sessionId = await ctx.db.insert('sessions', {
      studentId, kind: 'topic', status: 'in_progress', recommendationSource: 'manual', feedbackMode: 'inmediata',
      subjectId: 'matematicas', startedAt: now, questionCount: answers.length, currentPosition: 1,
    })
    for (const [position, answer] of answers.entries()) {
      const questionId = await ctx.db.insert('questions', {
        pdfUploadId, sequence: position, questionNumber: position + 1, bodyMarkdown: 'q',
        options: [{ label: 'A', bodyMarkdown: 'a' }, { label: 'B', bodyMarkdown: 'b' }],
        createdAt: now, subjectId: 'matematicas', categoryId: 'matematicas.functions_variation', primarySubtopicId: SUBTOPIC, answerCorrectOption: 'A',
      })
      const sessionQuestionId = await ctx.db.insert('sessionQuestions', { sessionId, questionId, position, selectionReason: 'topic_focus' })
      await ctx.db.insert('questionAttempts', {
        studentId, sessionId, questionId, sessionQuestionId, attemptType: 'topic',
        selectedOption: answer.isCorrect ? 'A' : 'B', isCorrect: answer.isCorrect, answeredAt: now, responseTimeMs: answer.timeMs,
        usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false, guidedOutcome: answer.guidedOutcome, guidedStep: answer.guidedStep,
      })
    }
    return sessionId
  })
}

describe('completeSession reward', () => {
  test('pays effort only, once, and returns it with the summary', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const sessionId = await seedSession(t, studentId, [
      { isCorrect: true, timeMs: MIN_ANSWER_MS },
      { isCorrect: false, timeMs: 8000 },
      { isCorrect: true, timeMs: 100 },
    ])

    const first = await as.mutation(api.sessions.completeSession, { sessionId })
    expect(first.reward).toEqual({ xp: 2 * XP_PER_ANSWER, medals: ['primera_sesion'], streakDays: 1 })

    const stored = (await t.run((ctx) => ctx.db.get('sessions', sessionId)))!.reward
    expect(stored).toEqual(first.reward!)

    // Closing again is the early return: nothing is paid twice.
    const again = await as.mutation(api.sessions.completeSession, { sessionId })
    expect(again.reward).toEqual(first.reward!)
    expect((await t.run((ctx) => ctx.db.get('sessions', sessionId)))!.reward).toEqual(first.reward!)
  })

  test('a finished guided path earns on top; correctness of the answers does not matter', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const sessionId = await seedSession(t, studentId, [{ isCorrect: false, timeMs: 8000, guidedOutcome: 'self_corrected', guidedStep: 2 }])
    const { reward } = await as.mutation(api.sessions.completeSession, { sessionId })
    expect(reward?.xp).toBe(XP_PER_ANSWER + XP_PER_GUIDED_PATH)
  })

  test('a retry on an item with no guide earns only the answer', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const sessionId = await seedSession(t, studentId, [{ isCorrect: false, timeMs: 8000, guidedOutcome: 'revealed' }])
    const { reward } = await as.mutation(api.sessions.completeSession, { sessionId })
    expect(reward?.xp).toBe(XP_PER_ANSWER)
    expect(reward?.medals).not.toContain('camino_terminado')
  })

  test('the daily cap is shared across the sessions of the day', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const manyAnswers = Array.from({ length: 28 }, () => ({ isCorrect: true, timeMs: 10_000 }))
    await as.mutation(api.sessions.completeSession, { sessionId: await seedSession(t, studentId, manyAnswers) })
    const second = await as.mutation(api.sessions.completeSession, { sessionId: await seedSession(t, studentId, manyAnswers) })
    expect(second.reward?.xp).toBe(20)
    const third = await as.mutation(api.sessions.completeSession, { sessionId: await seedSession(t, studentId, manyAnswers) })
    expect(third.reward?.xp).toBe(0)
  })
})

describe('Hoy: XP, shields, first week and the 5-question mission', () => {
  test('a student who has not practised has a mission to do, no shields and a commitment pending', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const today = await as.query(api.today.getTodayDashboard, { studentId })
    expect(today.plan.hero).toMatchObject({
      questionCount: 5,
      missionComplete: false,
      action: { type: 'session', kind: 'recommended' },
    })
    expect(today.shields).toBe(0)
    expect(today.xp).toEqual({ today: 0, thisWeek: 0 })
    expect(today.firstWeek).toEqual({ active: true, committed: false, days: [] })
  })

  test('five answers in sessions closed today complete the mission and show up as XP', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const answers = Array.from({ length: 5 }, () => ({ isCorrect: true, timeMs: 10_000 }))
    await as.mutation(api.sessions.completeSession, { sessionId: await seedSession(t, studentId, answers) })
    await as.mutation(api.students.setWeeklyGoal, { studentId, minutes: 120 })
    const today = await as.query(api.today.getTodayDashboard, { studentId })
    expect(today.plan.hero?.missionComplete).toBe(true)
    expect(today.xp).toEqual({ today: 5 * XP_PER_ANSWER, thisWeek: 5 * XP_PER_ANSWER })
    expect(today.streakDays).toBe(1)
    expect(today.firstWeek.days[0]?.status).toBe('done')
    expect(today.firstWeek.committed).toBe(true)
  })

  test('four answers leave the mission open', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const answers = Array.from({ length: 4 }, () => ({ isCorrect: true, timeMs: 10_000 }))
    await as.mutation(api.sessions.completeSession, { sessionId: await seedSession(t, studentId, answers) })
    const today = await as.query(api.today.getTodayDashboard, { studentId })
    expect(today.plan.hero?.missionComplete).toBe(false)
  })

  test('the sticker album shows what the aggregates earned and the medals of the sessions', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    await as.mutation(api.sessions.completeSession, { sessionId: await seedSession(t, studentId, [{ isCorrect: true, timeMs: 10_000 }]) })
    await t.run(async (ctx) => {
      const aggregate = await ctx.db.query('learnerSubtopicAggregates')
        .withIndex('by_studentId_subtopicId', (q) => q.eq('studentId', studentId).eq('subtopicId', SUBTOPIC)).first()
      await ctx.db.patch('learnerSubtopicAggregates', aggregate!._id, { masteryLevel: 'competente' })
    })
    const album = await as.query(api.today.getStickerAlbum, { studentId })
    expect(album.earnedCount).toBe(1)
    expect(album.medals.map((medal) => medal.id)).toEqual(['primera_sesion'])
    expect(album.medals[0]?.label).toBe('Primera sesión')
    const subject = album.subjects.find((item) => item.subjectId === 'matematicas')
    expect(subject?.stickers.find((sticker) => sticker.subtopicId === SUBTOPIC)).toMatchObject({ earned: true, shiny: false })
  })
})

describe('avatar and nickname', () => {
  const avatar = { skin: 'tono1', hair: 'corto', top: 'camiseta', accessory: 'ninguno' }

  test('setAvatar stores known part ids and refuses anything else', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    await as.mutation(api.students.setAvatar, { studentId, avatar })
    expect((await t.run((ctx) => ctx.db.get('students', studentId)))?.avatar).toEqual(avatar)
    await expect(as.mutation(api.students.setAvatar, { studentId, avatar: { ...avatar, top: 'mi-foto.png' } })).rejects.toThrow()
  })

  test('setNickname builds it from the closed lists and refuses free text', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    await expect(as.mutation(api.students.setNickname, { studentId, noun: 'Cóndor', adjective: 'Veloz' })).resolves.toEqual({ nickname: 'Cóndor Veloz' })
    expect((await t.run((ctx) => ctx.db.get('students', studentId)))?.nickname).toBe('Cóndor Veloz')
    await expect(as.mutation(api.students.setNickname, { studentId, noun: 'Andrés', adjective: 'Veloz' })).rejects.toThrow()
  })

  test('only the student can set them', async () => {
    const t = setupTest()
    const { studentId } = await signUp(t, 'ana@x.co')
    const { as: other } = await signUp(t, 'eva@x.co')
    await expect(other.mutation(api.students.setAvatar, { studentId, avatar })).rejects.toThrow()
    await expect(other.mutation(api.students.setNickname, { studentId, noun: 'Cóndor', adjective: 'Veloz' })).rejects.toThrow()
  })
})
