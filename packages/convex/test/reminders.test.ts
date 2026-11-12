import { afterEach, describe, expect, test } from 'bun:test'
import { api, internal } from '../src/_generated/api'
import type { Id } from '../src/_generated/dataModel'
import type { MutationCtx } from '../src/_generated/server'
import { colombiaDayNumber, colombiaDayStartMs } from '../src/colombiaTime'
import { reminderEmail, reminderFor } from '../src/reminders'
import { setupTest, signUp } from './signIn'

const TODAY = 20_000
const ready = { lastActiveDay: TODAY - 1, lastReminderDay: undefined, remindersOff: undefined, consentAt: 1, email: 'ana@x.co', streakDays: 4 }

describe('reminderFor', () => {
  test('practised yesterday, not yet today: the streak reminder', () => {
    expect(reminderFor(ready, TODAY)).toEqual({ kind: 'streak', streakDays: 4 })
  })

  test('no streak to keep, no streak reminder', () => {
    expect(reminderFor({ ...ready, streakDays: 0 }, TODAY)).toBeNull()
  })

  test('three and seven days away: a comeback, then silence', () => {
    expect(reminderFor({ ...ready, lastActiveDay: TODAY - 3 }, TODAY)).toEqual({ kind: 'comeback', daysAway: 3 })
    expect(reminderFor({ ...ready, lastActiveDay: TODAY - 7 }, TODAY)).toEqual({ kind: 'comeback', daysAway: 7 })
    for (const away of [0, 2, 4, 5, 6, 8, 30]) {
      expect(reminderFor({ ...ready, lastActiveDay: TODAY - away }, TODAY)).toBeNull()
    }
  })

  test('never practised, never reminded', () => {
    expect(reminderFor({ ...ready, lastActiveDay: undefined }, TODAY)).toBeNull()
  })

  test('off, without consent, without email, or already reminded today: nothing', () => {
    expect(reminderFor({ ...ready, remindersOff: true }, TODAY)).toBeNull()
    expect(reminderFor({ ...ready, consentAt: undefined }, TODAY)).toBeNull()
    expect(reminderFor({ ...ready, email: '' }, TODAY)).toBeNull()
    expect(reminderFor({ ...ready, lastReminderDay: TODAY }, TODAY)).toBeNull()
  })

  test('reminders explicitly on and a reminder on an earlier day still send', () => {
    expect(reminderFor({ ...ready, remindersOff: false, lastReminderDay: TODAY - 1 }, TODAY)).toEqual({ kind: 'streak', streakDays: 4 })
  })
})

describe('reminderEmail', () => {
  const to = { email: 'ana@x.co', name: 'Ana', dailyGoalQuestions: 10, siteUrl: 'https://aprendo.co' }
  const link = 'https://aprendo.co/today?ref=recordatorio'
  const footer = '¿No quieres estos correos? Apágalos en Cuenta → Recordatorios.'

  test('streak: the count in the subject, the daily goal and the link in the body', () => {
    const message = reminderEmail({ kind: 'streak', streakDays: 4 }, to)
    expect(message.to).toBe('ana@x.co')
    expect(message.subject).toBe('Tu racha de 4 días sigue viva')
    expect(message.text).toContain('Hola, Ana:')
    expect(message.text).toContain('10 preguntas')
    expect(message.text).toContain(link)
    expect(message.text.endsWith(footer)).toBe(true)
  })

  test('one day is singular; a missing goal is the default five; a missing name is just "Hola"', () => {
    const message = reminderEmail({ kind: 'streak', streakDays: 1 }, { ...to, name: undefined, dailyGoalQuestions: undefined })
    expect(message.subject).toBe('Tu racha de 1 día sigue viva')
    expect(message.text).toContain('Hola:')
    expect(message.text).toContain('5 preguntas')
  })

  test('comeback: gentle, with the link and the way out', () => {
    const message = reminderEmail({ kind: 'comeback', daysAway: 3 }, to)
    expect(message.subject).toBe('Te guardamos tu plan')
    expect(message.text).toContain(link)
    expect(message.text.endsWith(footer)).toBe(true)
    expect(message.text.toLowerCase()).not.toContain('perdiste')
  })
})

async function seedQuestion(ctx: MutationCtx) {
  const pdfUploadId = await ctx.db.insert('pdfUploads', {
    fileName: 'a.pdf', slug: 'a', pdfStorageId: await ctx.storage.store(new Blob(['pdf'])), contentType: 'application/pdf',
    sizeBytes: 3, status: 'uploaded', createdAt: 0, updatedAt: 0,
  })
  return ctx.db.insert('questions', {
    pdfUploadId, sequence: 1, questionNumber: 1, bodyMarkdown: 'q',
    options: [{ label: 'A', bodyMarkdown: 'a' }, { label: 'B', bodyMarkdown: 'b' }],
    createdAt: 0, subjectId: 'matematicas', categoryId: 'c', primarySubtopicId: 's', answerCorrectOption: 'A',
  })
}

async function seedAnswer(ctx: MutationCtx, studentId: Id<'students'>, questionId: Id<'questions'>, day: number) {
  const answeredAt = colombiaDayStartMs(day) + 3_600_000
  const sessionId = await ctx.db.insert('sessions', {
    studentId, kind: 'topic', status: 'completed', recommendationSource: 'manual', startedAt: answeredAt, questionCount: 1, currentPosition: 1,
  })
  const sessionQuestionId = await ctx.db.insert('sessionQuestions', { sessionId, questionId, position: 1, selectionReason: 'topic_focus' })
  await ctx.db.insert('questionAttempts', {
    studentId, sessionId, questionId, sessionQuestionId, attemptType: 'topic', selectedOption: 'A', isCorrect: true, answeredAt,
    usedHint: false, usedTutor: false, hintCount: 0, tutorMessageCount: 0, wasSkipped: false,
  })
}

/** Students on every side of the rules; only ana, beto and caro are due. */
async function seedStudents(t: ReturnType<typeof setupTest>, today: number) {
  return t.run(async (ctx) => {
    const questionId = await seedQuestion(ctx)
    const student = (email: string, extra: Record<string, unknown>) => ctx.db.insert('students', {
      email, normalizedEmail: email, name: email.split('@')[0], createdAt: 0, updatedAt: 0, lastSeenAt: 0, consentAt: 1, ...extra,
    })
    const ana = await student('ana@x.co', { lastActiveDay: today - 1, dailyGoalQuestions: 15 })
    await seedAnswer(ctx, ana, questionId, today - 2)
    await seedAnswer(ctx, ana, questionId, today - 1)
    const beto = await student('beto@x.co', { lastActiveDay: today - 3 })
    const caro = await student('caro@x.co', { lastActiveDay: today - 7 })
    await student('dani@x.co', { lastActiveDay: today - 2 })
    await student('eva@x.co', { lastActiveDay: today - 1, remindersOff: true })
    await student('fer@x.co', { lastActiveDay: today - 1, consentAt: undefined })
    await student('gabo@x.co', { lastActiveDay: today - 1, lastReminderDay: today })
    await student('hugo@x.co', {})
    return { ana, beto, caro }
  })
}

describe('reminderCandidates', () => {
  test('finds who is due today, with the streak replayed from their answers', async () => {
    const t = setupTest()
    await seedStudents(t, TODAY)
    const candidates = await t.query(internal.reminders.reminderCandidates, { today: TODAY })
    const byEmail = Object.fromEntries(candidates.map((candidate) => [candidate.message.to, candidate]))
    expect(Object.keys(byEmail).sort()).toEqual(['ana@x.co', 'beto@x.co', 'caro@x.co'])
    expect(byEmail['ana@x.co']!.kind).toBe('streak')
    expect(byEmail['ana@x.co']!.message.subject).toBe('Tu racha de 2 días sigue viva')
    expect(byEmail['ana@x.co']!.message.text).toContain('15 preguntas')
    expect(byEmail['beto@x.co']!.kind).toBe('comeback')
    expect(byEmail['caro@x.co']!.kind).toBe('comeback')
  })
})

describe('sendReminders', () => {
  const realFetch = globalThis.fetch
  const realKey = process.env.RESEND_API_KEY
  afterEach(() => {
    globalThis.fetch = realFetch
    if (realKey == null) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = realKey
  })

  test('one refused email does not stop the rest; each sent one is recorded once', async () => {
    const t = setupTest()
    const today = colombiaDayNumber(Date.now())
    const { ana, beto, caro } = await seedStudents(t, today)
    process.env.RESEND_API_KEY = 're_test'
    const sentTo: string[] = []
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const { to } = JSON.parse(init.body as string) as { to: string }
      if (to === 'beto@x.co') return new Response('bad', { status: 422 })
      sentTo.push(to)
      return new Response('{}')
    }) as typeof fetch

    await t.action(internal.reminders.sendReminders, {})
    // Same day again: nobody gets a second email.
    await t.action(internal.reminders.sendReminders, {})

    expect(sentTo.sort()).toEqual(['ana@x.co', 'caro@x.co'])
    const { rows, events } = await t.run(async (ctx) => ({
      rows: await Promise.all([ana, beto, caro].map((id) => ctx.db.get('students', id))),
      events: await ctx.db.query('events').collect(),
    }))
    expect(rows.map((row) => row?.lastReminderDay)).toEqual([today, undefined, today])
    expect(events.map((event) => [event.studentId, event.name, event.props])).toEqual([
      [ana, 'reminder_sent', { kind: 'streak' }],
      [caro, 'reminder_sent', { kind: 'comeback' }],
    ])
  })
})

describe('lastActiveDay', () => {
  test('grading an answer marks today as the last active day', async () => {
    const t = setupTest()
    const { studentId, as } = await signUp(t, 'ana@x.co')
    const ids = await t.run(async (ctx) => {
      await ctx.db.patch('students', studentId, { lastActiveDay: 1 })
      const questionId = await seedQuestion(ctx)
      const sessionId = await ctx.db.insert('sessions', {
        studentId, kind: 'topic', status: 'in_progress', recommendationSource: 'manual', subjectId: 'matematicas',
        feedbackMode: 'inmediata', startedAt: Date.now(), questionCount: 2, currentPosition: 1,
      })
      const first = await ctx.db.insert('sessionQuestions', { sessionId, questionId, position: 1, selectionReason: 'topic_focus' })
      const second = await ctx.db.insert('sessionQuestions', { sessionId, questionId, position: 2, selectionReason: 'topic_focus' })
      return { sessionId, first, second }
    })
    const answer = (sessionQuestionId: Id<'sessionQuestions'>) =>
      as.mutation(api.sessions.submitAnswer, { sessionId: ids.sessionId, sessionQuestionId, selectedOption: 'B', responseTimeMs: 5_000 })
    const lastActiveDay = () => t.run(async (ctx) => (await ctx.db.get('students', studentId))?.lastActiveDay)

    await answer(ids.first)
    expect(await lastActiveDay()).toBe(colombiaDayNumber(Date.now()))
    await answer(ids.second)
    expect(await lastActiveDay()).toBe(colombiaDayNumber(Date.now()))
  })
})
