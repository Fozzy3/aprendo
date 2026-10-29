import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { MASTERY_LEVEL_LABELS, type MasteryLevel } from '@aprendo/convex/mastery'
import { getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { progressTrendsQuery, studentProgressQuery, todayDashboardQuery } from '../lib/student-queries.ts'
import { areaChartRow, changeSincePlacement } from '../lib/progress-display.ts'
import { readConvexError } from '../lib/convex-error.ts'
import { AreaLevelsChart } from './AreaLevelsChart.tsx'
import { GlobalScoreCard } from './GlobalScoreCard.tsx'
import { CareerCard } from './CareerPicker.tsx'
import { TargetGap } from './ExamCountdown.tsx'
import { StudyTimeCard } from './StudyTimeCard.tsx'
import { PageLoader } from '../components/FullScreenLoader.tsx'
import { EmptyState } from './EmptyState.tsx'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

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

/**
 * Progreso answers three questions and nothing else: where am I (the global
 * score and every area on one scale), am I moving (week by week) and what do I
 * do now (three topics). The topic-by-topic detail lives in the Temario and
 * the session-by-session detail in the Historial.
 */
export function StudentProgressPage({ studentId }: { studentId: string }) {
  const progressQuery = useQuery({ ...studentProgressQuery(studentId), enabled: true })
  const trendsQuery = useQuery({ ...progressTrendsQuery(studentId), enabled: true })
  const todayQuery = useQuery({ ...todayDashboardQuery(studentId), enabled: true })
  const nextSubtopics = todayQuery.data?.plan.nextSubtopics ?? []

  if (progressQuery.isPending || trendsQuery.isPending) {
    return <PageLoader message="Preparando tu resumen…" />
  }

  const progress = progressQuery.data
  const trends = trendsQuery.data
  const overallSummary = progress?.snapshot?.overallSummary
  const weekly = trends?.weekly ?? []

  if (progress == null || overallSummary == null) {
    return (
      <div className="page-sheet fade-in">
        <header className="ruled-page-head">
          <h1 className="page-title">Tu progreso</h1>
        </header>
        <EmptyState
          title="Todavía no puedo medir nada"
          action={
            <Link to="/diagnostic" className="btn-primary no-underline">
              Nivelar un área
            </Link>
          }
        >
          Nivélate en un área y desde ahí empiezo a seguir cuánto avanzas.
        </EmptyState>
      </div>
    )
  }

  const overallDelta = changeSincePlacement(progress.subjectLevels)
  const firstWeek = weekly[0] ?? null
  const lastWeek = weekly.at(-1) ?? null
  const trendDelta = firstWeek != null && lastWeek != null && weekly.length >= 2 ? lastWeek.accuracy - firstWeek.accuracy : null
  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="ruled-page fade-in">
      <aside className="ruled-page-margin" aria-label="Tu actividad">
        <p className="ruled-page-date">{today}</p>
        <dl className="margin-facts">
          <div>
            <dt>Precisión general</dt>
            <dd>{formatPercent(overallSummary.accuracy)}</dd>
          </div>
          <div>
            <dt>Preguntas respondidas</dt>
            <dd>{trends?.totalAttempts ?? 0}</dd>
          </div>
          <div>
            <dt>Días de estudio</dt>
            <dd>{trends?.activeDays ?? 0}</dd>
          </div>
        </dl>
      </aside>

      <div className="ruled-page-body">
        <header className="ruled-page-head">
          <h1 className="page-title">Tu progreso</h1>
          <p className="page-lede">
            {overallDelta == null ? (
              'Practica un poco más para comparar contra tu nivelación.'
            ) : (
              <>
                Desde tu nivelación: <Delta delta={overallDelta} /> en promedio por área.
              </>
            )}
          </p>
        </header>

        <GlobalScoreCard studentId={studentId} data={progress.globalScore} />
        <CareerCard studentId={studentId} mode="summary" career={progress.globalScore.career} />
        {/* Moved here from Hoy (F33): Hoy keeps one action; the numbers live with the progress. */}
        {todayQuery.data != null ? (
          <>
            <TargetGap
              data={todayQuery.data.globalScore}
              daysRemaining={todayQuery.data.examPlan?.daysRemaining ?? null}
            />
            <StudyTimeCard studentId={studentId} studyTime={todayQuery.data.studyTime} />
          </>
        ) : null}

        <section className="ruled-section" aria-labelledby="progress-areas-title">
          <div className="section-head">
            <h2 id="progress-areas-title" className="section-title">Tus áreas</h2>
            <Link to="/syllabus" className="section-meta">
              Ver el temario
            </Link>
          </div>
          <AreaLevelsChart
            rows={progress.subjectLevels.map(areaChartRow)}
            emptyAction={() => (
              <Link to="/diagnostic" className="area-chart-action">
                Nivelarme
              </Link>
            )}
          />
        </section>

        <section className="ruled-section" aria-labelledby="progress-trend-title">
          <div className="section-head">
            <h2 id="progress-trend-title" className="section-title">Semana a semana</h2>
            {trendDelta != null ? (
              <span className="section-meta">
                <Delta delta={trendDelta} />
              </span>
            ) : null}
          </div>
          {weekly.length >= 2 ? (
            <>
              <TrendChart points={weekly} />
              <div className="mt-1 flex justify-between text-xs text-[var(--text-tertiary)]">
                <span>{firstWeek != null ? formatWeekLabel(firstWeek.weekStartMs) : ''}</span>
                <span>Precisión por semana</span>
                <span>{lastWeek != null ? formatWeekLabel(lastWeek.weekStartMs) : ''}</span>
              </div>
            </>
          ) : (
            <p className="m-0 text-sm text-[var(--text-tertiary)]">
              Practica en al menos dos semanas distintas para ver tu tendencia.
            </p>
          )}
        </section>

        {nextSubtopics.length > 0 ? (
          <section className="ruled-section" aria-labelledby="progress-next-title">
            <h2 id="progress-next-title" className="section-title">Practica esto ahora</h2>
            {/* The plan's picks (studyPlan.nextSubtopics): the same answer Hoy and Ruta give. */}
            <ol className="plan-lines">
              {nextSubtopics.map((item, index) => (
                <PracticeNowLine
                  key={item.subtopicId}
                  number={index + 1}
                  studentId={studentId}
                  subjectId={item.subjectId}
                  subtopicId={item.subtopicId}
                  level={item.level}
                />
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  )
}

/** One weak topic: what it is, the evidence, and a way straight into practice. */
function PracticeNowLine({
  number,
  studentId,
  subjectId,
  subtopicId,
  level,
}: {
  number: number
  studentId: string
  subjectId: string
  subtopicId: string
  level: MasteryLevel
}) {
  const navigate = useNavigate()
  const createSession = useMutation({
    mutationFn: useConvexMutation(api.sessions.createSession),
    onSuccess: (sessionId: string) => {
      void navigate({ to: '/practice/$sessionId', params: { sessionId } })
    },
  })

  return (
    <li className={`plan-line path-line${number === 1 ? ' is-first' : ''}`}>
      <span className="plan-line-number" aria-hidden>
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5 py-3">
        <Link to="/lesson/$subtopicId" params={{ subtopicId }} className="plan-line-title text-[var(--text-primary)]">
          {getSubtopicLabel(subtopicId)}
        </Link>
        <span className="plan-line-reason">
          {getSubjectLabel(subjectId)} · {MASTERY_LEVEL_LABELS[level]}
        </span>
        {createSession.error ? (
          <p role="alert" className="notice is-danger">
            {readConvexError(createSession.error, 'No se pudo iniciar la práctica.')}
          </p>
        ) : null}
      </div>
      <span className="path-line-actions is-single">
        <button
          type="button"
          disabled={createSession.isPending}
          onClick={() => createSession.mutate({ studentId: studentId as never, kind: 'topic', subtopicId })}
          className={`${number === 1 ? 'btn-primary' : 'btn-secondary'} text-xs`}
        >
          <Play size={13} aria-hidden />
          {createSession.isPending ? 'Preparando…' : 'Practicar'}
        </button>
      </span>
    </li>
  )
}
