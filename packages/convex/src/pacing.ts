/**
 * Pace against the official clock.
 *
 * Saber 11 gives 4h30 per sitting, about 2¼ minutes a question, and running out
 * of time with blanks costs more than any single hard item: a blank earns
 * nothing, a guess can. This module answers "¿voy a tiempo?" live in solve and
 * "¿dónde se me fue el tiempo?" in the reports. Pure, and free of `convex/*`
 * imports so the web can use it too.
 */
import {
  SESSION_KIND_CONFIG,
  SIMULACRO_MS_PER_QUESTION,
  getSimulacroSessionQuestionCount,
  type SessionKind,
} from './sessionKinds'

export type PaceStatus = 'adelantado' | 'a_tiempo' | 'atrasado'

/** Longest single visit to a question that counts; a tab left open is not study. */
export const MAX_QUESTION_VISIT_MS = 15 * 60_000

/** Share of the official pace an average may stray before it is ahead or behind. */
const AVERAGE_TOLERANCE = 0.1

/**
 * Official time per question for a session: a full sitting's 4h30 over its own
 * official count (Sesión 2 has 14 more questions in the same time), a kind's
 * clock over its length (nivelación), and the exam pace for everything else.
 */
export function officialMsPerQuestion(session: {
  kind: SessionKind
  subjectId?: string
  simulacroSessionNumber?: number
}): number {
  const config = SESSION_KIND_CONFIG[session.kind]
  if (session.kind === 'simulacro' && session.subjectId == null) {
    const sitting = config.simulacroSessions?.find(
      (candidate) => candidate.sessionNumber === (session.simulacroSessionNumber ?? 1),
    )
    if (sitting != null) {
      return Math.round(sitting.timeLimitMs / getSimulacroSessionQuestionCount(sitting))
    }
  }
  if (config.timeLimitMs != null && config.totalQuestions != null) {
    return Math.round(config.timeLimitMs / config.totalQuestions)
  }
  return SIMULACRO_MS_PER_QUESTION
}

/**
 * Live pace: how many questions ahead of or behind the official clock the
 * student is. Within one question counts as on time, so the badge does not
 * flicker while they read.
 */
export function paceStatus(args: {
  msPerQuestion: number
  elapsedMs: number
  answeredCount: number
}): { status: PaceStatus; deltaQuestions: number } {
  const expected = Math.max(0, args.elapsedMs) / args.msPerQuestion
  // `|| 0` folds the -0 that truncating -0.5 leaves.
  const deltaQuestions = Math.trunc(args.answeredCount - expected) || 0
  const status = deltaQuestions > 0 ? 'adelantado' : deltaQuestions < 0 ? 'atrasado' : 'a_tiempo'
  return { status, deltaQuestions }
}

/**
 * Time actually spent on a question: the total across visits when the client
 * reported it (`recordQuestionTime`), else the last visit's time to answer,
 * which is all older attempts have.
 */
export function questionTimeMs(
  attempt: { timeSpentMs?: number; responseTimeMs?: number } | null | undefined,
): number | null {
  const value = attempt?.timeSpentMs ?? attempt?.responseTimeMs
  return value != null && value > 0 ? value : null
}

/** Adds one visit to a question's accumulated time, dropping garbage and capping idle tabs. */
export function accumulateQuestionTime(current: number | undefined, visitMs: number): number {
  const visit = Number.isFinite(visitMs) ? Math.min(MAX_QUESTION_VISIT_MS, Math.max(0, visitMs)) : 0
  return (current ?? 0) + Math.round(visit)
}

type TimedItem = { timeMs: number | null; officialMs: number }

/**
 * Average time per question against the official pace, over the questions that
 * have a time. Each item carries its own official pace, so an area spread over
 * both sittings is compared with the mean of the two.
 */
export function averagePace(items: TimedItem[]): {
  timedCount: number
  averageMs: number
  officialMs: number
  status: PaceStatus
} | null {
  const timed = items.filter((item): item is { timeMs: number; officialMs: number } => item.timeMs != null)
  if (timed.length === 0) return null
  const mean = (values: number[]) =>
    Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  const averageMs = mean(timed.map((item) => item.timeMs))
  const officialMs = mean(timed.map((item) => item.officialMs))
  const status = averageMs > officialMs * (1 + AVERAGE_TOLERANCE)
    ? 'atrasado'
    : averageMs < officialMs * (1 - AVERAGE_TOLERANCE)
      ? 'adelantado'
      : 'a_tiempo'
  return { timedCount: timed.length, averageMs, officialMs, status }
}

/** The questions that went over the official pace, slowest first. */
export function slowestQuestions<T extends TimedItem>(items: T[], limit = 3): T[] {
  return items
    .filter((item) => item.timeMs != null && item.timeMs > item.officialMs)
    .sort((a, b) => (b.timeMs ?? 0) - (a.timeMs ?? 0))
    .slice(0, limit)
}
