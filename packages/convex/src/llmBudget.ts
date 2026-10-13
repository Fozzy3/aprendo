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

export type LlmFeature = 'tutor'

/** `individual` is an account with no school, or whose school's license ran out. */
export type LlmPlan = 'individual' | Doc<'organizations'>['plan']

/**
 * Model calls each student may make per feature per Colombia day, by plan.
 * This is where billing hooks in: a school's plan buys its students more.
 */
export const LLM_DAILY_LIMITS: Record<LlmPlan, Record<LlmFeature, number>> = {
  individual: { tutor: 80 },
  pilot: { tutor: 80 },
  school: { tutor: 150 },
}

/** Longest tutor message accepted; anything longer is a paste, not a question. */
export const MAX_TUTOR_PROMPT_CHARS = 4000

export function hasLlmBudget(feature: LlmFeature, usedToday: number, plan: LlmPlan): boolean {
  return usedToday < LLM_DAILY_LIMITS[plan][feature]
}

/** The most generous plan among the student's schools with a running license. */
export function llmPlanFor(
  organizations: Pick<Doc<'organizations'>, 'plan' | 'licenseEndsAt'>[],
  now: number,
): LlmPlan {
  let best: LlmPlan = 'individual'
  for (const organization of organizations) {
    if (organization.licenseEndsAt <= now) continue
    if (LLM_DAILY_LIMITS[organization.plan].tutor > LLM_DAILY_LIMITS[best].tutor) best = organization.plan
  }
  return best
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
