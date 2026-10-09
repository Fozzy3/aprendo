import { ConvexError } from 'convex/values'
import type { ConfidenceLevel } from './confidence-display.ts'

/**
 * The writes a student makes while solving, held on the device until the
 * server has them.
 *
 * Most students study on a phone with patchy data. Convex already holds a
 * mutation while the socket is down, but a reload in that window loses it, and
 * a failed save used to leave the option lit as if it had been kept. Every
 * answer, flag and crossed-out option goes through here instead: shown at once,
 * kept in localStorage per session, sent in order, retried
 * with a backoff. Pure; `useAnswerQueue` drives it.
 */
export type QueueOp =
  | {
      type: 'answer'
      sessionQuestionId: string
      selectedOption: string
      confidence?: ConfidenceLevel
      responseTimeMs: number
    }
  | { type: 'clear'; sessionQuestionId: string }
  | { type: 'flag'; sessionQuestionId: string; flagged: boolean }
  | { type: 'eliminate'; sessionQuestionId: string; options: string[] }

export type QueueItem = QueueOp & { id: string; tries: number; notBefore: number }

/** What a question shows while its writes are on the way. */
export type QuestionOverlay = {
  selectedOption?: string | null
  confidence?: ConfidenceLevel
  flagged?: boolean
  eliminatedOptions?: string[]
}

/** Transient failures before a write is given up on (a server bug, not a dead signal). */
export const MAX_TRIES = 6
const MAX_BACKOFF_MS = 30_000

/** An answer and its clearing overwrite each other; each tool is its own slot. */
function slotOf(op: QueueOp): string {
  const kind = op.type === 'clear' ? 'answer' : op.type
  return `${kind}:${op.sessionQuestionId}`
}

/** Adds a write, replacing any older one for the same question and slot. */
export function enqueue(queue: QueueItem[], op: QueueOp, id: string): QueueItem[] {
  const slot = slotOf(op)
  return [...queue.filter((item) => slotOf(item) !== slot), { ...op, id, tries: 0, notBefore: 0 }]
}

/**
 * The writes to hand to Convex now, oldest first, skipping those already sent.
 * The Convex client runs one client's mutations in order, so sending them all
 * at once keeps their order and puts every one ahead of a completion queued
 * after them. A write waiting out a backoff holds back the ones behind it.
 */
export function readyToSend(queue: QueueItem[], inFlight: { has: (id: string) => boolean }, now: number): QueueItem[] {
  const ready: QueueItem[] = []
  for (const item of queue) {
    if (inFlight.has(item.id)) continue
    if (item.notBefore > now) break
    ready.push(item)
  }
  return ready
}

/** Every write ready to go now: the connection came back, or the session is being handed in. */
export function releaseBackoff(queue: QueueItem[]): QueueItem[] {
  return queue.map((item) => ({ ...item, notBefore: 0 }))
}

/** The server has it. A newer write may already have replaced it: then nothing changes. */
export function settleItem(queue: QueueItem[], id: string): QueueItem[] {
  return queue.some((item) => item.id === id) ? queue.filter((item) => item.id !== id) : queue
}

/**
 * A send failed. A `ConvexError` is the server refusing on purpose (time is up,
 * the session closed), so retrying cannot help and the write is dropped;
 * anything else is retried with a doubling backoff, up to `MAX_TRIES`.
 */
export function failItem(
  queue: QueueItem[],
  id: string,
  error: unknown,
  now: number,
): { queue: QueueItem[]; dropped: QueueItem | null } {
  const item = queue.find((candidate) => candidate.id === id)
  if (item == null) return { queue, dropped: null }
  const tries = item.tries + 1
  if (error instanceof ConvexError || tries >= MAX_TRIES) {
    return { queue: queue.filter((candidate) => candidate.id !== id), dropped: item }
  }
  const notBefore = now + Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** (tries - 1))
  return {
    queue: queue.map((candidate) => (candidate.id === id ? { ...candidate, tries, notBefore } : candidate)),
    dropped: null,
  }
}

/** Pending writes folded per question, to lay over what the server returned. */
export function overlayQueue(queue: QueueItem[]): Map<string, QuestionOverlay> {
  const overlay = new Map<string, QuestionOverlay>()
  for (const item of queue) {
    const entry = overlay.get(item.sessionQuestionId) ?? {}
    if (item.type === 'answer') {
      entry.selectedOption = item.selectedOption
      entry.confidence = item.confidence
    } else if (item.type === 'clear') {
      entry.selectedOption = null
      entry.confidence = undefined
    } else if (item.type === 'flag') {
      entry.flagged = item.flagged
    } else {
      entry.eliminatedOptions = item.options
    }
    overlay.set(item.sessionQuestionId, entry)
  }
  return overlay
}

export function queueStorageKey(sessionId: string) {
  return `aprendo:solve-queue:${sessionId}`
}

const OP_TYPES = new Set(['answer', 'clear', 'flag', 'eliminate'])

/** A saved queue, ready to send at once; anything that does not look like one is dropped. */
export function parseQueue(raw: string | null): QueueItem[] {
  if (raw == null) return []
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is QueueItem =>
      item != null
      && typeof item === 'object'
      && OP_TYPES.has((item as QueueItem).type)
      && typeof (item as QueueItem).id === 'string'
      && typeof (item as QueueItem).sessionQuestionId === 'string')
    .map((item) => ({ ...item, tries: Number(item.tries) || 0, notBefore: 0 }))
}
