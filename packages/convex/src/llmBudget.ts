/**
 * When, and how much, a student may spend on the model.
 *
 * Signing up is free and every model call is paid, so each LLM feature gets a
 * per-student daily allowance (counted in Colombia days, see `colombiaTime.ts`)
 * and the tutor stays shut while an exam is being taken. Pure on purpose: the
 * Convex handlers only read the counter and ask this module.
 */
import type { Doc } from './_generated/dataModel'
import { isPastDeadline } from './sessionIntegrity'
import { getSessionKindConfig, type SessionKind } from './sessionKinds'

/** Model calls each student may make per feature per Colombia day. */
export const LLM_DAILY_LIMITS = {
  tutor: 80,
} as const

export type LlmFeature = keyof typeof LLM_DAILY_LIMITS

/** Longest tutor message accepted; anything longer is a paste, not a question. */
export const MAX_TUTOR_PROMPT_CHARS = 4000

export function hasLlmBudget(feature: LlmFeature, usedToday: number): boolean {
  return usedToday < LLM_DAILY_LIMITS[feature]
}

/**
 * Kinds that measure the student. Saber 11 gives no help during the sitting, so
 * these never get the tutor before they are completed, whatever their config says.
 */
const EXAM_KINDS: readonly SessionKind[] = ['diagnostic', 'nivelacion', 'simulacro']

export function canUseTutor(kind: SessionKind, status: Doc<'sessions'>['status']): boolean {
  if (status === 'completed') return true
  return getSessionKindConfig(kind).tutorInSolve && !EXAM_KINDS.includes(kind)
}

/**
 * A timed exam the student is still taking. While one runs the tutor stays shut
 * in every session, or another session's review would answer its questions.
 * Untimed sessions never count: one left open would shut the tutor for good.
 */
export function isLiveTimedExam(
  session: Pick<Doc<'sessions'>, 'kind' | 'status' | 'expiresAt'>,
  now: number,
): boolean {
  return session.status === 'in_progress'
    && EXAM_KINDS.includes(session.kind)
    && session.expiresAt != null
    && !isPastDeadline(session, now)
}
