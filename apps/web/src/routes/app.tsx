import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { studentAppStateQuery } from '../lib/student-queries.ts'
import { useCurrentStudent } from '../lib/student-session.ts'

export const Route = createFileRoute('/app')({
  component: AppEntryPage,
})

function AppEntryPage() {
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
    void navigate({ to: appStateQuery.data.defaultRoute })
  }, [appStateQuery.data, isReady, navigate, session])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <p className="text-sm text-[var(--text-tertiary)]">
        Preparando tu ruta...
      </p>
    </div>
  )
}
