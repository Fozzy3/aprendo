import { useEffect, useRef, useState } from 'react'

export type SessionTimerState = {
  /** Whether this session has a time limit at all. */
  timed: boolean
  /** Milliseconds remaining (clamped at 0). `null` when untimed. */
  remainingMs: number | null
  /** Milliseconds elapsed since the session started. */
  elapsedMs: number
  /** True once a timed session has run out. */
  expired: boolean
}

/**
 * Drives both the count-up (untimed) and count-down (timed) displays for a
 * session, and fires `onExpire` exactly once when a timed session runs out.
 *
 * `expiresAt` / `timeLimitMs` come straight from the session document, so the
 * countdown survives reloads — it's anchored to a server timestamp, not to a
 * local "started now".
 */
export function useSessionTimer(options: {
  startedAt: number
  expiresAt?: number | null
  timeLimitMs?: number | null
  onExpire?: () => void
}): SessionTimerState {
  const { startedAt, expiresAt, timeLimitMs, onExpire } = options
  const timed = expiresAt != null && timeLimitMs != null
  const [now, setNow] = useState(() => Date.now())
  const hasFiredExpire = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [startedAt, expiresAt])

  const elapsedMs = Math.max(0, now - startedAt)
  const remainingMs = timed ? Math.max(0, (expiresAt as number) - now) : null
  const expired = timed && remainingMs === 0

  useEffect(() => {
    if (expired && !hasFiredExpire.current) {
      hasFiredExpire.current = true
      onExpireRef.current?.()
    }
  }, [expired])

  return { timed, remainingMs, elapsedMs, expired }
}

/** Formats milliseconds as `m:ss` (or `h:mm:ss` past an hour). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
