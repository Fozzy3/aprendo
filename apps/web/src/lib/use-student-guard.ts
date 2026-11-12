import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { studentAppStateQuery } from './student-queries.ts'
import { type ActiveStudentSession, useCurrentStudent } from './student-session.ts'

/**
 * The shared gate for student-only surfaces (Hoy, Aprende, Yo): resolves the
 * session, redirects to login when signed out and to `/diagnostic` when the
 * diagnostic or the welcome (consent included) is not done, and reports a
 * single status the caller can switch on. Staff never sit placement or the
 * welcome, so that second redirect skips them. A placed student comes back
 * here (`volver`) after the welcome's short version.
 *
 * Centralizing it keeps the redirect rules in one place — routes only decide
 * what to render once `status === 'ready'`. `enabled: false` holds it off for a
 * layout route (Retos) while a child route is the one on screen.
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

export function useStudentGuard({ enabled = true }: { enabled?: boolean } = {}): StudentGuard {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { session, isReady } = useCurrentStudent()
  const appStateQuery = useQuery({
    ...studentAppStateQuery(session?.studentId),
    enabled: enabled && isReady && session != null,
  })
  const appState = appStateQuery.data
  const needsPlacement = appState != null && !appState.hasPlacement && !appState.isStaff
  const needsWelcome = appState != null && !appState.isStaff && (!appState.hasConsent || !appState.onboarded)

  useEffect(() => {
    if (enabled && isReady && session == null) {
      void navigate({ to: '/login' })
    }
  }, [enabled, isReady, navigate, session])

  useEffect(() => {
    if (!enabled || !isReady || session == null) return
    if (needsPlacement) {
      void navigate({ to: '/diagnostic' })
    } else if (needsWelcome) {
      void navigate({ to: '/diagnostic', search: { volver: pathname } })
    }
  }, [enabled, isReady, navigate, needsPlacement, needsWelcome, pathname, session])

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
      reason: 'Primero haz tu diagnóstico. Con eso se abre el resto de la app.',
    }
  }
  if (needsWelcome) {
    return { status: 'redirecting', session, reason: 'Antes de seguir, dos preguntas rápidas.' }
  }
  return { status: 'ready', session }
}
