type TimedStart = { kind: string; subjectId?: string; simulacroSessionNumber?: number }

/**
 * The unfinished timed session `createSession` would hand back for this start,
 * or null when it would start a fresh one.
 *
 * Mirrors its reuse key (same kind, area and simulacro sitting; clock not run
 * out) so the hub doesn't show "30 min · Empezar" for what is really a resume
 * with four minutes left. Untimed kinds never show that intro, so their extra
 * subtopic key is left out.
 */
export function findResumableSession<
  T extends TimedStart & { status: string; expiresAt?: number },
>(sessions: T[], start: TimedStart, now: number): T | null {
  return sessions.find((session) =>
    session.status === 'in_progress'
    && (session.expiresAt == null || session.expiresAt > now)
    && session.kind === start.kind
    && session.subjectId === start.subjectId
    && session.simulacroSessionNumber === start.simulacroSessionNumber,
  ) ?? null
}
