/**
 * "Día de examen": Saber 11 is Sesión 1 in the morning and Sesión 2 after
 * lunch, the same day. The two sittings are not linked in the data, so an exam
 * is a Sesión 1 plus the Sesión 2 started after it — the pairing the backend
 * uses for the combined report.
 */
type SittingLike = {
  kind: string
  subjectId?: string | null
  simulacroSessionNumber?: number
}

/** The full-exam Sesión 1 (a full sitting stored without a number counts as one). */
export function isFullSittingOne(session: SittingLike): boolean {
  return (
    session.kind === 'simulacro'
    && session.subjectId == null
    && (session.simulacroSessionNumber ?? 1) === 1
  )
}

/** The latest completed Sesión 1 still waiting for its Sesión 2, or null. */
export function findPendingSecondSitting<
  T extends SittingLike & { status: string; startedAt: number },
>(sessions: T[]): T | null {
  const full = sessions.filter((session) => session.kind === 'simulacro' && session.subjectId == null)
  const sittingOne = full
    .filter(isFullSittingOne)
    .reduce<T | null>((latest, session) =>
      latest == null || session.startedAt > latest.startedAt ? session : latest, null)
  if (sittingOne == null || sittingOne.status !== 'completed') return null
  const hasSecond = full.some((session) =>
    session.simulacroSessionNumber === 2
    && session.status !== 'abandoned'
    && session.startedAt > sittingOne.startedAt)
  return hasSecond ? null : sittingOne
}
