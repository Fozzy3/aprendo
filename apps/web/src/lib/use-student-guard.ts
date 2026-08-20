import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { studentAppStateQuery } from './student-queries.ts'
import { type ActiveStudentSession, useCurrentStudent } from './student-session.ts'

/**
 * The shared gate for student-only surfaces (Hoy, Temario, Progreso): resolves
 * the session, redirects to login when signed out and to the diagnostic when it
 * hasn't been completed, and reports a single status the caller can switch on.
 *
 * Centralizing it keeps the redirect rules in one place — routes only decide
 * what to render once `status === 'ready'`.
 */
export type StudentGuard =
  | { status: 'loading'; session: null }
  | { status: 'redirecting'; session: ActiveStudentSession | null }
  | { status: 'ready'; session: ActiveStudentSession }

export function useStudentGuard(): StudentGuard {
  const navigate = useNavigate()
  const { session, isReady } = useCurrentStudent()
  const appStateQuery = useQuery({
    ...studentAppStateQuery(session?.studentId),
    enabled: isReady && session != null,
  })

  useEffect(() => {
    if (isReady && session == null) {
      void navigate({ to: '/login' })
    }
  }, [isReady, navigate, session])

  useEffect(() => {
    if (!isReady || session == null || appStateQuery.data == null) return
    if (!appStateQuery.data.hasCompletedDiagnostic) {
      void navigate({ to: '/diagnostic' })
    }
  }, [appStateQuery.data, isReady, navigate, session])

  if (!isReady) return { status: 'loading', session: null }
  if (session == null) return { status: 'redirecting', session: null }
  if (appStateQuery.isPending) return { status: 'loading', session: null }
  if (appStateQuery.data != null && !appStateQuery.data.hasCompletedDiagnostic) {
    return { status: 'redirecting', session }
  }
  return { status: 'ready', session }
}
