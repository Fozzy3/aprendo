import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Outlet, createFileRoute, useChildMatches, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Play, RotateCcw, Timer, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
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
import { LeagueStrip } from '../components/LeagueStrip.tsx'
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
import { getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
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

const HUB_ORDER: SessionKind[] = ['repaso', 'reto', 'simulacro']
const HUB_KINDS = HUB_ORDER.filter((kind) => LAUNCHABLE_SESSION_KINDS.includes(kind))

const TILES: Partial<Record<SessionKind, { name: string; icon: LucideIcon }>> = {
  repaso: { name: 'Repaso', icon: RotateCcw },
  reto: { name: 'Reto', icon: Zap },
  simulacro: { name: 'Simulacro', icon: Timer },
}

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
    if (!appStateQuery.data.hasPlacement && !appStateQuery.data.isStaff) {
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

  const retoLocked = progressQuery.data?.retoReady === false
  const repasoDue = reviewQueue.data?.dueCount ?? null
  // One primary action: the first challenge the student can actually take.
  const primaryKind: SessionKind = repasoDue != null && repasoDue > 0 ? 'repaso' : retoLocked ? 'simulacro' : 'reto'

  return (
    <StudentAppShell session={session} activeSection="practice">
      <div className="retos fade-in">
        <h1 className="page-title">Retos</h1>

        <LeagueStrip studentId={session.studentId} />

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

        <section aria-label="Empezar un reto">
          <ul className="retos-list">
            {HUB_KINDS.map((kind) => {
              const tile = TILES[kind]
              if (tile == null) return null
              const Icon = tile.icon
              const config = SESSION_KIND_CONFIG[kind]
              const isExpanded = expandedKind === kind
              const isStarting = startMutation.isPending && startMutation.variables?.kind === kind
              const pending = isExpanded && pendingStart?.kind === kind ? pendingStart : null
              const isLocked = (kind === 'reto' && retoLocked) || (kind === 'repaso' && repasoDue === 0)
              const opensPicker = config.simulacroSessions != null

              return (
                <li key={kind}>
                  <button
                    type="button"
                    className={`reto-tile${primaryKind === kind ? ' is-primary' : ''}`}
                    disabled={startMutation.isPending || isLocked}
                    aria-expanded={opensPicker ? isExpanded : undefined}
                    onClick={() => {
                      if (opensPicker) {
                        setExpandedKind((prev) => (prev === kind ? null : kind))
                        setPendingStart(null)
                        startMutation.reset()
                      } else {
                        startMutation.mutate({ kind })
                      }
                    }}
                  >
                    <span className="reto-tile-icon" aria-hidden>
                      <Icon size={22} strokeWidth={2.25} />
                    </span>
                    <span className="reto-tile-text">
                      <span className="reto-tile-name">{tile.name}</span>
                      <span className="reto-tile-note">{tileNote(kind, repasoDue, retoLocked)}</span>
                    </span>
                    <span className="reto-tile-end" aria-hidden>
                      {opensPicker
                        ? <ChevronRight size={20} className={isExpanded ? 'rotate-90' : undefined} />
                        : isStarting ? '…' : <Play size={18} />}
                    </span>
                  </button>

                  {pending != null ? (
                    <TimedSessionIntro
                      title={pending.title}
                      subjectColor={pending.subjectColor}
                      strategySubjectIds={
                        pending.subjectId != null
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
                </li>
              )
            })}

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
          </ul>

          {startMutation.error && pendingStart == null && startMutation.variables?.kind !== 'personalizada' ? (
            <p className="notice is-danger" role="alert">
              {readConvexError(startMutation.error, 'No se pudo iniciar la sesión.')}
            </p>
          ) : null}
        </section>
      </div>
    </StudentAppShell>
  )
}

/** The one line under each challenge: what it is, or why it is shut for now. */
function tileNote(kind: SessionKind, repasoDue: number | null, retoLocked: boolean): string {
  const config = SESSION_KIND_CONFIG[kind]
  if (kind === 'repaso') {
    if (repasoDue === 0) return 'Nada por repasar hoy.'
    const questions = repasoDue != null ? Math.min(repasoDue * 2, getConfiguredQuestionCount(config)) : getConfiguredQuestionCount(config)
    return `${questions} preguntas de lo que toca hoy.`
  }
  if (kind === 'reto') {
    return retoLocked ? 'Se abre cuando practiques 3 temas.' : `${getConfiguredQuestionCount(config)} preguntas. Sube o baja de nivel.`
  }
  return 'Como el examen real, con reloj.'
}

/** A launch line: a `.ruled-row` that is a button. */
const ROW_BUTTON =
  'ruled-row w-full cursor-pointer border-x-0 border-t-0 bg-transparent text-left font-[inherit] text-[length:inherit] hover:bg-[var(--bg-inset)] disabled:cursor-default disabled:[&_.font-semibold]:text-[var(--text-tertiary)]'
const PICKER = 'flex flex-wrap items-center gap-2 border-b border-[var(--border)] py-3'
const PICKER_LABEL = 'w-full text-xs text-[var(--text-tertiary)]'
