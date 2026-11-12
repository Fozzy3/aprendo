import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import { colombiaDayNumber } from './colombiaTime'
import { sendEmail, type EmailMessage } from './email'
import { recordEvent } from './events'
import { streakFrom } from './rewards'
import { DEFAULT_DAILY_GOAL_QUESTIONS } from './studyPlan'

/**
 * Reminder emails, run daily by `crons.ts`. A student who practised yesterday
 * hears that the streak is alive; one away three or seven days gets a gentle
 * comeback; after that, silence.
 */

export type Reminder = { kind: 'streak'; streakDays: number } | { kind: 'comeback'; daysAway: number }

const COMEBACK_DAYS = [3, 7]

export function reminderFor(
  student: Pick<Doc<'students'>, 'lastActiveDay' | 'lastReminderDay' | 'remindersOff' | 'consentAt'> & {
    email: string
    streakDays: number
  },
  today: number,
): Reminder | null {
  if (student.remindersOff === true || student.consentAt == null || student.email === '') return null
  if (student.lastReminderDay === today || student.lastActiveDay == null) return null
  const daysAway = today - student.lastActiveDay
  if (daysAway === 1) return student.streakDays > 0 ? { kind: 'streak', streakDays: student.streakDays } : null
  return COMEBACK_DAYS.includes(daysAway) ? { kind: 'comeback', daysAway } : null
}

// ponytail: no one-click unsubscribe token yet, only the path to the toggle;
// add one (and a List-Unsubscribe header) before any non-pilot mailing.
const FOOTER = '¿No quieres estos correos? Apágalos en Cuenta → Recordatorios.'

export function reminderEmail(
  reminder: Reminder,
  to: { email: string; name?: string; dailyGoalQuestions?: number; siteUrl: string },
): EmailMessage {
  const hello = to.name == null ? 'Hola:' : `Hola, ${to.name}:`
  const link = `${to.siteUrl}/today?ref=recordatorio`
  if (reminder.kind === 'streak') {
    const days = `${reminder.streakDays} ${reminder.streakDays === 1 ? 'día' : 'días'}`
    const goal = to.dailyGoalQuestions ?? DEFAULT_DAILY_GOAL_QUESTIONS
    return {
      to: to.email,
      subject: `Tu racha de ${days} sigue viva`,
      text: `${hello}\n\nAyer practicaste y tu racha va en ${days}. Con ${goal} preguntas hoy la mantienes.\n\nTu plan de hoy: ${link}\n\n${FOOTER}`,
    }
  }
  return {
    to: to.email,
    subject: 'Te guardamos tu plan',
    text: `${hello}\n\nTu plan sigue donde lo dejaste. Cuando quieras volver, arrancamos suave: cinco preguntas y listo.\n\nEntra aquí: ${link}\n\n${FOOTER}`,
  }
}

/** Who gets an email today, with it written. Streaks are replayed only for yesterday's students. */
export const reminderCandidates = internalQuery({
  args: { today: v.number() },
  handler: async (ctx, { today }) => {
    const siteUrl = process.env.SITE_URL ?? 'http://localhost:3000'
    const candidates = []
    for (const day of [today - 1, ...COMEBACK_DAYS.map((away) => today - away)]) {
      const students = await ctx.db
        .query('students')
        .withIndex('by_lastActiveDay', (q) => q.eq('lastActiveDay', day))
        .collect()
      for (const student of students) {
        let streakDays = 0
        if (day === today - 1 && reminderFor({ ...student, streakDays: 1 }, today) != null) {
          const attempts = await ctx.db
            .query('questionAttempts')
            .withIndex('by_studentId', (q) => q.eq('studentId', student._id))
            .collect()
          const activeDays = new Set(attempts.flatMap((attempt) =>
            attempt.answeredAt != null && attempt.isCorrect != null ? [colombiaDayNumber(attempt.answeredAt)] : []))
          streakDays = streakFrom(activeDays, today).streakDays
        }
        const reminder = reminderFor({ ...student, streakDays }, today)
        if (reminder == null) continue
        candidates.push({
          studentId: student._id,
          kind: reminder.kind,
          message: reminderEmail(reminder, { ...student, siteUrl }),
        })
      }
    }
    return candidates
  },
})

export const markReminded = internalMutation({
  args: { studentId: v.id('students'), today: v.number(), kind: v.union(v.literal('streak'), v.literal('comeback')) },
  handler: async (ctx, { studentId, today, kind }) => {
    await ctx.db.patch('students', studentId, { lastReminderDay: today })
    await recordEvent(ctx, studentId, 'reminder_sent', { kind })
  },
})

/** The daily run. One refused email is logged and skipped; the rest still go. */
export const sendReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const today = colombiaDayNumber(Date.now())
    const candidates = await ctx.runQuery(internal.reminders.reminderCandidates, { today })
    for (const { studentId, kind, message } of candidates) {
      try {
        await sendEmail(message)
      } catch (error) {
        console.error(`[recordatorio no enviado] ${studentId}: ${String(error)}`)
        continue
      }
      await ctx.runMutation(internal.reminders.markReminded, { studentId, today, kind })
    }
  },
})
