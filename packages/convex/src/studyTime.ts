import { colombiaWeekIndex, colombiaWeekStartMs } from './colombiaTime'

/**
 * Study time, measured from the questions themselves.
 *
 * Hours are the one dose-response number the SAT world agrees on (College Board:
 * ~20 hours of practice), so "Hoy" shows minutes this week against a goal the
 * student sets. No point-gain claim rides on it until Aprendo has outcome data.
 *
 * Calendar weeks (Monday-Sunday, Colombia time), the same week the coach and
 * the streak speak in. Pure: `today.ts` feeds it settled attempts.
 */

export const DEFAULT_WEEKLY_GOAL_MINUTES = 180
export const MIN_WEEKLY_GOAL_MINUTES = 30
export const MAX_WEEKLY_GOAL_MINUTES = 1200

/**
 * One question never counts for more than this. A phone left on a question all
 * afternoon is not five hours of study.
 */
export const MAX_QUESTION_MS = 5 * 60_000

const HISTORY_WEEKS = 6

function positive(value: number | undefined) {
  return value != null && Number.isFinite(value) && value > 0 ? value : null
}

/** Time on one question: every visit summed when tracked, else the response time. */
export function questionStudyMs(attempt: { timeSpentMs?: number; responseTimeMs?: number }) {
  const ms = positive(attempt.timeSpentMs) ?? positive(attempt.responseTimeMs) ?? 0
  return Math.min(ms, MAX_QUESTION_MS)
}

/** Minutes per calendar week for the last six weeks, oldest first, this week last. */
export function weeklyStudyMinutes(
  attempts: { at: number; timeSpentMs?: number; responseTimeMs?: number }[],
  nowMs: number,
): { weekStartMs: number; minutes: number }[] {
  const currentWeek = colombiaWeekIndex(nowMs)
  const firstWeek = currentWeek - HISTORY_WEEKS + 1
  const msByWeek = new Array<number>(HISTORY_WEEKS).fill(0)

  for (const attempt of attempts) {
    const offset = colombiaWeekIndex(attempt.at) - firstWeek
    if (offset < 0 || offset >= HISTORY_WEEKS) continue
    msByWeek[offset] = (msByWeek[offset] ?? 0) + questionStudyMs(attempt)
  }

  return msByWeek.map((ms, offset) => ({
    weekStartMs: colombiaWeekStartMs(firstWeek + offset),
    minutes: Math.round(ms / 60_000),
  }))
}

export function isValidWeeklyGoal(minutes: number) {
  return (
    Number.isFinite(minutes)
    && minutes >= MIN_WEEKLY_GOAL_MINUTES
    && minutes <= MAX_WEEKLY_GOAL_MINUTES
  )
}
