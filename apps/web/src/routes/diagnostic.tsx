import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import { SessionSolve } from '../components/SessionSolve.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { TimedSessionIntro } from '../components/TimedSessionIntro.tsx'
import { Welcome } from '../components/Welcome.tsx'
import { findResumableSession } from '../lib/resume-session.ts'
import { readStored, writeStored } from '../lib/solve-state.ts'
import { sessionHistoryQuery, studentAppStateQuery } from '../lib/student-queries.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { getAllSubjectThemes } from '../lib/subject-theme.ts'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { readConvexError } from '../lib/convex-error.ts'

export const Route = createFileRoute('/diagnostic')({
  component: PlacementPage,
})

const DIAGNOSTIC = SESSION_KIND_CONFIG.diagnostic
// ponytail: per-browser flag; a student on a new device sees the welcome again until their first diagnostic.
const WELCOME_SEEN_KEY = 'aprendo:welcome-seen'

/**
 * The general diagnostic, the app's entry point: 20 questions from the five
 * areas, without help. Completing it places every area at once and unlocks
 * the app. Placed students can come back and sit it again.
 */
function PlacementPage() {
  const navigate = useNavigate()
  const { session, isReady } = useCurrentStudent()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() => readStored(WELCOME_SEEN_KEY) != null)

  const appStateQuery = useQuery({
    ...studentAppStateQuery(session?.studentId),
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

  if (!isReady || session == null || appStateQuery.isPending || diagnosticsQuery.isPending) {
    return <FullScreenLoader />
  }

  const hasAnyPlacement = appStateQuery.data?.hasPlacement ?? false
  const unfinished = findResumableSession(diagnosticsQuery.data ?? [], { kind: 'diagnostic' }, Date.now())

  return (
    <StudentAppShell
      session={session}
      activeSection="today"
      immersive={sessionId != null}
      hideTabs={!hasAnyPlacement}
      topBarSupplement={<div className="student-pill">Sin tutor · medimos tu nivel</div>}
    >
      {sessionId != null ? (
        <SessionSolve
          sessionId={sessionId}
          onExit={() => setSessionId(null)}
          onCompleted={(completedId) =>
            navigate({ to: '/practice/$sessionId/review', params: { sessionId: completedId } })
          }
        />
      ) : !hasAnyPlacement && !hasSeenWelcome ? (
        <div className="diagnostic-intro">
          <Welcome
            studentId={session.studentId}
            onDone={() => {
              writeStored(WELCOME_SEEN_KEY, '1')
              setHasSeenWelcome(true)
            }}
          />
        </div>
      ) : (
        <div className="diagnostic-intro">
          {unfinished != null ? (
            <section className="timed-intro fade-in">
              <h2 className="timed-intro-title">Tienes un diagnóstico en curso</h2>
              <p className="timed-intro-facts">El reloj siguió corriendo. Sigue donde ibas.</p>
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
              cancelLabel={hasAnyPlacement ? 'Volver a Hoy' : 'Ver la bienvenida'}
              onStart={() => createMutation.mutate()}
              onCancel={() => {
                createMutation.reset()
                if (hasAnyPlacement) void navigate({ to: '/today' })
                else setHasSeenWelcome(false)
              }}
            >
              <p className="timed-intro-lede">
                {hasAnyPlacement
                  ? 'Repítelo cuando quieras medir de nuevo tu punto de partida.'
                  : 'Preguntas de las cinco áreas, sin ayuda. Con ellas ubicamos tu nivel y armamos tu plan.'}
              </p>
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
