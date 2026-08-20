import { colombiaDayNumber } from './colombiaTime'

/**
 * The exam date, and what it implies about pace.
 *
 * Without a date, "tu plan de hoy" is a suggestion. With one it becomes a plan
 * with a deadline: how many days are left, how many study days that leaves at
 * the student's current rhythm, and whether that rhythm is enough to close the
 * gap to their target.
 *
 * Days are Colombia days (see `colombiaTime.ts`) so "faltan 3 días" flips at
 * local midnight, not at 7pm.
 */

/** Sessions per week the plan assumes when the student has no history yet. */
export const DEFAULT_SESSIONS_PER_WEEK = 5

export type ExamPhase = 'far' | 'approaching' | 'final_stretch' | 'imminent' | 'past'

/**
 * How many Colombia days remain. Negative once the exam is behind.
 *
 * Exam day itself is 0, which is what "es hoy" should read as.
 */
export function daysUntilExam(examDateMs: number, nowMs: number): number {
  return colombiaDayNumber(examDateMs) - colombiaDayNumber(nowMs)
}

/**
 * Coarse phase, so the UI can change register without scattering day thresholds
 * across components.
 */
export function examPhase(daysRemaining: number): ExamPhase {
  if (daysRemaining < 0) return 'past'
  if (daysRemaining <= 7) return 'imminent'
  if (daysRemaining <= 30) return 'final_stretch'
  if (daysRemaining <= 90) return 'approaching'
  return 'far'
}

export interface ExamPlan {
  daysRemaining: number
  phase: ExamPhase
  /** Whole weeks left, rounded up — the unit study plans are actually made in. */
  weeksRemaining: number
  /**
   * Study sessions the student can still fit in before the exam, at their
   * observed weekly rhythm. This is the budget every recommendation competes for.
   */
  projectedSessions: number
}

/**
 * Turn a date and an observed rhythm into a budget of remaining sessions.
 *
 * `sessionsPerWeek` should come from real activity; it falls back to the default
 * goal for a student with no history rather than projecting zero sessions and
 * declaring the situation hopeless on day one.
 */
export function buildExamPlan(args: {
  examDateMs: number
  nowMs: number
  sessionsPerWeek?: number | null
}): ExamPlan {
  const daysRemaining = daysUntilExam(args.examDateMs, args.nowMs)
  const weeksRemaining = Math.max(0, Math.ceil(daysRemaining / 7))
  const rhythm =
    args.sessionsPerWeek == null || args.sessionsPerWeek <= 0
      ? DEFAULT_SESSIONS_PER_WEEK
      : args.sessionsPerWeek

  return {
    daysRemaining,
    phase: examPhase(daysRemaining),
    weeksRemaining,
    projectedSessions: daysRemaining < 0 ? 0 : Math.round(weeksRemaining * rhythm),
  }
}

/**
 * Whether the current rhythm can plausibly close a gap in global-score points
 * before the exam.
 *
 * `pointsPerSession` is deliberately a caller-supplied assumption rather than a
 * constant buried here: it is the softest number in the whole feature and it
 * should be visible and tunable, not smuggled in. Returns null when there is
 * nothing to project.
 */
export function isPaceEnough(args: {
  pointsNeeded: number
  projectedSessions: number
  pointsPerSession: number
}): boolean | null {
  if (args.pointsNeeded <= 0) return true
  if (args.projectedSessions <= 0 || args.pointsPerSession <= 0) return false
  return args.projectedSessions * args.pointsPerSession >= args.pointsNeeded
}

/**
 * Sessions per week implied by a set of active study days.
 *
 * Uses the observed span rather than a fixed window, so a student who studied 6
 * days in their first week is not averaged down against the weeks before they
 * signed up.
 */
export function observedSessionsPerWeek(args: {
  activeDayCount: number
  firstActivityMs: number | null
  nowMs: number
}): number | null {
  if (args.firstActivityMs == null || args.activeDayCount <= 0) return null
  const spanDays = Math.max(
    1,
    colombiaDayNumber(args.nowMs) - colombiaDayNumber(args.firstActivityMs) + 1,
  )
  return (args.activeDayCount / spanDays) * 7
}
