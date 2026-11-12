import { describe, expect, test } from 'bun:test'
import { api } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import type { MutationCtx } from '../src/_generated/server'
import { setupTest, signUp } from './signIn'

const now = 1_700_000_000_000

async function seedQuestion(ctx: MutationCtx) {
  const storageId = await ctx.storage.store(new Blob(['pdf']))
  const pdfUploadId = await ctx.db.insert('pdfUploads', {
    fileName: 'a.pdf', slug: 'a', pdfStorageId: storageId, contentType: 'application/pdf',
    sizeBytes: 3, status: 'uploaded', createdAt: now, updatedAt: now,
  })
  return ctx.db.insert('questions', {
    pdfUploadId, sequence: 0, questionNumber: 1, bodyMarkdown: 'q', options: [], createdAt: now,
  })
}

async function seedAttempt(
  ctx: MutationCtx,
  studentId: Id<'students'>,
  questionId: Id<'questions'>,
  session: { kind: 'topic' | 'simulacro'; status: 'in_progress' | 'completed' },
) {
  const sessionId = await ctx.db.insert('sessions', {
    studentId, ...session, recommendationSource: 'manual', startedAt: Date.now(), questionCount: 1, currentPosition: 0,
  })
  const sessionQuestionId = await ctx.db.insert('sessionQuestions', {
    sessionId, questionId, position: 0, selectionReason: 'topic_focus',
  })
  await ctx.db.insert('questionAttempts', {
    studentId, sessionId, questionId, sessionQuestionId, attemptType: 'topic', isCorrect: true,
    usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false,
  })
  return sessionId
}

describe('exportMyData', () => {
  test('gives the student their own rows and nobody else’s', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const luis = await signUp(t, 'luis@x.co')
    await t.run(async (ctx) => {
      await ctx.db.patch('students', ana.studentId, {
        consentAt: now, isMinor: true, onboardedAt: now, dailyGoalQuestions: 10, remindersOff: true,
        lastActiveDay: 20_000, lastReminderDay: 20_001,
      })
      const questionId = await seedQuestion(ctx)
      await seedAttempt(ctx, ana.studentId, questionId, { kind: 'topic', status: 'completed' })
      await seedAttempt(ctx, luis.studentId, questionId, { kind: 'topic', status: 'completed' })
      await ctx.db.insert('events', { studentId: ana.studentId, name: 'screen_view', at: now, props: { path: '/today' } })
      await ctx.db.insert('events', { studentId: luis.studentId, name: 'screen_view', at: now })
      await ctx.db.insert('pilotSurveyResponses', { studentId: ana.studentId, answers: { start_ease: 4 }, submittedAt: now })
      await ctx.db.insert('pilotSurveyResponses', { studentId: luis.studentId, answers: { start_ease: 2 }, submittedAt: now })
    })

    const data = await ana.as.query(api.accountExport.exportMyData, { studentId: ana.studentId })

    expect(data.account.email).toBe('ana@x.co')
    expect(data.account.isMinor).toBe(true)
    expect(data.account.consentAt).toBe(now)
    expect(data.account.onboardedAt).toBe(now)
    expect(data.account.dailyGoalQuestions).toBe(10)
    expect(data.account.remindersOff).toBe(true)
    expect(data.account.lastActiveDay).toBe(20_000)
    expect(data.account.lastReminderDay).toBe(20_001)
    expect(data.sessions).toHaveLength(1)
    expect(data.questionAttempts).toHaveLength(1)
    expect(data.questionAttempts[0]?.studentId).toBe(ana.studentId)
    expect(data.questionAttempts[0]?.isCorrect).toBe(true)
    expect(data.events).toHaveLength(1)
    expect(data.events[0]).toMatchObject({ studentId: ana.studentId, props: { path: '/today' } })
    expect(data.pilotSurveyResponses).toEqual([expect.objectContaining({ studentId: ana.studentId, answers: { start_ease: 4 } })])
  })

  test('denies every other caller, teachers included', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const profe = await signUp(t, 'profe@x.co')
    await t.run(async (ctx) => {
      const orgId = await ctx.db.insert('organizations', {
        name: 'Colegio', plan: 'school', seatLimit: 10, licenseEndsAt: now, createdAt: now,
      })
      await ctx.db.insert('memberships', { orgId, accountId: ana.studentId, role: 'student', createdAt: now })
      await ctx.db.insert('memberships', { orgId, accountId: profe.studentId, role: 'teacher', createdAt: now })
    })

    await expect(profe.as.query(api.accountExport.exportMyData, { studentId: ana.studentId })).rejects.toThrow()
    await expect(t.query(api.accountExport.exportMyData, { studentId: ana.studentId })).rejects.toThrow()
  })

  test('keeps the grades of an open exam sealed', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    await t.run(async (ctx) => {
      await seedAttempt(ctx, ana.studentId, await seedQuestion(ctx), { kind: 'simulacro', status: 'in_progress' })
    })

    const data = await ana.as.query(api.accountExport.exportMyData, { studentId: ana.studentId })

    expect(data.questionAttempts).toHaveLength(1)
    expect(data.questionAttempts[0]?.isCorrect).toBeUndefined()
  })

  test('seals a finished practice’s grade while an open exam asks that same question', async () => {
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    await t.run(async (ctx) => {
      const questionId = await seedQuestion(ctx)
      await seedAttempt(ctx, ana.studentId, questionId, { kind: 'topic', status: 'completed' })
      await seedAttempt(ctx, ana.studentId, questionId, { kind: 'simulacro', status: 'in_progress' })
    })

    const data = await ana.as.query(api.accountExport.exportMyData, { studentId: ana.studentId })

    expect(data.questionAttempts.every((attempt) => attempt.isCorrect === undefined)).toBe(true)
  })
})
