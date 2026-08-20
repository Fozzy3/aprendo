import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowRight, Check, ChevronRight, Clock3, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@aprendo/convex/api'
import {
  LAUNCHABLE_SESSION_KINDS,
  SESSION_KIND_CONFIG,
  getConfiguredQuestionCount,
  getSimulacroSessionQuestionCount,
  getSimulacroSubjectTarget,
  getSimulacroSubjectTargets,
  type SessionKind,
} from '@aprendo/convex/sessionKinds'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import {
  formatSessionDate,
  formatTimeLimit,
  getKindIcon,
} from '../lib/session-display.ts'
import { sessionHistoryQuery, studentAppStateQuery } from '../lib/student-queries.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { getSubjectLabel, getSubtopicLabel, subjectIds } from '../lib/taxonomy.ts'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { MascotMessage } from '../components/Mascot.tsx'

export const Route = createFileRoute('/practice')({
  component: PracticeHubPage,
})

type SessionRow = {
  _id: string
  kind: SessionKind
  status: 'created' | 'in_progress' | 'completed' | 'abandoned'
  subjectId?: string
  subtopicId?: string
  startedAt: number
  questionCount: number
  summary?: { correctCount: number; questionCount: number; accuracy: number } | null
  simulacroSessionNumber?: number
}

/** The most specific label for a session's focus: subtopic, else subject. */
function getSessionFocusLabel(session: SessionRow): string | null {
  if (session.subtopicId != null) return getSubtopicLabel(session.subtopicId)
  if (session.subjectId != null) return getSubjectLabel(session.subjectId)
  return null
}

const FILTERS: Array<{ value: 'all' | SessionKind; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'nivelacion', label: 'Nivelación' },
  { value: 'recommended', label: 'Recomendada' },
  { value: 'topic', label: 'Por tema' },
  { value: 'repaso', label: 'Repaso' },
  { value: 'simulacro', label: 'Simulacro' },
]

function PracticeHubPage() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isHubIndex = pathname === '/practice'
  const { session, isReady } = useCurrentStudent()

  const [expandedKind, setExpandedKind] = useState<SessionKind | null>(null)
  const [filter, setFilter] = useState<'all' | SessionKind>('all')

  const appStateQuery = useQuery({
    ...studentAppStateQuery(session?.studentId),
    enabled: isHubIndex && isReady && session != null,
  })
  const historyQuery = useQuery({
    ...sessionHistoryQuery(session?.studentId, { limit: 100 }),
    enabled: isHubIndex && isReady && session != null,
  })

  const createSession = useConvexMutation(api.sessions.createSession)
  const startMutation = useMutation({
    mutationFn: async (input: {
      kind: SessionKind
      subjectId?: string
      simulacroSessionNumber?: number
    }) => {
      if (session == null) throw new Error('No has iniciado sesión.')
      return createSession({
        studentId: session.studentId,
        kind: input.kind,
        ...(input.subjectId != null ? { subjectId: input.subjectId } : {}),
        ...(input.simulacroSessionNumber != null
          ? { simulacroSessionNumber: input.simulacroSessionNumber }
          : {}),
      })
    },
    onSuccess: async (sessionId) => {
      await navigate({ to: '/practice/$sessionId', params: { sessionId } })
    },
  })

  useEffect(() => {
    if (!isHubIndex) return
    if (isReady && session == null) {
      void navigate({ to: '/login' })
    }
  }, [isHubIndex, isReady, navigate, session])

  useEffect(() => {
    if (!isHubIndex) return
    if (!isReady || session == null || appStateQuery.data == null) return
    if (!appStateQuery.data.hasCompletedDiagnostic) {
      void navigate({ to: '/diagnostic' })
    }
  }, [appStateQuery.data, isHubIndex, isReady, navigate, session])

  if (!isHubIndex) {
    return <Outlet />
  }

  if (!isReady || session == null || appStateQuery.isPending || historyQuery.isPending) {
    return (
      <FullScreenLoader />
    )
  }

  const sessions = (historyQuery.data ?? []) as SessionRow[]
  const inProgress = sessions.filter((s) => s.status === 'in_progress' || s.status === 'created')
  const completed = sessions.filter((s) => s.status === 'completed')
  const filtered =
    filter === 'all' ? completed : completed.filter((s) => s.kind === filter)

  return (
    <StudentAppShell session={session} activeSection="practice">
      <div className="practice-hub fade-in">
        <header className="hub-head">
          <p className="kicker">Práctica</p>
          <h1 className="hub-title">¿Qué quieres practicar hoy?</h1>
        </header>

        <section className="hub-launch" aria-label="Iniciar una sesión">
          {LAUNCHABLE_SESSION_KINDS.map((kind) => {
            const config = SESSION_KIND_CONFIG[kind]
            const Icon = getKindIcon(kind)
            const isExpanded = expandedKind === kind
            const isStarting = startMutation.isPending && startMutation.variables?.kind === kind

            return (
              <div key={kind} className={`launch-card${isExpanded ? ' is-expanded' : ''}`}>
                <button
                  type="button"
                  className="launch-card-main"
                  disabled={startMutation.isPending}
                  onClick={() => {
                    if (config.requiresSubject || config.simulacroSessions != null) {
                      setExpandedKind((prev) => (prev === kind ? null : kind))
                    } else {
                      startMutation.mutate({ kind })
                    }
                  }}
                >
                  <span className="launch-card-icon" aria-hidden>
                    <Icon size={20} />
                  </span>
                  <span className="launch-card-body">
                    <span className="launch-card-title">{config.labelEs}</span>
                    <span className="launch-card-copy">{config.taglineEs}</span>
                    <span className="launch-card-meta">
                      <span>
                        {config.simulacroSessions != null
                          ? `${getConfiguredQuestionCount(config)} preguntas en 2 sesiones`
                          : `${getConfiguredQuestionCount(config)} preguntas`}
                      </span>
                      {config.timeLimitMs != null ? (
                        <span className="launch-card-meta-time">
                          <Clock3 size={12} /> {formatTimeLimit(config.timeLimitMs)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="launch-card-cta" aria-hidden>
                    {config.requiresSubject || config.simulacroSessions != null
                      ? <ChevronRight size={18} />
                      : isStarting ? '…' : <Play size={16} />}
                  </span>
                </button>

                {config.simulacroSessions != null && isExpanded ? (
                  <>
                    <div className="topic-picker" role="group" aria-label="Elige una sesión del simulacro">
                      <span className="hub-picker-label">Examen completo</span>
                      {config.simulacroSessions.map((simulacroSession) => (
                        <button
                          key={simulacroSession.sessionNumber}
                          type="button"
                          className="topic-chip"
                          disabled={startMutation.isPending}
                          onClick={() =>
                            startMutation.mutate({
                              kind,
                              simulacroSessionNumber: simulacroSession.sessionNumber,
                            })}
                        >
                          {simulacroSession.labelEs} · {getSimulacroSessionQuestionCount(simulacroSession)} preguntas · {formatTimeLimit(simulacroSession.timeLimitMs)}
                        </button>
                      ))}
                    </div>

                    {/* Shorter, single-area simulacro at the official pace. */}
                    <div className="topic-picker" role="group" aria-label="Elige un área para el simulacro">
                      <span className="hub-picker-label">Por área</span>
                      {getSimulacroSubjectTargets().map((target) => {
                        const theme = getSubjectTheme(target.subjectId)
                        const areaTarget = getSimulacroSubjectTarget(target.subjectId)
                        return (
                          <button
                            key={target.subjectId}
                            type="button"
                            className="topic-chip"
                            disabled={startMutation.isPending}
                            style={{ borderColor: theme.color }}
                            onClick={() =>
                              startMutation.mutate({ kind, subjectId: target.subjectId })}
                          >
                            <span aria-hidden="true">{theme.emoji}</span> {theme.label} ·{' '}
                            {target.questionCount} preguntas ·{' '}
                            {formatTimeLimit(areaTarget?.timeLimitMs ?? null)}
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : null}

                {config.requiresSubject && isExpanded ? (
                  <div className="topic-picker" role="group" aria-label="Elige una asignatura">
                    {subjectIds.map((subjectId) => (
                      <button
                        key={subjectId}
                        type="button"
                        className="topic-chip"
                        disabled={startMutation.isPending}
                        onClick={() => startMutation.mutate({ kind, subjectId })}
                      >
                        {getSubjectLabel(subjectId)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </section>

        {startMutation.error ? (
          <div className="stage-alert">
            {startMutation.error instanceof Error
              ? startMutation.error.message
              : 'No se pudo iniciar la sesión.'}
          </div>
        ) : null}

        {inProgress.length > 0 ? (
          <section className="hub-resume" aria-label="Sesiones en curso">
            {inProgress.map((s) => {
              const Icon = getKindIcon(s.kind)
              return (
                <Link
                  key={s._id}
                  to="/practice/$sessionId"
                  params={{ sessionId: s._id }}
                  className="resume-row"
                >
                  <span className="resume-row-icon" aria-hidden>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong>{SESSION_KIND_CONFIG[s.kind].labelEs} en curso</strong>
                    <small>
                      {getSessionFocusLabel(s) != null ? `${getSessionFocusLabel(s)} · ` : ''}
                      {s.kind === 'simulacro' && s.simulacroSessionNumber != null
                        ? `Sesión ${s.simulacroSessionNumber} · `
                        : ''}
                      {s.questionCount} preguntas
                    </small>
                  </span>
                  <span className="resume-row-cta">
                    Continuar <ArrowRight size={14} />
                  </span>
                </Link>
              )
            })}
          </section>
        ) : null}

        <section className="hub-history card">
          <div className="hub-history-head">
            <div>
              <p className="kicker mb-1">Historial</p>
              <h2>Tus sesiones</h2>
            </div>
            <div className="hub-filters" role="tablist" aria-label="Filtrar por tipo">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.value}
                  className={`hub-filter${filter === f.value ? ' is-active' : ''}`}
                  onClick={() => setFilter(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="hub-history-body">
              {filtered.map((s) => {
                const Icon = getKindIcon(s.kind)
                const correct = s.summary?.correctCount ?? 0
                const total = s.summary?.questionCount ?? s.questionCount
                const accuracy = s.summary?.accuracy ?? 0
                return (
                  <Link
                    key={s._id}
                    to="/practice/$sessionId/review"
                    params={{ sessionId: s._id }}
                    className="history-row"
                  >
                    <span className="history-row-icon" aria-hidden>
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong>
                        {SESSION_KIND_CONFIG[s.kind].labelEs}
                        {s.kind === 'simulacro' && s.simulacroSessionNumber != null
                          ? ` · Sesión ${s.simulacroSessionNumber}`
                          : ''}
                        {getSessionFocusLabel(s) != null ? ` · ${getSessionFocusLabel(s)}` : ''}
                      </strong>
                      <small>{formatSessionDate(s.startedAt)}</small>
                    </span>
                    <span className="history-row-score">
                      <span className="history-row-fraction">
                        {correct}<span className="history-row-of">/{total}</span>
                      </span>
                      <span
                        className={`history-row-badge${accuracy >= 0.7 ? ' is-good' : accuracy >= 0.4 ? ' is-mid' : ' is-low'}`}
                      >
                        <Check size={11} /> {Math.round(accuracy * 100)}%
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="hub-history-empty">
              <MascotMessage
                mood="sleeping"
                size="md"
                title={
                  filter === 'all'
                    ? 'Todavía no has practicado'
                    : 'Nada de este tipo todavía'
                }
              >
                {filter === 'all'
                  ? 'Elige una práctica arriba y tu primera sesión aparecerá acá.'
                  : 'Prueba con otro filtro.'}
              </MascotMessage>
            </div>
          )}
        </section>
      </div>
    </StudentAppShell>
  )
}
