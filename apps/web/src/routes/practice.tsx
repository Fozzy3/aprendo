import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { ArrowRight, Check, ChevronRight, Clock3, Coffee, Play } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { api } from '@aprendo/convex/api'
import {
  LAUNCHABLE_SESSION_KINDS,
  SESSION_KIND_CONFIG,
  getConfiguredQuestionCount,
  getSimulacroSessionQuestionCount,
  getSimulacroSubjectTarget,
  getSimulacroSubjectTargets,
  type FeedbackMode,
  type SessionKind,
} from '@aprendo/convex/sessionKinds'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { TimedSessionIntro } from '../components/TimedSessionIntro.tsx'
import { PracticeBuilder } from '../components/PracticeBuilder.tsx'
import type { builderSessionArgs } from '../lib/practice-builder.ts'
import { findResumableSession } from '../lib/resume-session.ts'
import { findPendingSecondSitting } from '../lib/exam-day.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import {
  formatSessionDate,
  formatTimeLimit,
  getKindIcon,
} from '../lib/session-display.ts'
import {
  sessionHistoryQuery,
  studentAppStateQuery,
  studentProgressQuery,
} from '../lib/student-queries.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { getSubjectLabel, getSubtopicLabel, subjectIds } from '../lib/taxonomy.ts'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { MascotMessage } from '../components/Mascot.tsx'
import { readConvexError } from '../lib/convex-error.ts'

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
  expiresAt?: number
}

/** The most specific label for a session's focus: subtopic, else subject. */
function getSessionFocusLabel(session: SessionRow): string | null {
  if (session.subtopicId != null) return getSubtopicLabel(session.subtopicId)
  if (session.subjectId != null) return getSubjectLabel(session.subjectId)
  return null
}

type StartInput = {
  kind: SessionKind
  subjectId?: string
  simulacroSessionNumber?: number
  feedbackMode?: FeedbackMode
  practice?: ReturnType<typeof builderSessionArgs>['practice']
}

/** Khan's Mastery Challenge, said in what it does to the student's levels. */
const RETO_COPY = '2 preguntas de cada uno de 3 subtemas que ya practicaste. Si aciertas ambas, ese subtema sube de nivel; si fallas ambas, baja.'
const RETO_LOCKED_COPY = 'Se abre cuando hayas practicado al menos 3 subtemas.'

/** A timed session chosen but not started: what its intro step shows. */
type PendingStart = StartInput & {
  title: string
  subjectColor?: string
  questionCount: number
  timeLimitMs: number
}

const FILTERS: Array<{ value: 'all' | SessionKind; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'nivelacion', label: 'Nivelación' },
  { value: 'recommended', label: 'Recomendada' },
  { value: 'topic', label: 'Por tema' },
  { value: 'repaso', label: 'Repaso' },
  { value: 'simulacro', label: 'Simulacro' },
  { value: 'personalizada', label: 'A tu medida' },
  { value: 'reto', label: 'Reto' },
]

function PracticeHubPage() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isHubIndex = pathname === '/practice'
  const { session, isReady } = useCurrentStudent()

  const [expandedKind, setExpandedKind] = useState<SessionKind | null>(null)
  const [filter, setFilter] = useState<'all' | SessionKind>('all')
  // Timed kinds stop at an intro before the clock starts; see TimedSessionIntro.
  const [pendingStart, setPendingStart] = useState<PendingStart | null>(null)

  const appStateQuery = useQuery({
    ...studentAppStateQuery(session?.studentId),
    enabled: isHubIndex && isReady && session != null,
  })
  const historyQuery = useQuery({
    ...sessionHistoryQuery(session?.studentId, { limit: 100 }),
    enabled: isHubIndex && isReady && session != null,
  })
  // Only for `retoReady`; the reto card stays usable until it answers.
  const progressQuery = useQuery({
    ...studentProgressQuery(session?.studentId),
    enabled: isHubIndex && isReady && session != null,
  })

  const createSession = useConvexMutation(api.sessions.createSession)
  const startMutation = useMutation({
    mutationFn: async (input: StartInput) => {
      if (session == null) throw new Error('No has iniciado sesión.')
      return createSession({
        studentId: session.studentId,
        kind: input.kind,
        ...(input.subjectId != null ? { subjectId: input.subjectId } : {}),
        ...(input.simulacroSessionNumber != null
          ? { simulacroSessionNumber: input.simulacroSessionNumber }
          : {}),
        ...(input.feedbackMode != null ? { feedbackMode: input.feedbackMode } : {}),
        ...(input.practice != null ? { practice: input.practice } : {}),
      })
    },
    onSuccess: async (sessionId) => {
      await navigate({ to: '/practice/$sessionId', params: { sessionId } })
      // This hub stays mounted as the layout of the solve route, so a stale
      // intro would still be open when the student comes back.
      setPendingStart(null)
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
  // A finished Sesión 1 whose afternoon sitting has not started yet. An
  // unfinished Sesión 2 already shows as "en curso" below.
  const pendingSecondSitting = findPendingSecondSitting(sessions)
  const sittingTwo = SESSION_KIND_CONFIG.simulacro.simulacroSessions?.find(
    (sitting) => sitting.sessionNumber === 2,
  )

  // createSession hands back an unfinished sitting instead of a new one, so
  // the intro's full clock and "Empezar" would be wrong: go straight back in.
  const openTimedStart = (start: PendingStart) => {
    const resumable = findResumableSession(sessions, start, Date.now())
    if (resumable != null) {
      void navigate({ to: '/practice/$sessionId', params: { sessionId: resumable._id } })
      return
    }
    setPendingStart(start)
  }

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
            const pending = isExpanded && pendingStart?.kind === kind ? pendingStart : null
            const retoLocked = kind === 'reto' && progressQuery.data?.retoReady === false

            return (
              <Fragment key={kind}>
                <div className={`launch-card${isExpanded ? ' is-expanded' : ''}`}>
                  <button
                    type="button"
                    className="launch-card-main"
                    disabled={startMutation.isPending || retoLocked}
                    onClick={() => {
                      if (config.requiresSubject || config.simulacroSessions != null) {
                        setExpandedKind((prev) => (prev === kind ? null : kind))
                        setPendingStart(null)
                        startMutation.reset()
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
                      <span className="launch-card-copy">
                        {kind === 'reto' ? RETO_COPY : config.taglineEs}
                      </span>
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
                        {retoLocked ? <span>{RETO_LOCKED_COPY}</span> : null}
                      </span>
                    </span>
                    <span className="launch-card-cta" aria-hidden>
                      {config.requiresSubject || config.simulacroSessions != null
                        ? <ChevronRight size={18} />
                        : isStarting ? '…' : <Play size={16} />}
                    </span>
                  </button>

                  {pending != null ? (
                    <TimedSessionIntro
                      title={pending.title}
                      subjectColor={pending.subjectColor}
                      questionCount={pending.questionCount}
                      timeLimitMs={pending.timeLimitMs}
                      isStarting={startMutation.isPending}
                      error={
                        startMutation.error
                          ? readConvexError(startMutation.error, 'No se pudo iniciar la sesión.')
                          : null
                      }
                      cancelLabel="Elegir otra"
                      onStart={() => startMutation.mutate(pending)}
                      onCancel={() => {
                        startMutation.reset()
                        setPendingStart(null)
                      }}
                    />
                  ) : null}

                  {config.simulacroSessions != null && isExpanded && pending == null ? (
                    <>
                      <div className="topic-picker" role="group" aria-label="Elige una sesión del simulacro">
                        <span className="hub-picker-label">Examen completo</span>
                        {/* The real day: Sesión 1, a break, Sesión 2. It starts as
                            Sesión 1; its end leads to the break screen. */}
                        {config.simulacroSessions.slice(0, 1).map((sittingOne) => (
                          <button
                            key="exam-day"
                            type="button"
                            className="topic-chip is-featured"
                            disabled={startMutation.isPending}
                            onClick={() =>
                              openTimedStart({
                                kind,
                                simulacroSessionNumber: sittingOne.sessionNumber,
                                title: 'Día de examen completo · Sesión 1',
                                questionCount: getSimulacroSessionQuestionCount(sittingOne),
                                timeLimitMs: sittingOne.timeLimitMs,
                              })}
                          >
                            Día de examen completo · Sesión 1, descanso y Sesión 2
                          </button>
                        ))}
                        {config.simulacroSessions.map((simulacroSession) => (
                          <button
                            key={simulacroSession.sessionNumber}
                            type="button"
                            className="topic-chip"
                            disabled={startMutation.isPending}
                            onClick={() =>
                              openTimedStart({
                                kind,
                                simulacroSessionNumber: simulacroSession.sessionNumber,
                                title: `Simulacro · ${simulacroSession.labelEs}`,
                                questionCount: getSimulacroSessionQuestionCount(simulacroSession),
                                timeLimitMs: simulacroSession.timeLimitMs,
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
                                openTimedStart({
                                  kind,
                                  subjectId: target.subjectId,
                                  title: `Simulacro de ${theme.label}`,
                                  subjectColor: theme.color,
                                  questionCount: target.questionCount,
                                  timeLimitMs: areaTarget?.timeLimitMs ?? 0,
                                })}
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

                  {config.requiresSubject && isExpanded && pending == null ? (
                    <div className="topic-picker" role="group" aria-label="Elige una asignatura">
                      {subjectIds.map((subjectId) => (
                        <button
                          key={subjectId}
                          type="button"
                          className="topic-chip"
                          disabled={startMutation.isPending}
                          onClick={() => {
                            if (config.timeLimitMs == null) {
                              startMutation.mutate({ kind, subjectId })
                              return
                            }
                            const theme = getSubjectTheme(subjectId)
                            openTimedStart({
                              kind,
                              subjectId,
                              title: `${config.labelEs} de ${theme.label}`,
                              subjectColor: theme.color,
                              questionCount: getConfiguredQuestionCount(config),
                              timeLimitMs: config.timeLimitMs,
                            })
                          }}
                        >
                          {getSubjectLabel(subjectId)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* The builder sits beside the other topic-scoped practice. */}
                {kind === 'topic' ? (
                  <PracticeBuilder
                    studentId={session.studentId}
                    expanded={expandedKind === 'personalizada'}
                    disabled={startMutation.isPending}
                    isStarting={startMutation.isPending && startMutation.variables?.kind === 'personalizada'}
                    error={
                      startMutation.error && startMutation.variables?.kind === 'personalizada'
                        ? readConvexError(startMutation.error, 'No se pudo iniciar la práctica.')
                        : null
                    }
                    onToggle={() => {
                      setExpandedKind((prev) => (prev === 'personalizada' ? null : 'personalizada'))
                      setPendingStart(null)
                      startMutation.reset()
                    }}
                    onStart={(args) => startMutation.mutate(args)}
                  />
                ) : null}
              </Fragment>
            )
          })}
        </section>

        {startMutation.error && pendingStart == null && startMutation.variables?.kind !== 'personalizada' ? (
          <div className="stage-alert" role="alert">
            {readConvexError(startMutation.error, 'No se pudo iniciar la sesión.')}
          </div>
        ) : null}

        {pendingSecondSitting != null && sittingTwo != null ? (
          <section className="hub-resume" aria-label="Día de examen">
            <button
              type="button"
              className="resume-row"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate({ kind: 'simulacro', simulacroSessionNumber: 2 })}
            >
              <span className="resume-row-icon" aria-hidden>
                <Coffee size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <strong>Día de examen: te falta la Sesión 2</strong>
                <small>
                  {getSimulacroSessionQuestionCount(sittingTwo)} preguntas · {formatTimeLimit(sittingTwo.timeLimitMs)} · el reloj empieza al tocar
                </small>
              </span>
              <span className="resume-row-cta">
                {startMutation.isPending && startMutation.variables?.simulacroSessionNumber === 2
                  ? 'Empezando…'
                  : 'Empezar'}{' '}
                <ArrowRight size={14} />
              </span>
            </button>
          </section>
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
