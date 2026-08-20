import { Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { SessionSolve } from '../components/SessionSolve.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { useCurrentStudent } from '../lib/student-session.ts'

export const Route = createFileRoute('/practice/$sessionId')({
  component: PracticeSolvePage,
})

function PracticeSolvePage() {
  const navigate = useNavigate()
  const { sessionId } = Route.useParams()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isReviewRoute = pathname.endsWith('/review')
  const { session, isReady } = useCurrentStudent()

  useEffect(() => {
    if (isReviewRoute) return
    if (isReady && session == null) {
      void navigate({ to: '/login' })
    }
  }, [isReady, isReviewRoute, navigate, session])

  // This route is also the layout for the nested `/review` subroute.
  if (isReviewRoute) {
    return <Outlet />
  }

  if (!isReady || session == null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-tertiary)]">Cargando…</p>
      </div>
    )
  }

  return (
    <StudentAppShell session={session} activeSection="practice" mainClassName="student-shell-main-immersive">
      <SessionSolve
        sessionId={sessionId}
        onExit={() => navigate({ to: '/practice' })}
        onCompleted={(completedId) =>
          navigate({ to: '/practice/$sessionId/review', params: { sessionId: completedId } })
        }
      />
    </StudentAppShell>
  )
}
