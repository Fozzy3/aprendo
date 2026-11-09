import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { studentAppStateQuery } from './student-queries.ts'
import { type ActiveStudentSession, useCurrentStudent } from './student-session.ts'

/**
 * The shared gate for student-only surfaces (Hoy, Aprende, Yo): resolves the
 * session, redirects to login when signed out and to the diagnostic when it
 * hasn't been completed, and reports a single status the caller can switch on.
 * Staff never sit placement, so that second redirect skips them.
 *
 * Centralizing it keeps the redirect rules in one place — routes only decide
 * what to render once `status === 'ready'`.
 */
export type StudentGuard =
  | { status: 'loading'; session: null }
  | {
      status: 'redirecting'
      session: ActiveStudentSession | null
      /** Why, in words the student can read. Never redirect without one. */
      reason: string
    }
  | { status: 'ready'; session: ActiveStudentSession }

export function useStudentGuard(): StudentGuard {
  const navigate = useNavigate()
  const { session, isReady } = useCurrentStudent()
  const appStateQuery = useQuery({
    ...studentAppStateQuery(session?.studentId),
    enabled: isReady && session != null,
  })
  const needsPlacement = appStateQuery.data != null
    && !appStateQuery.data.hasPlacement
    && !appStateQuery.data.isStaff

  useEffect(() => {
    if (isReady && session == null) {
      void navigate({ to: '/login' })
    }
  }, [isReady, navigate, session])

  useEffect(() => {
    if (!isReady || session == null) return
    if (needsPlacement) {
      void navigate({ to: '/diagnostic' })
    }
  }, [isReady, navigate, needsPlacement, session])

  if (!isReady) return { status: 'loading', session: null }
  if (session == null) {
    return {
      status: 'redirecting',
      session: null,
      reason: 'Tu sesión se cerró. Te llevamos al inicio de sesión.',
    }
  }
  if (appStateQuery.isPending) return { status: 'loading', session: null }
  if (needsPlacement) {
    // A redirect that happens with no explanation reads as the app ignoring the
    // tap. Saying why costs one sentence and turns a dead end into a step.
    return {
      status: 'redirecting',
      session,
      reason: 'Primero nivélate en un área. Con eso se abre el resto de la app.',
    }
  }
  return { status: 'ready', session }
}
