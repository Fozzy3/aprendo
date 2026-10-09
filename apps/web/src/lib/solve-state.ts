/**
 * Small pure rules of the solve screen: the navigator layout, the "revisa
 * antes de entregar" counts, where to resume, when a session can no longer be
 * scored, and the text size steps.
 */

import { COMPLETION_GRACE_MS } from '@aprendo/convex/sessionIntegrity'

/** Consecutive questions on the same shared text, so the navigator shows them together. */
export function navigatorRuns(
  groupIds: (string | null)[],
): { groupId: string | null; indexes: number[] }[] {
  const runs: { groupId: string | null; indexes: number[] }[] = []
  groupIds.forEach((groupId, index) => {
    const last = runs.at(-1)
    if (last != null && last.groupId === groupId) last.indexes.push(index)
    else runs.push({ groupId, indexes: [index] })
  })
  return runs
}

export function checkWorkSummary(questions: { answered: boolean; flagged: boolean }[]) {
  const blank: number[] = []
  const flagged: number[] = []
  questions.forEach((question, index) => {
    if (!question.answered) blank.push(index)
    if (question.flagged) flagged.push(index)
  })
  return { answeredCount: questions.length - blank.length, blank, flagged }
}

/** Where a reopened session picks up: the first blank, else the top. */
export function firstUnansweredIndex(answered: boolean[]): number {
  const index = answered.indexOf(false)
  return index === -1 ? 0 : index
}


/**
 * Whether the session could no longer be scored when the page loaded. The
 * server refuses a completion past the grace, and auto-completing on load would
 * turn the few answers of a sitting the student left into their result.
 */
export function isClosedOnLoad(
  session: { status: string; expiresAt?: number },
  loadedAt: number,
): boolean {
  if (session.status === 'abandoned') return true
  if (session.status === 'completed' || session.expiresAt == null) return false
  return loadedAt > session.expiresAt + COMPLETION_GRACE_MS
}

export const TEXT_SCALES = [0.9, 1, 1.15, 1.3, 1.5] as const

export function stepTextScale(current: number, direction: 1 | -1): number {
  const index = TEXT_SCALES.findIndex((scale) => scale === current)
  const next = Math.min(TEXT_SCALES.length - 1, Math.max(0, (index === -1 ? 1 : index) + direction))
  return TEXT_SCALES[next] ?? 1
}

export function parseTextScale(raw: string | null): number {
  const value = Number(raw)
  return TEXT_SCALES.find((scale) => scale === value) ?? 1
}

/** Adds the option to the crossed-out set, or takes it out. */
export function toggleLabel(labels: string[], label: string): string[] {
  return labels.includes(label) ? labels.filter((value) => value !== label) : [...labels, label]
}

/** localStorage, tolerant of private windows and blocked storage. */
export function readStored(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string | null) {
  try {
    if (typeof window === 'undefined') return
    if (value == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Storage blocked or full: the preference simply does not persist.
  }
}
