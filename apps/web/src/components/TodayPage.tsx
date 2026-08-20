import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Flame, Play, RotateCcw, Sparkles, Target, TrendingUp } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import MarkdownBlock from './MarkdownBlock.tsx'
import { ExamCountdown } from './ExamCountdown.tsx'
import { RingProgress } from './RingProgress.tsx'
import {
  activeSessionQuery,
  coachSummaryQuery,
  reviewQueueQuery,
  studentProgressQuery,
  todayDashboardQuery,
} from '../lib/student-queries.ts'
import { getKindIcon } from '../lib/session-display.ts'
import { formatMasteryPercent, getSyllabusStatus } from '../lib/syllabus-status.ts'
import { getSubjectLabel } from '../lib/taxonomy.ts'
import { PageLoader } from '../components/FullScreenLoader.tsx'
import { readConvexError } from '../lib/convex-error.ts'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const RECOMMENDED_COUNT = getConfiguredQuestionCount(SESSION_KIND_CONFIG.recommended)

export function TodayPage({ studentId }: { studentId: string }) {
  const navigate = useNavigate()
  const dashboard = useQuery({ ...todayDashboardQuery(studentId), enabled: true })
  const progress = useQuery({ ...studentProgressQuery(studentId), enabled: true })
  const active = useQuery({ ...activeSessionQuery(studentId), enabled: true })
  const reviewQueue = useQuery({ ...reviewQueueQuery(studentId), enabled: true })
  const coachSummary = useQuery({ ...coachSummaryQuery(studentId), enabled: true })

  const createSession = useConvexMutation(api.sessions.createSession)
  const startMutation = useMutation({
    mutationFn: async (kind: 'recommended' | 'repaso') =>
      createSession({ studentId: studentId as never, kind }),
    onSuccess: async (sessionId) => {
      await navigate({ to: '/practice/$sessionId', params: { sessionId } })
    },
  })

  // Generate this week's coach summary once, only if the student studied this week.
  const requestSummary = useConvexMutation(api.coach.requestWeeklyCoachSummary)
  const requestedSummaryRef = useRef(false)
  const weeklyActiveDays = dashboard.data?.activeDaysThisWeek ?? 0
  useEffect(() => {
    if (weeklyActiveDays > 0 && coachSummary.data === null && !requestedSummaryRef.current) {
      requestedSummaryRef.current = true
      void requestSummary({ studentId: studentId as never })
    }
  }, [weeklyActiveDays, coachSummary.data, requestSummary, studentId])

  if (dashboard.isPending || progress.isPending) {
    return (
      <PageLoader message="Preparando tu día…" />
    )
  }

  const streakDays = dashboard.data?.streakDays ?? 0
  const activeDaysThisWeek = dashboard.data?.activeDaysThisWeek ?? 0
  const weeklyGoal = dashboard.data?.weeklyGoal ?? 5

  const subjectAggregates = [...(progress.data?.subjectAggregates ?? [])].sort(
    (a, b) => a.masteryScore - b.masteryScore,
  )
  const weakestSubject = subjectAggregates[0] ?? null

  // Frame the weekly focus in ICFES-level language when there is enough
  // evidence to name a level; fall back to the generic nudge otherwise.
  const weakestSubjectLevel =
    weakestSubject == null
      ? null
      : (progress.data?.subjectLevels ?? []).find(
          (level) => level.subjectId === weakestSubject.subjectId,
        ) ?? null
  const weakestSubjectHint =
    weakestSubjectLevel?.current?.nextBand != null
    && weakestSubjectLevel.current.pointsToNextBand != null
      ? `Te faltan ${weakestSubjectLevel.current.pointsToNextBand} puntos para ${weakestSubjectLevel.current.nextBand.labelEs}`
      : 'Sigue tu ruta en esta área'
  const activeSession = active.data ?? null
  const reviewDueCount = reviewQueue.data?.dueCount ?? 0

  return (
    <div className="fade-in mx-auto max-w-4xl space-y-5">
      {/* Greeting + streak */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between">
        <div className="flex flex-col justify-center">
          <p className="kicker mb-1">Hoy</p>
          <h1 className="font-display text-3xl italic tracking-tight text-[var(--text-primary)] sm:text-4xl">
            {greeting()} 👋
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Un paso más cerca de tu Saber 11.
          </p>
        </div>
        <div className="card flex items-center gap-4 px-5 py-4 sm:min-w-[15rem]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Flame size={22} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Racha: {streakDays} {streakDays === 1 ? 'día' : 'días'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              Esta semana: {activeDaysThisWeek}/{weeklyGoal} días
            </p>
          </div>
        </div>
      </div>

      <ExamCountdown
        studentId={studentId}
        examDate={dashboard.data?.examDate ?? null}
        plan={dashboard.data?.examPlan ?? null}
      />

      {/* Plan de hoy */}
      <div className="card relative overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--accent-soft),transparent_60%)]" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <p className="kicker">Tu plan de hoy</p>
            <span className="text-xs font-medium text-[var(--text-tertiary)]">~15 min</span>
          </div>

          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--text-inverted)]">
              <Sparkles size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-[var(--text-primary)]">
                Práctica recomendada
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {RECOMMENDED_COUNT} preguntas enfocadas en tus áreas más débiles.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate('recommended')}
              className="btn-primary"
            >
              <Play size={16} />
              {startMutation.isPending && startMutation.variables === 'recommended'
                ? 'Preparando…'
                : 'Empezar sesión de hoy'}
            </button>
            <Link to="/syllabus" className="btn-ghost text-sm no-underline">
              Explorar el temario
            </Link>
          </div>

          {startMutation.error ? (
            <p className="mt-3 text-sm text-[var(--accent-text)]">
              {readConvexError(startMutation.error, 'No se pudo iniciar la práctica.')}
            </p>
          ) : null}
        </div>
      </div>

      {/* Repaso de errores (spaced review) */}
      {reviewDueCount > 0 ? (
        <div className="card flex items-center gap-3.5 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <RotateCcw size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Repaso de errores</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {reviewDueCount} {reviewDueCount === 1 ? 'pregunta' : 'preguntas'} que fallaste, list
              {reviewDueCount === 1 ? 'a' : 'as'} para reforzar.
            </p>
          </div>
          <button
            type="button"
            disabled={startMutation.isPending}
            onClick={() => startMutation.mutate('repaso')}
            className="btn-ghost shrink-0 text-sm"
          >
            {startMutation.isPending && startMutation.variables === 'repaso'
              ? 'Preparando…'
              : 'Repasar'}
          </button>
        </div>
      ) : null}

      {/* Foco + continuar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target size={15} className="text-[var(--text-tertiary)]" />
            <p className="kicker">Foco de la semana</p>
          </div>
          {weakestSubject != null ? (
            <Link
              to="/path"
              className="flex items-center gap-3.5 no-underline"
            >
              <div className="relative shrink-0">
                <RingProgress
                  value={weakestSubject.masteryScore}
                  size={44}
                  strokeWidth={6}
                  color={
                    getSyllabusStatus({
                      questionCount: 1,
                      attemptCount: weakestSubject.attemptCount,
                      mastery: weakestSubject.masteryScore,
                    }).color
                  }
                />
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-[var(--text-primary)]">
                  {formatMasteryPercent(weakestSubject.masteryScore)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {getSubjectLabel(weakestSubject.subjectId)}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">{weakestSubjectHint}</p>
              </div>
              <ArrowRight size={16} className="shrink-0 text-[var(--text-tertiary)]" />
            </Link>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">
              Haz tu primera práctica para descubrir tu foco.
            </p>
          )}
        </div>

        <div className="card p-5">
          <p className="kicker mb-3">Continúa donde quedaste</p>
          {activeSession != null ? (
            <Link
              to="/practice/$sessionId"
              params={{ sessionId: activeSession._id }}
              className="flex items-center gap-3.5 no-underline"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-inset)] text-[var(--text-secondary)]">
                {(() => {
                  const Icon = getKindIcon(activeSession.kind)
                  return <Icon size={16} />
                })()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {SESSION_KIND_CONFIG[activeSession.kind].labelEs}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {activeSession.questionCount} preguntas · en curso
                </p>
              </div>
              <ArrowRight size={16} className="shrink-0 text-[var(--text-tertiary)]" />
            </Link>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">
              No tienes sesiones en curso. ¡Empieza una arriba!
            </p>
          )}
        </div>
      </div>

      {/* Weekly coach summary */}
      {coachSummary.data?.status === 'ready' && coachSummary.data.body ? (
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-[var(--accent)]" />
            <p className="kicker">Tu semana</p>
          </div>
          <MarkdownBlock markdown={coachSummary.data.body} />
        </div>
      ) : coachSummary.data?.status === 'generating' ? (
        <div className="card p-6">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp size={16} className="text-[var(--text-tertiary)]" />
            <p className="kicker">Tu semana</p>
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">Preparando tu resumen…</p>
        </div>
      ) : null}
    </div>
  )
}
