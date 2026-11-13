import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { MASTERY_LEVELS } from '@aprendo/convex/mastery'
import { activitySummaryQuery, progressTrendsQuery, studentProgressQuery, studentQuery, todayDashboardQuery } from '../lib/student-queries.ts'
import { areaChartRow, changeSincePlacement } from '../lib/progress-display.ts'
import type { ActiveStudentSession } from '../lib/student-session.ts'
import { useSignOut } from '../lib/use-sign-out.ts'
import { AreaLevelsChart } from './AreaLevelsChart.tsx'
import { GlobalScoreCard } from './GlobalScoreCard.tsx'
import { CareerCard } from './CareerPicker.tsx'
import { ExamCountdown, TargetGap } from './ExamCountdown.tsx'
import { StudyTimeCard } from './StudyTimeCard.tsx'
import { CALENDAR_WEEKS, StudyHistory } from './StudyHistory.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { PageLoader } from '../components/FullScreenLoader.tsx'
import { EmptyState } from './EmptyState.tsx'
import { AvatarPortrait } from './AvatarPortrait.tsx'
import { WeeklyCoach } from './WeeklyCoach.tsx'
import { YoRewards } from './YoRewards.tsx'

/** A signed point delta on the 0–100 scale (e.g. +12, -3, 0). */
function formatDeltaPoints(delta: number) {
  const points = Math.round(delta * 100)
  return `${points >= 0 ? '+' : ''}${points}`
}

function formatWeekLabel(weekStartMs: number) {
  return new Date(weekStartMs).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

type DeltaTone = 'up' | 'down' | 'flat'

function deltaTone(delta: number): DeltaTone {
  if (delta >= 0.02) return 'up'
  if (delta <= -0.02) return 'down'
  return 'flat'
}

const DELTA_INK: Record<DeltaTone, string> = {
  up: 'text-[var(--success-text)]',
  down: 'text-[var(--danger-text)]',
  flat: 'text-[var(--text-tertiary)]',
}

/** A change written in ink: green up, red down, pencil when it barely moved. */
function Delta({ delta }: { delta: number }) {
  const tone = deltaTone(delta)
  return (
    <span className={`font-semibold tabular-nums ${DELTA_INK[tone]}`}>
      {tone === 'flat' ? 'igual' : `${formatDeltaPoints(delta)} pts`}
    </span>
  )
}

/** Hand-rolled SVG line of accuracy per week (no chart library), in ink. */
function TrendChart({ points }: { points: Array<{ weekStartMs: number; accuracy: number }> }) {
  const width = 320
  const height = 120
  const padX = 8
  const padY = 12
  const count = points.length
  const xFor = (index: number) =>
    count <= 1 ? width / 2 : padX + (index * (width - 2 * padX)) / (count - 1)
  const yFor = (value: number) => padY + (1 - value) * (height - 2 * padY)

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${xFor(index)},${yFor(point.accuracy)}`)
    .join(' ')
  const midY = yFor(0.5)

  // preserveAspectRatio="none" lets the chart fill the column; vector-effect
  // keeps strokes an even thickness despite the non-uniform scale (so no dots —
  // circles would distort into ellipses).
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" preserveAspectRatio="none" role="img" aria-label="Precisión por semana">
      <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line x1={padX} y1={midY} x2={width - padX} y2={midY} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <path d={linePath} fill="none" stroke="var(--text-primary)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Stickers are earned at Competente and up (the Álbum's one rule). */
const STICKER_LEVELS: ReadonlySet<string> = new Set(MASTERY_LEVELS.slice(MASTERY_LEVELS.indexOf('competente')))

/**
 * Yo: the student's own page. Their score and levels first, then career, exam
 * date, study time, the calendar and every session (the old Historial), then
 * medals and avatar, and at the bottom the account, the theme and Salir.
 */
export function StudentProgressPage({ session }: { session: ActiveStudentSession }) {
  const { studentId } = session
  const progressQuery = useQuery({ ...studentProgressQuery(studentId), enabled: true })
  const trendsQuery = useQuery({ ...progressTrendsQuery(studentId), enabled: true })
  const todayQuery = useQuery({ ...todayDashboardQuery(studentId), enabled: true })
  const activity = useQuery(activitySummaryQuery(studentId, CALENDAR_WEEKS))
  const student = useQuery(studentQuery(studentId))
  const album = useQuery(convexQuery(api.today.getStickerAlbum, { studentId: studentId as never }))

  if (progressQuery.isPending || trendsQuery.isPending) {
    return <PageLoader message="Preparando tu resumen…" />
  }

  const progress = progressQuery.data
  const overallSummary = progress?.snapshot?.overallSummary
  const stickers = (progress?.subtopicMastery ?? []).filter((entry) => STICKER_LEVELS.has(entry.masteryLevel)).length
  const streak = activity.data?.stats.currentStreakDays ?? 0

  const cover = (
    <header className="yo-cover">
      <div className="yo-portrait" aria-hidden>
        <AvatarPortrait avatar={student.data?.avatar} />
      </div>
      <div className="min-w-0">
        <h1 className="yo-name">{session.name ?? 'Yo'}</h1>
        <p className="yo-count">
          {album.data != null
            ? `${album.data.earnedCount}/${album.data.total} temas en Competente+`
            : `${stickers} ${stickers === 1 ? 'tema' : 'temas'} en Competente+`}
          {streak > 0 ? ` · racha ${streak} ${streak === 1 ? 'día' : 'días'}` : ''}
        </p>
      </div>
    </header>
  )

  if (progress == null || overallSummary == null) {
    return (
      <div className="yo fade-in">
        {cover}
        <YoRewards studentId={studentId} student={student.data} medals={album.data?.medals ?? []} />
        <EmptyState
          title="Sin datos aún"
          action={
            <Link to="/diagnostic" className="btn-primary no-underline">
              Hacer el diagnóstico
            </Link>
          }
        />
        <YoSettings studentId={studentId} />
      </div>
    )
  }

  const trends = trendsQuery.data
  const weekly = trends?.weekly ?? []
  const overallDelta = changeSincePlacement(progress.subjectLevels)
  const firstWeek = weekly[0] ?? null
  const lastWeek = weekly.at(-1) ?? null
  const trendDelta = firstWeek != null && lastWeek != null && weekly.length >= 2 ? lastWeek.accuracy - firstWeek.accuracy : null

  // On a phone both wrappers dissolve (`display: contents`) and the page reads
  // top to bottom as before; on a wide screen the cover, rewards and settings
  // become a column beside the charts.
  return (
    <div className="yo is-split fade-in">
      {cover}

      <div className="yo-main">
        <GlobalScoreCard studentId={studentId} data={progress.globalScore} />

        <section className="ruled-section" aria-labelledby="progress-areas-title">
          <div className="section-head">
            <h2 id="progress-areas-title" className="section-title">Tus áreas</h2>
            {overallDelta != null ? (
              <span className="section-meta">
                Desde el inicio: <Delta delta={overallDelta} />
              </span>
            ) : null}
          </div>
          <AreaLevelsChart
            rows={progress.subjectLevels.map(areaChartRow)}
            // Yo is only reachable after the diagnostic: an area without a level needs practice, not another diagnostic.
            emptyAction={() => (
              <Link to="/path" className="area-chart-action">
                Practicar
              </Link>
            )}
          />
        </section>

        <CareerCard studentId={studentId} mode="summary" career={progress.globalScore.career} />

        {todayQuery.data != null ? (
          <>
            <ExamCountdown studentId={studentId} examDate={todayQuery.data.examDate} plan={todayQuery.data.examPlan} />
            <TargetGap
              data={todayQuery.data.globalScore}
              daysRemaining={todayQuery.data.examPlan?.daysRemaining ?? null}
            />
            <StudyTimeCard studentId={studentId} studyTime={todayQuery.data.studyTime} />
          </>
        ) : null}

        {weekly.length >= 2 ? (
          <details className="yo-more">
            <summary>
              Semana a semana{' '}
              {trendDelta != null ? <Delta delta={trendDelta} /> : null}
            </summary>
            <TrendChart points={weekly} />
            <div className="mt-1 flex justify-between text-xs text-[var(--text-tertiary)]">
              <span>{firstWeek != null ? formatWeekLabel(firstWeek.weekStartMs) : ''}</span>
              <span>Precisión por semana</span>
              <span>{lastWeek != null ? formatWeekLabel(lastWeek.weekStartMs) : ''}</span>
            </div>
          </details>
        ) : null}

        {todayQuery.data != null ? <WeeklyCoach studentId={studentId} activeDaysThisWeek={todayQuery.data.activeDaysThisWeek} /> : null}

        <StudyHistory studentId={studentId} />
      </div>

      <div className="yo-side">
        <YoRewards studentId={studentId} student={student.data} medals={album.data?.medals ?? []} />
        <YoSettings studentId={studentId} />
      </div>
    </div>
  )
}

function YoSettings({ studentId }: { studentId: string }) {
  const { signOut, isSigningOut } = useSignOut()
  // Only once it is known unanswered: while loading, and after answering, no row.
  const survey = useQuery(convexQuery(api.pilotSurvey.getMine, { studentId: studentId as never }))
  return (
    <section className="ruled-section yo-settings" aria-labelledby="yo-settings-title">
      <h2 id="yo-settings-title" className="section-title">Ajustes</h2>
      <ul className="ruled-list">
        <li>
          <div className="ruled-row">
            <span className="ruled-row-main font-semibold">Tema</span>
            <ThemeToggle />
          </div>
        </li>
        <li>
          <Link to="/cuenta" className="ruled-row no-underline">
            <span className="ruled-row-main font-semibold">Cuenta</span>
            <ChevronRight size={18} aria-hidden />
          </Link>
        </li>
        <li>
          <Link to="/diagnostic" className="ruled-row no-underline">
            <span className="ruled-row-main font-semibold">Repetir el diagnóstico</span>
            <ChevronRight size={18} aria-hidden />
          </Link>
        </li>
        {survey.data === null ? (
          <li>
            <Link to="/encuesta" className="ruled-row no-underline">
              <span className="ruled-row-main font-semibold">¿Qué te pareció Aprendo?</span>
              <ChevronRight size={18} aria-hidden />
            </Link>
          </li>
        ) : null}
      </ul>
      <button type="button" className="btn-secondary mt-4 w-full" disabled={isSigningOut} onClick={() => void signOut()}>
        {isSigningOut ? 'Saliendo…' : 'Salir'}
      </button>
    </section>
  )
}
