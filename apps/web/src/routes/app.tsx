import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { studentAppStateQuery } from '../lib/student-queries.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { RouteErrorPage } from '../components/RouteStates.tsx'

export const Route = createFileRoute('/app')({
  component: AppEntryPage,
})

/** After signing in: each role goes to its own home (`getStudentAppState`). */
function AppEntryPage() {
  const navigate = useNavigate()
  const { session, isReady, isError } = useCurrentStudent()
  const appStateQuery = useQuery({
    ...studentAppStateQuery(session?.studentId),
    enabled: isReady && session != null,
  })
  const appState = appStateQuery.data

  useEffect(() => {
    if (isReady && session == null && !isError) {
      void navigate({ to: '/login' })
    }
  }, [isError, isReady, navigate, session])

  useEffect(() => {
    if (!isReady || session == null || appState == null) return
    void navigate(
      appState.defaultSearch != null
        ? { to: '/admin', search: appState.defaultSearch }
        : { to: appState.defaultRoute },
    )
  }, [appState, isReady, navigate, session])

  if (isError || appStateQuery.isError || appState === null) return <RouteErrorPage />

  return <FullScreenLoader message="Preparando tu ruta…" />
}
