import { useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Play } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KIND_CONFIG } from '@aprendo/convex/sessionKinds'
import { MarkdownBlock } from './MarkdownBlock.tsx'
import { DailyPlan } from './DailyPlan.tsx'
import { TeacherAssignments } from './TeacherAssignments.tsx'
import { CareerCard } from './CareerPicker.tsx'
import { ExamCountdown } from './ExamCountdown.tsx'
import {
  activeSessionQuery,
  coachSummaryQuery,
  mySchoolsQuery,
  studentProgressQuery,
  todayDashboardQuery,
} from '../lib/student-queries.ts'
import { readConvexError } from '../lib/convex-error.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { focusSubjectId } from '../lib/progress-display.ts'
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
  const schools = useQuery(mySchoolsQuery)

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

  const focusId = focusSubjectId(dashboard.data?.plan.nextSubtopics ?? [], progress.data?.subjectAggregates ?? [])
  const weakestSubject = progress.data?.subjectAggregates.find((aggregate) => aggregate.subjectId === focusId) ?? null

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

  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="ruled-page fade-in">
      {/* The margin column: the date and the week's study days, where a
          student writes them at the top of a notebook page. */}
      <aside className="ruled-page-margin" aria-label="Tu semana">
        <p className="ruled-page-date">{today}</p>
        <dl className="margin-facts">
          {dashboard.data != null ? (
            // One weekly goal, in minutes: effort, not attendance (F33).
            <div>
              <dt>Esta semana</dt>
              <dd>
                {dashboard.data.studyTime.minutesThisWeek} de {dashboard.data.studyTime.goalMinutes} min
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Días seguidos</dt>
            <dd>{streakDays}</dd>
          </div>
        </dl>
        {schools.data != null && schools.data.length === 0 ? (
          <Link to="/join" className="margin-link">
            Unirme a mi curso
          </Link>
        ) : null}
      </aside>

      <div className="ruled-page-body">
        <header className="ruled-page-head">
          <h1 className="page-title">{greeting()}</h1>
          <p className="page-lede">Esto es lo que te toca hoy para tu Saber 11.</p>
        </header>

        {dashboard.data != null ? (
          <>
            <TeacherAssignments studentId={studentId} />
            <DailyPlan studentId={studentId} tasks={dashboard.data.plan.tasks} />
            <CareerCard studentId={studentId} mode="invite" />
            <ExamCountdown
              studentId={studentId}
              examDate={dashboard.data.examDate}
              plan={dashboard.data.examPlan}
            />
          </>
        ) : dashboard.isError ? (
          // The plan needs this query; without it Hoy still offers a way in.
          <div role="alert" className="ruled-section">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              No pudimos armar tu plan de hoy
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {readConvexError(dashboard.error, 'Intenta recargar la página en un momento.')}
            </p>
            <Link to="/practice" className="btn-primary mt-4 no-underline">
              <Play size={16} />
              Elegir una práctica
            </Link>
          </div>
        ) : null}

        <section className="ruled-section" aria-labelledby="today-week-title">
          <h2 id="today-week-title" className="section-title">Tu foco</h2>
          <ul className="ruled-list">
            <li>
              {weakestSubject != null && weakestTheme != null ? (
                <Link to="/path" className="ruled-row no-underline">
                  <span className="ruled-row-label">Foco</span>
                  <span className="ruled-row-main">
                    <span className="flex items-center gap-2 font-semibold">
                      <span
                        aria-hidden
                        className="subject-dot"
                        style={{ '--subject-color': weakestTheme.color } as CSSProperties}
                      />
                      {weakestTheme.label}
                    </span>
                    <span className="ruled-row-note">{weakestSubjectHint}</span>
                  </span>
                  <ArrowRight size={16} aria-hidden className="shrink-0 text-[var(--text-tertiary)]" />
                </Link>
              ) : (
                <p className="ruled-row">
                  <span className="ruled-row-label">Foco</span>
                  <span className="ruled-row-note">Haz tu primera práctica para descubrir tu foco.</span>
                </p>
              )}
            </li>
            <li>
              {activeSession != null ? (
                <Link
                  to="/practice/$sessionId"
                  params={{ sessionId: activeSession._id }}
                  className="ruled-row no-underline"
                >
                  <span className="ruled-row-label">En curso</span>
                  <span className="ruled-row-main">
                    <span className="font-semibold">{SESSION_KIND_CONFIG[activeSession.kind].labelEs}</span>
                    <span className="ruled-row-note">{activeSession.questionCount} preguntas · continúa donde quedaste</span>
                  </span>
                  <ArrowRight size={16} aria-hidden className="shrink-0 text-[var(--text-tertiary)]" />
                </Link>
              ) : (
                <p className="ruled-row">
                  <span className="ruled-row-label">En curso</span>
                  <span className="ruled-row-note">No tienes sesiones abiertas.</span>
                </p>
              )}
            </li>
          </ul>
        </section>

        {coachSummary.data?.status === 'ready' && coachSummary.data.body ? (
          <section className="ruled-section" aria-labelledby="today-coach-title">
            <h2 id="today-coach-title" className="section-title">Tu semana, en resumen</h2>
            <MarkdownBlock markdown={coachSummary.data.body} />
          </section>
        ) : coachSummary.data?.status === 'generating' ? (
          <section className="ruled-section" aria-labelledby="today-coach-title">
            <h2 id="today-coach-title" className="section-title">Tu semana, en resumen</h2>
            <p className="text-sm text-[var(--text-tertiary)]">Preparando tu resumen…</p>
          </section>
        ) : null}
      </div>
    </div>
  )
}
