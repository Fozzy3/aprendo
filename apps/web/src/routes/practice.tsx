import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Outlet, createFileRoute, useChildMatches, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Clock3, Play } from 'lucide-react'
import { Fragment, useEffect, useState, type CSSProperties } from 'react'
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
import { formatTimeLimit } from '../lib/session-display.ts'
import {
  reviewQueueQuery,
  sessionHistoryQuery,
  studentAppStateQuery,
  studentProgressQuery,
} from '../lib/student-queries.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { getSubjectLabel, getSubtopicLabel, SUBJECT_IDS } from '@aprendo/convex/taxonomy'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
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
const REPASO_EMPTY_COPY = 'Nada por repasar hoy: cada tema vuelve cuando le toca.'

/** A timed session chosen but not started: what its intro step shows. */
type PendingStart = StartInput & {
  title: string
  subjectColor?: string
  questionCount: number
  timeLimitMs: number
}

function PracticeHubPage() {
  const navigate = useNavigate()
  // The rendered child route, not the URL (see practice.$sessionId.tsx).
  const isHubIndex = useChildMatches({ select: (matches) => matches.length === 0 })
  const { session, isReady } = useCurrentStudent()

  const [expandedKind, setExpandedKind] = useState<SessionKind | null>(null)
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
  // The repaso card says how many are due and locks at zero instead of failing on start.
  const reviewQueue = useQuery({
    ...reviewQueueQuery(session?.studentId),
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
    if (!appStateQuery.data.hasPlacement) {
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

  const optionsOpen = (kind: SessionKind) => SESSION_KIND_CONFIG[kind].requiresSubject || SESSION_KIND_CONFIG[kind].simulacroSessions != null

  return (
    <StudentAppShell session={session} activeSection="practice">
      <div className="ruled-page fade-in">
        <aside className="ruled-page-margin" aria-label="Tus sesiones">
          <p className="ruled-page-date">Práctica</p>
          <dl className="margin-facts">
            <div>
              <dt>Terminadas</dt>
              <dd>{completed.length}</dd>
            </div>
            <div>
              <dt>En curso</dt>
              <dd>{inProgress.length}</dd>
            </div>
          </dl>
        </aside>

        <div className="ruled-page-body">
          <header className="ruled-page-head">
            <h1 className="page-title">¿Qué quieres practicar hoy?</h1>
            <p className="page-lede">Elige una sesión. Las que tienen reloj te muestran sus reglas antes de empezar.</p>
          </header>

          {(pendingSecondSitting != null && sittingTwo != null) || inProgress.length > 0 ? (
            <section className="ruled-section" aria-labelledby="hub-resume-title">
              <h2 id="hub-resume-title" className="section-title">Para continuar</h2>
              <ul className="ruled-list">
                {pendingSecondSitting != null && sittingTwo != null ? (
                  <li>
                    <button
                      type="button"
                      className={ROW_BUTTON}
                      disabled={startMutation.isPending}
                      // Same intro as every timed start: it opens under the
                      // simulacro card and focusing its title scrolls it in.
                      onClick={() => {
                        setExpandedKind('simulacro')
                        openTimedStart({
                          kind: 'simulacro',
                          simulacroSessionNumber: 2,
                          title: `Simulacro · ${sittingTwo.labelEs}`,
                          questionCount: getSimulacroSessionQuestionCount(sittingTwo),
                          timeLimitMs: sittingTwo.timeLimitMs,
                        })
                      }}
                    >
                      <span className="ruled-row-label">Día de examen</span>
                      <span className="ruled-row-main">
                        <span className="font-semibold">Te falta la Sesión 2</span>
                        <span className="ruled-row-note">
                          {getSimulacroSessionQuestionCount(sittingTwo)} preguntas · {formatTimeLimit(sittingTwo.timeLimitMs)}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
                        Empezar <ArrowRight size={14} aria-hidden />
                      </span>
                    </button>
                  </li>
                ) : null}
                {inProgress.map((s) => (
                  <li key={s._id}>
                    <Link to="/practice/$sessionId" params={{ sessionId: s._id }} className="ruled-row no-underline">
                      <span className="ruled-row-label">En curso</span>
                      <span className="ruled-row-main">
                        <span className="font-semibold">{SESSION_KIND_CONFIG[s.kind].labelEs}</span>
                        <span className="ruled-row-note">
                          {getSessionFocusLabel(s) != null ? `${getSessionFocusLabel(s)} · ` : ''}
                          {s.kind === 'simulacro' && s.simulacroSessionNumber != null
                            ? `Sesión ${s.simulacroSessionNumber} · `
                            : ''}
                          {s.questionCount} preguntas
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold">
                        Continuar <ArrowRight size={14} aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="ruled-section" aria-labelledby="hub-launch-title">
            <h2 id="hub-launch-title" className="section-title">Empezar una sesión</h2>
            <ul className="ruled-list">
              {LAUNCHABLE_SESSION_KINDS.map((kind) => {
                const config = SESSION_KIND_CONFIG[kind]
                const isExpanded = expandedKind === kind
                const isStarting = startMutation.isPending && startMutation.variables?.kind === kind
                const pending = isExpanded && pendingStart?.kind === kind ? pendingStart : null
                const retoLocked = kind === 'reto' && progressQuery.data?.retoReady === false
                const repasoDue = kind === 'repaso' ? reviewQueue.data?.dueCount ?? null : null
                const repasoEmpty = repasoDue === 0
                const questionCount = repasoDue != null
                  ? Math.min(repasoDue * 2, getConfiguredQuestionCount(config))
                  : getConfiguredQuestionCount(config)

                return (
                  <Fragment key={kind}>
                    <li>
                      <button
                        type="button"
                        className={ROW_BUTTON}
                        disabled={startMutation.isPending || retoLocked || repasoEmpty}
                        aria-expanded={optionsOpen(kind) ? isExpanded : undefined}
                        onClick={() => {
                          if (optionsOpen(kind)) {
                            setExpandedKind((prev) => (prev === kind ? null : kind))
                            setPendingStart(null)
                            startMutation.reset()
                          } else {
                            startMutation.mutate({ kind })
                          }
                        }}
                      >
                        <span className="ruled-row-main">
                          <span className="font-semibold">{config.labelEs}</span>
                          <span className="ruled-row-note">
                            {kind === 'reto' ? RETO_COPY : config.taglineEs}
                          </span>
                          <span className="inline-flex flex-wrap items-center gap-x-3 text-xs text-[var(--text-tertiary)]">
                            {repasoEmpty ? null : (
                              <span>
                                {config.simulacroSessions != null
                                  ? `${questionCount} preguntas en 2 sesiones`
                                  : `${questionCount} preguntas`}
                              </span>
                            )}
                            {config.timeLimitMs != null ? (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 size={12} aria-hidden /> {formatTimeLimit(config.timeLimitMs)}
                              </span>
                            ) : null}
                            {retoLocked ? <span>{RETO_LOCKED_COPY}</span> : null}
                            {repasoEmpty ? <span>{REPASO_EMPTY_COPY}</span> : null}
                          </span>
                        </span>
                        <span className="shrink-0 text-[var(--text-tertiary)]" aria-hidden>
                          {optionsOpen(kind)
                            ? <ChevronRight size={18} className={isExpanded ? 'rotate-90' : undefined} />
                            : isStarting ? '…' : <Play size={16} />}
                        </span>
                      </button>

                      {pending != null ? (
                        <TimedSessionIntro
                          title={pending.title}
                          subjectColor={pending.subjectColor}
                          strategySubjectIds={
                            pending.kind !== 'simulacro'
                              ? undefined
                              : pending.subjectId != null
                                ? [pending.subjectId]
                                : (config.simulacroSessions
                                    ?.find((sitting) => sitting.sessionNumber === pending.simulacroSessionNumber)
                                    ?.subjectTargets.map((target) => target.subjectId) ?? [])
                          }
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
                          <div className={PICKER} role="group" aria-label="Elige una sesión del simulacro">
                            <span className={PICKER_LABEL}>Examen completo</span>
                            {/* A full Sesión 1 ends at the break screen and leads into
                                Sesión 2, so it already is the whole exam day. */}
                            {config.simulacroSessions.map((simulacroSession) => (
                              <button
                                key={simulacroSession.sessionNumber}
                                type="button"
                                className="btn-secondary"
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
                          <div className={PICKER} role="group" aria-label="Elige un área para el simulacro">
                            <span className={PICKER_LABEL}>Por área</span>
                            {getSimulacroSubjectTargets().map((target) => {
                              const theme = getSubjectTheme(target.subjectId)
                              const areaTarget = getSimulacroSubjectTarget(target.subjectId)
                              return (
                                <button
                                  key={target.subjectId}
                                  type="button"
                                  className="btn-secondary"
                                  disabled={startMutation.isPending}
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
                                  <span aria-hidden="true" className="subject-dot" style={{ '--subject-color': theme.color } as CSSProperties} /> {theme.label} ·{' '}
                                  {target.questionCount} preguntas ·{' '}
                                  {formatTimeLimit(areaTarget?.timeLimitMs ?? null)}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      ) : null}

                      {config.requiresSubject && isExpanded && pending == null ? (
                        <div className={PICKER} role="group" aria-label="Elige una asignatura">
                          {SUBJECT_IDS.map((subjectId) => (
                            <button
                              key={subjectId}
                              type="button"
                              className="btn-secondary"
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
                              <span
                                aria-hidden="true"
                                className="subject-dot"
                                style={{ '--subject-color': getSubjectTheme(subjectId).color } as CSSProperties}
                              />
                              {getSubjectLabel(subjectId)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>

                    {/* The builder sits beside the other topic-scoped practice. */}
                    {kind === 'topic' ? (
                      <li>
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
                      </li>
                    ) : null}
                  </Fragment>
                )
              })}
            </ul>

            {startMutation.error && pendingStart == null && startMutation.variables?.kind !== 'personalizada' ? (
              <p className="notice is-danger" role="alert">
                {readConvexError(startMutation.error, 'No se pudo iniciar la sesión.')}
              </p>
            ) : null}
          </section>

          {/* The full list lives in Historial; the hub only launches (F33). */}
          <p className="mt-6 text-sm">
            <Link to="/history">Ver todas tus sesiones en el historial</Link>
          </p>
        </div>
      </div>
    </StudentAppShell>
  )
}

/** A launch line: a `.ruled-row` that is a button. */
const ROW_BUTTON =
  'ruled-row w-full cursor-pointer border-x-0 border-t-0 bg-transparent text-left font-[inherit] text-[length:inherit] hover:bg-[var(--bg-inset)] disabled:cursor-default disabled:[&_.font-semibold]:text-[var(--text-tertiary)]'
const PICKER = 'flex flex-wrap items-center gap-2 border-b border-[var(--border)] py-3'
const PICKER_LABEL = 'w-full text-xs text-[var(--text-tertiary)]'
