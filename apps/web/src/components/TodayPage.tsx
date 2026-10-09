import { useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Flame, Play, Target, TrendingUp } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KIND_CONFIG } from '@aprendo/convex/sessionKinds'
import MarkdownBlock from './MarkdownBlock.tsx'
import { DailyPlan } from './DailyPlan.tsx'
import { ExamCountdown, TargetGap } from './ExamCountdown.tsx'
import { StudyTimeCard } from './StudyTimeCard.tsx'
import {
  activeSessionQuery,
  coachSummaryQuery,
  studentProgressQuery,
  todayDashboardQuery,
} from '../lib/student-queries.ts'
import { readConvexError } from '../lib/convex-error.ts'
import { getKindIcon } from '../lib/session-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { PageLoader } from '../components/FullScreenLoader.tsx'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function TodayPage({ studentId }: { studentId: string }) {
  const dashboard = useQuery({ ...todayDashboardQuery(studentId), enabled: true })
  const progress = useQuery({ ...studentProgressQuery(studentId), enabled: true })
  const active = useQuery({ ...activeSessionQuery(studentId), enabled: true })
  const coachSummary = useQuery({ ...coachSummaryQuery(studentId), enabled: true })

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
  const weakestTheme = weakestSubject == null ? null : getSubjectTheme(weakestSubject.subjectId)

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

      {dashboard.data != null ? (
        <>
          <DailyPlan studentId={studentId} tasks={dashboard.data.plan.tasks} />
          <ExamCountdown
            studentId={studentId}
            examDate={dashboard.data.examDate}
            plan={dashboard.data.examPlan}
          />
          <TargetGap
            data={dashboard.data.globalScore}
            daysRemaining={dashboard.data.examPlan?.daysRemaining ?? null}
          />
          <StudyTimeCard studentId={studentId} studyTime={dashboard.data.studyTime} />
        </>
      ) : dashboard.isError ? (
        // The plan needs this query; without it Hoy still offers a way in.
        <div role="alert" className="card p-5">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            No pudimos armar tu plan de hoy
          </p>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            {readConvexError(dashboard.error, 'Intenta recargar la página en un momento.')}
          </p>
          <Link to="/practice" className="btn-primary mt-4 w-full justify-center no-underline sm:w-auto">
            <Play size={16} />
            Elegir una práctica
          </Link>
        </div>
      ) : null}

      {/* Foco + continuar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target size={15} className="text-[var(--text-tertiary)]" />
            <p className="kicker">Foco de la semana</p>
          </div>
          {weakestSubject != null && weakestTheme != null ? (
            <Link
              to="/path"
              className="flex items-center gap-3.5 no-underline"
            >
              <span
                aria-hidden
                className="subject-dot subject-dot-lg"
                style={{ '--subject-color': weakestTheme.color } as CSSProperties}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {weakestTheme.label}
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
              No tienes sesiones en curso. Empieza tu plan de hoy.
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
