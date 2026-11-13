import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import { SessionSolve } from '../components/SessionSolve.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { TimedSessionIntro } from '../components/TimedSessionIntro.tsx'
import { Welcome } from '../components/Welcome.tsx'
import { findResumableSession } from '../lib/resume-session.ts'
import { welcomeReturn } from '../lib/safe-next.ts'
import { sessionHistoryQuery, studentAppStateQuery, studentQuery } from '../lib/student-queries.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { getAllSubjectThemes } from '../lib/subject-theme.ts'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { readConvexError } from '../lib/convex-error.ts'

export const Route = createFileRoute('/diagnostic')({
  /** Where a placed student goes back to after the short welcome (`use-student-guard`). */
  validateSearch: (search: Record<string, unknown>): { volver?: string } =>
    typeof search.volver === 'string' ? { volver: search.volver } : {},
  component: PlacementPage,
})

const DIAGNOSTIC = SESSION_KIND_CONFIG.diagnostic

/**
 * The general diagnostic, the app's entry point: 20 questions from the five
 * areas, without help. Completing it places every area at once and unlocks
 * the app. Placed students can come back and sit it again.
 *
 * The welcome comes first until the student has consented and finished it;
 * a student placed before consent was asked gets its short version.
 */
function PlacementPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const { volver } = Route.useSearch()
  const { session, isReady } = useCurrentStudent()
  const [sessionId, setSessionId] = useState<string | null>(null)

  const appStateQuery = useQuery({
    ...studentAppStateQuery(session?.studentId),
    enabled: isReady && session != null,
  })
  const studentDataQuery = useQuery({
    ...studentQuery(session?.studentId),
    enabled: isReady && session != null,
  })
  // createSession hands back an unfinished diagnostic instead of a new one, so
  // the intro's full clock would be wrong for it: resume it directly.
  const diagnosticsQuery = useQuery({
    ...sessionHistoryQuery(session?.studentId, { kind: 'diagnostic' }),
    enabled: isReady && session != null,
  })

  const createSession = useConvexMutation(api.sessions.createSession)
  const createMutation = useMutation({
    mutationFn: async () => createSession({ studentId: session?.studentId as never, kind: 'diagnostic' }),
    onSuccess: setSessionId,
  })

  useEffect(() => {
    if (isReady && session == null) {
      void navigate({ to: '/login' })
    }
  }, [isReady, navigate, session])

  if (!isReady || session == null || appStateQuery.isPending || diagnosticsQuery.isPending || studentDataQuery.isPending) {
    return <FullScreenLoader />
  }

  const appState = appStateQuery.data
  const hasAnyPlacement = appState?.hasPlacement ?? false
  const student = studentDataQuery.data
  const needsWelcome = appState != null && !appState.isStaff && (!appState.hasConsent || !appState.onboarded)
  const unfinished = findResumableSession(diagnosticsQuery.data ?? [], { kind: 'diagnostic' }, Date.now())

  return (
    <StudentAppShell
      session={session}
      activeSection="today"
      immersive={sessionId != null}
      hideTabs={!hasAnyPlacement}
      topBarSupplement={<div className="student-pill">Sin tutor</div>}
    >
      {sessionId != null ? (
        <SessionSolve
          sessionId={sessionId}
          onExit={() => setSessionId(null)}
          onCompleted={(completedId) =>
            navigate({ to: '/practice/$sessionId/review', params: { sessionId: completedId } })
          }
        />
      ) : needsWelcome && student != null ? (
        <div className="diagnostic-intro">
          <Welcome
            student={student}
            short={hasAnyPlacement}
            onDone={async () => {
              if (hasAnyPlacement) router.history.push(welcomeReturn(volver))
              else setSessionId(await createSession({ studentId: session.studentId, kind: 'diagnostic' }))
            }}
          />
        </div>
      ) : (
        <div className="diagnostic-intro">
          {unfinished != null ? (
            <section className="timed-intro fade-in">
              <h2 className="timed-intro-title">Diagnóstico en curso</h2>
              <div className="timed-intro-actions">
                <button type="button" className="btn-primary" onClick={() => setSessionId(unfinished._id)}>
                  Continuar
                </button>
              </div>
            </section>
          ) : (
            <TimedSessionIntro
              title={DIAGNOSTIC.labelEs}
              questionCount={getConfiguredQuestionCount(DIAGNOSTIC)}
              timeLimitMs={DIAGNOSTIC.timeLimitMs ?? 0}
              isStarting={createMutation.isPending}
              error={
                createMutation.error != null
                  ? readConvexError(createMutation.error, 'No pudimos iniciar el diagnóstico.')
                  : null
              }
              onStart={() => createMutation.mutate()}
              // Before placement there is nowhere else to go.
              {...(hasAnyPlacement
                ? {
                    cancelLabel: 'Volver a Hoy',
                    onCancel: () => {
                      createMutation.reset()
                      void navigate({ to: '/today' })
                    },
                  }
                : {})}
            >
              <ul className="welcome-areas" aria-label="Áreas del diagnóstico">
                {getAllSubjectThemes().map((subject) => (
                  <li key={subject.id} style={{ '--subject-color': subject.color } as CSSProperties}>
                    <span aria-hidden="true" className="subject-dot" />
                    {subject.label}
                  </li>
                ))}
              </ul>
            </TimedSessionIntro>
          )}
        </div>
      )}
    </StudentAppShell>
  )
}
