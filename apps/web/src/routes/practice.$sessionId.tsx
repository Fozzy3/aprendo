import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Outlet, createFileRoute, useChildMatches, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '@aprendo/convex/api'
import {
  SESSION_KIND_CONFIG,
  getSimulacroSessionQuestionCount,
} from '@aprendo/convex/sessionKinds'
import { SessionSolve } from '../components/SessionSolve.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { ExamBreak } from '../components/ExamBreak.tsx'
import { useCurrentStudent } from '../lib/student-session.ts'
import { sessionQuery } from '../lib/student-queries.ts'
import { isFullSittingOne } from '../lib/exam-day.ts'
import { readConvexError } from '../lib/convex-error.ts'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'

export const Route = createFileRoute('/practice/$sessionId')({
  component: PracticeSolvePage,
})

const SITTING_TWO = SESSION_KIND_CONFIG.simulacro.simulacroSessions?.find(
  (sitting) => sitting.sessionNumber === 2,
)

function PracticeSolvePage() {
  const navigate = useNavigate()
  const { sessionId } = Route.useParams()
  // Read the rendered child route, never the URL. The URL changes the moment a
  // navigation starts, while this layout is still on screen: reading it here
  // mounted the solve screen of a finished session for an instant, and its
  // hand-off to the review navigated straight back (Hoy or Ruta "did nothing").
  // A boolean, not the array: a new array on every router write re-rendered
  // this layout throughout each navigation.
  const isReviewRoute = useChildMatches({ select: (matches) => matches.length > 0 })
  const { session, isReady } = useCurrentStudent()
  // The full simulacro's Sesión 1 ends on a break, not on its review.
  const [breakAfter, setBreakAfter] = useState<string | null>(null)

  // Same query key as SessionSolve, so this reads its cache rather than fetching.
  const sessionDoc = useQuery({
    ...sessionQuery(sessionId),
    enabled: !isReviewRoute && isReady && session != null,
  })

  const createSession = useConvexMutation(api.sessions.createSession)
  const startSecondSitting = useMutation({
    mutationFn: async () => {
      if (session == null) throw new Error('No has iniciado sesión.')
      return createSession({
        studentId: session.studentId,
        kind: 'simulacro',
        simulacroSessionNumber: 2,
      })
    },
    onSuccess: (nextId) =>
      navigate({ to: '/practice/$sessionId', params: { sessionId: nextId } }),
  })

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
      <FullScreenLoader />
    )
  }

  if (breakAfter === sessionId && SITTING_TWO != null) {
    return (
      <StudentAppShell session={session} activeSection="practice" immersive>
        <ExamBreak
          questionCount={getSimulacroSessionQuestionCount(SITTING_TWO)}
          timeLimitMs={SITTING_TWO.timeLimitMs}
          isStarting={startSecondSitting.isPending}
          error={
            startSecondSitting.error
              ? readConvexError(startSecondSitting.error, 'No se pudo empezar la Sesión 2.')
              : null
          }
          onStart={() => startSecondSitting.mutate()}
          onLater={() => navigate({ to: '/practice' })}
        />
      </StudentAppShell>
    )
  }

  return (
    <StudentAppShell session={session} activeSection="practice" immersive>
      <SessionSolve
        // A new session (Sesión 2 after the break) is a fresh screen, not
        // question 37 of the previous one.
        key={sessionId}
        sessionId={sessionId}
        onExit={() => navigate({ to: '/practice' })}
        onCompleted={(completedId) => {
          const completed = sessionDoc.data?.session
          if (completed != null && completed._id === completedId && isFullSittingOne(completed)) {
            setBreakAfter(completedId)
            return
          }
          void navigate({ to: '/practice/$sessionId/review', params: { sessionId: completedId } })
        }}
      />
    </StudentAppShell>
  )
}
