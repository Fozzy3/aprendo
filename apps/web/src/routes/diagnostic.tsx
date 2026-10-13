import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, ChevronRight } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import { SchoolLabel } from '../components/SchoolLabel.tsx'
import { SessionSolve } from '../components/SessionSolve.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'
import { TimedSessionIntro } from '../components/TimedSessionIntro.tsx'
import { findResumableSession } from '../lib/resume-session.ts'
import { sessionHistoryQuery, studentAppStateQuery } from '../lib/student-queries.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { getAllSubjectThemes, getSubjectTheme } from '../lib/subject-theme.ts'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { readConvexError } from '../lib/convex-error.ts'

export const Route = createFileRoute('/diagnostic')({
  component: PlacementPage,
})

const NIVELACION = SESSION_KIND_CONFIG.nivelacion

/**
 * Placement ("Nivelación"), the app's entry point.
 *
 * Replaces the old single 20-question diagnostic: the student levels one ICFES
 * area at a time, and the first completed area unlocks the rest of the app. The
 * page stays reachable afterwards so the remaining four areas can be levelled
 * whenever the student wants — which is why it does not redirect away once
 * placement exists.
 */
function PlacementPage() {
  const navigate = useNavigate()
  const { session, isReady } = useCurrentStudent()
  const [sessionId, setSessionId] = useState<string | null>(null)
  // The area tapped but not started yet: the intro step sits between the two,
  // because starting is what sets the clock running.
  const [pendingSubjectId, setPendingSubjectId] = useState<string | null>(null)

  const appStateQuery = useQuery({
    ...studentAppStateQuery(session?.studentId),
    enabled: isReady && session != null,
  })
  // createSession hands back an unfinished nivelación instead of a new one, so
  // tapping that area resumes it: the intro's full clock would be wrong for it.
  const nivelacionesQuery = useQuery({
    ...sessionHistoryQuery(session?.studentId, { kind: 'nivelacion' }),
    enabled: isReady && session != null,
  })

  const createSession = useConvexMutation(api.sessions.createSession)
  const createMutation = useMutation({
    mutationFn: async (subjectId: string) =>
      createSession({
        studentId: session?.studentId as never,
        kind: 'nivelacion',
        subjectId,
      }),
    onSuccess: (createdId) => {
      setSessionId(createdId)
      setPendingSubjectId(null)
    },
  })

  useEffect(() => {
    if (isReady && session == null) {
      void navigate({ to: '/login' })
    }
  }, [isReady, navigate, session])

  if (!isReady || session == null || appStateQuery.isPending || nivelacionesQuery.isPending) {
    return (
      <FullScreenLoader />
    )
  }

  const placedSubjectIds = appStateQuery.data?.placedSubjectIds ?? []
  const hasAnyPlacement = appStateQuery.data?.hasPlacement ?? false
  const pendingSubject = pendingSubjectId != null ? getSubjectTheme(pendingSubjectId) : null
  const findUnfinished = (subjectId: string) =>
    findResumableSession(nivelacionesQuery.data ?? [], { kind: 'nivelacion', subjectId }, Date.now())

  return (
    <div className={`diagnostic-shell${sessionId != null ? ' is-immersive' : ''}`}>
      <header className="diagnostic-topbar">
        <div className="diagnostic-topbar-inner">
          <SchoolLabel studentName={session.name} subtitle="Nivelación" />

          <div className="diagnostic-topbar-actions">
            <div className="student-pill">Sin tutor · medimos tu nivel</div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="diagnostic-solve-main">
        {sessionId != null ? (
          <SessionSolve
            sessionId={sessionId}
            onExit={() => setSessionId(null)}
            onCompleted={(completedId) =>
              navigate({ to: '/practice/$sessionId/review', params: { sessionId: completedId } })
            }
          />
        ) : pendingSubject != null ? (
          <div className="diagnostic-intro">
            <TimedSessionIntro
              title={`${NIVELACION.labelEs} de ${pendingSubject.label}`}
              subjectColor={pendingSubject.color}
              questionCount={getConfiguredQuestionCount(NIVELACION)}
              timeLimitMs={NIVELACION.timeLimitMs ?? 0}
              isStarting={createMutation.isPending}
              error={
                createMutation.error != null
                  ? readConvexError(createMutation.error, 'No pudimos iniciar la nivelación.')
                  : null
              }
              cancelLabel="Elegir otra área"
              onStart={() => createMutation.mutate(pendingSubject.id)}
              onCancel={() => {
                createMutation.reset()
                setPendingSubjectId(null)
              }}
            />
          </div>
        ) : (
          <div className="diagnostic-intro fade-in">
            <header className="ruled-page-head">
              <h1 className="page-title">
                {hasAnyPlacement ? 'Nivela otra área' : '¿En qué nivel estás?'}
              </h1>
              <p className="page-lede">
                {hasAnyPlacement
                  ? 'Ya conoces tu nivel en al menos un área. Nivela las demás cuando quieras.'
                  : `Elige un área y responde ${NIVELACION.totalQuestions} preguntas sin ayuda. Con eso ubicamos tu nivel ICFES y armamos tu ruta. Puedes nivelar las demás áreas después.`}
              </p>
            </header>

            <ul className="ruled-list">
              {getAllSubjectThemes().map((subject) => {
                const isPlaced = placedSubjectIds.includes(subject.id)
                const isUnfinished = findUnfinished(subject.id) != null
                return (
                  <li key={subject.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const unfinished = findUnfinished(subject.id)
                        if (unfinished != null) setSessionId(unfinished._id)
                        else setPendingSubjectId(subject.id)
                      }}
                      className="ruled-row w-full cursor-pointer border-x-0 border-t-0 bg-transparent text-left hover:bg-[var(--bg-inset)]"
                    >
                      {/* The area's colour lives in its dot and nowhere else. */}
                      <span
                        aria-hidden="true"
                        className="subject-dot"
                        style={{ '--subject-color': subject.color } as CSSProperties}
                      />
                      <span className="ruled-row-main">
                        <span className="font-semibold">{subject.label}</span>
                        <span className="ruled-row-note">
                          {isUnfinished
                            ? 'En curso · toca para continuar'
                            : `${NIVELACION.totalQuestions} preguntas · 30 min`}
                        </span>
                      </span>
                      {isPlaced && (
                        <span className="chip-success chip" title="Ya nivelaste esta área">
                          <Check size={12} aria-hidden /> Nivelada
                        </span>
                      )}
                      <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--text-tertiary)]" />
                    </button>
                  </li>
                )
              })}
            </ul>

            {hasAnyPlacement && (
              <div className="mt-6">
                <Link to="/today" className="btn-secondary no-underline">
                  Ir a mi plan de hoy
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
