import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  enqueue,
  failItem,
  overlayQueue,
  parseQueue,
  queueStorageKey,
  readyToSend,
  releaseBackoff,
  settleItem,
  type QueueItem,
  type QueueOp,
} from './answer-queue.ts'
import { readConvexError } from './convex-error.ts'
import { readStored, writeStored } from './solve-state.ts'

/** How long a send may hang before the student is told the connection is down. */
const STALLED_MS = 4_000

function oldestSend(inFlight: Map<string, number>): number | null {
  return inFlight.size === 0 ? null : Math.min(...inFlight.values())
}

/**
 * Drives the pure queue in `answer-queue.ts`: every ready write handed to Convex
 * at once (its client keeps their order), persisted per session after every
 * change, woken by backoffs, by the browser coming back online, and on mount (a
 * reload resumes what it left).
 */
export function useAnswerQueue(sessionId: string, send: (op: QueueItem) => Promise<unknown>) {
  const storageKey = queueStorageKey(sessionId)
  const [queue, setQueue] = useState<QueueItem[]>(() => parseQueue(readStored(storageKey)))
  const queueRef = useRef(queue)
  const [error, setError] = useState<string | null>(null)
  const [inFlightSince, setInFlightSince] = useState<number | null>(null)
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine)
  /** Writes handed to Convex and not yet settled, with when each was sent. */
  const inFlightRef = useRef(new Map<string, number>())
  const wakeRef = useRef<number | null>(null)
  const sendRef = useRef(send)
  sendRef.current = send

  const commit = useCallback(
    (next: QueueItem[]) => {
      queueRef.current = next
      setQueue(next)
      writeStored(storageKey, next.length === 0 ? null : JSON.stringify(next))
    },
    [storageKey],
  )

  const pump = useCallback(() => {
    const now = Date.now()
    const inFlight = inFlightRef.current
    for (const item of readyToSend(queueRef.current, inFlight, now)) {
      inFlight.set(item.id, now)
      sendRef.current(item)
        .then(() => {
          commit(settleItem(queueRef.current, item.id))
          setError(null)
        })
        .catch((failure: unknown) => {
          const result = failItem(queueRef.current, item.id, failure, Date.now())
          commit(result.queue)
          if (result.dropped != null) {
            setError(readConvexError(failure, 'No se pudo guardar un cambio. Revisa esa pregunta.'))
          }
        })
        .finally(() => {
          inFlight.delete(item.id)
          setInFlightSince(oldestSend(inFlight))
          pump()
        })
    }
    setInFlightSince(oldestSend(inFlight))
    const waiting = queueRef.current.find((item) => !inFlight.has(item.id) && item.notBefore > now)
    if (waiting != null && wakeRef.current == null) {
      wakeRef.current = window.setTimeout(() => {
        wakeRef.current = null
        pump()
      }, waiting.notBefore - now)
    }
  }, [commit])

  useEffect(() => {
    pump()
  }, [pump])

  useEffect(() => {
    const wake = () => {
      setOnline(navigator.onLine)
      if (wakeRef.current != null) {
        window.clearTimeout(wakeRef.current)
        wakeRef.current = null
      }
      // Back online: anything backing off goes now rather than at its slot.
      if (navigator.onLine) {
        commit(releaseBackoff(queueRef.current))
        pump()
      }
    }
    window.addEventListener('online', wake)
    window.addEventListener('offline', wake)
    return () => {
      window.removeEventListener('online', wake)
      window.removeEventListener('offline', wake)
      if (wakeRef.current != null) window.clearTimeout(wakeRef.current)
    }
  }, [commit, pump])

  const push = useCallback(
    (op: QueueOp) => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      commit(enqueue(queueRef.current, op, id))
      pump()
    },
    [commit, pump],
  )

  /**
   * Resolves once every write is saved, or after `timeoutMs` (the caller goes
   * ahead). Either way every write is handed to Convex first, backoffs
   * included, so a completion sent next runs after all of them.
   */
  const flush = useCallback(
    (timeoutMs: number) => {
      const deadline = Date.now() + timeoutMs
      const sendAll = () => {
        commit(releaseBackoff(queueRef.current))
        pump()
      }
      return new Promise<void>((resolve) => {
        const check = () => {
          if (queueRef.current.length === 0) resolve()
          else if (Date.now() >= deadline) {
            sendAll()
            resolve()
          } else window.setTimeout(check, 200)
        }
        sendAll()
        check()
      })
    },
    [commit, pump],
  )

  const overlay = useMemo(() => overlayQueue(queue), [queue])
  // The browser's flag is the obvious signal; a retry or a send hanging past a
  // few seconds catches the "connected to a Wi-Fi with no internet" case.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (inFlightSince == null) return
    const id = window.setTimeout(() => setNow(Date.now()), STALLED_MS)
    return () => window.clearTimeout(id)
  }, [inFlightSince])
  const isOffline =
    !online
    || queue.some((item) => item.tries > 0)
    || (inFlightSince != null && now - inFlightSince >= STALLED_MS)

  return {
    overlay,
    push,
    flush,
    pendingCount: queue.length,
    isOffline,
    error,
    clearError: () => setError(null),
  }
}
