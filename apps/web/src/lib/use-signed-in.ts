import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useCurrentStudent } from './student-session.ts'

/**
 * Teacher, school and join pages only need someone signed in: what each
 * account may see is decided by the backend, per school.
 */
export function useSignedIn() {
  const navigate = useNavigate()
  const { session, isReady } = useCurrentStudent()
  useEffect(() => {
    // Back here after signing in: a join link keeps its code.
    if (isReady && session == null) {
      void navigate({ to: '/login', search: { next: window.location.pathname + window.location.search } })
    }
  }, [isReady, navigate, session])
  return session
}
