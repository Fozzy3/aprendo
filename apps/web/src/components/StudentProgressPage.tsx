import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { MASTERY_LEVEL_LABELS, type MasteryLevel } from '@aprendo/convex/mastery'
import { progressTrendsQuery, studentProgressQuery, syllabusQuery } from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { GlobalScoreCard } from './GlobalScoreCard.tsx'
import { MASTERY_LEVEL_COLOR, MasteryBadge } from './MasteryBadge.tsx'
import {
  countByLevel,
  countedSubtopics,
  levelFor,
  masteryLevelMap,
  subjectSubtopics,
} from '../lib/mastery-display.ts'
import { ConfidenceBreakdownCard } from './ConfidenceBreakdownCard.tsx'
import { getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '@aprendo/convex/api'
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
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Precisión por semana">
      <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="var(--border-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <line x1={padX} y1={midY} x2={width - padX} y2={midY} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <path d={linePath} fill="none" stroke="var(--text-primary)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function StudentProgressPage({ studentId }: { studentId: string }) {
  const progressQuery = useQuery({ ...studentProgressQuery(studentId), enabled: true })
  const trendsQuery = useQuery({ ...progressTrendsQuery(studentId), enabled: true })
  const syllabus = useQuery({ ...syllabusQuery(studentId), enabled: true })

  if (progressQuery.isPending || trendsQuery.isPending || syllabus.isPending) {
    return (
      <PageLoader message="Preparando tu resumen…" />
    )
  }

  const progress = progressQuery.data
  const trends = trendsQuery.data
  const snapshot = progress?.snapshot
  const overallSummary = snapshot?.overallSummary
  const baseline = snapshot?.diagnosticBaseline ?? null
  const subjectAggregates = progress?.subjectAggregates ?? []
  const subjectLevels = progress?.subjectLevels ?? []
  const weakestSubtopics = progress?.weakestSubtopics ?? []
  const subtopicMastery = progress?.subtopicMastery ?? []
  const levels = masteryLevelMap(subtopicMastery)
  const weekly = trends?.weekly ?? []

  if (overallSummary == null) {
    return (
      <div className="fade-in mx-auto w-[min(100%,64rem)]">
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

  const currentAccuracy = overallSummary.accuracy
  const baselineAccuracy = baseline?.accuracy ?? null
  const overallDelta = baselineAccuracy != null ? currentAccuracy - baselineAccuracy : null

  // "Antes y ahora" per subject: diagnostic accuracy → current accuracy.
  const baselineBySubject = new Map(
    (baseline?.subjectScores ?? []).map((score) => [score.subjectId, score]),
  )
  const subjectRows = subjectAggregates
    .map((agg) => {
      const base = baselineBySubject.get(agg.subjectId)
      const baselineSubjectAccuracy = base ? base.score / 100 : null
      const delta = baselineSubjectAccuracy != null ? agg.accuracy - baselineSubjectAccuracy : null
      return {
        id: agg._id,
        subjectId: agg.subjectId,
        label: getSubjectLabel(agg.subjectId),
        baselineAccuracy: baselineSubjectAccuracy,
        currentAccuracy: agg.accuracy,
        delta,
      }
    })
    .sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity))

  const mostImproved = subjectRows.find((row) => row.delta != null && row.delta > 0) ?? null
  const firstWeek = weekly[0] ?? null
  const lastWeek = weekly.at(-1) ?? null
  const trendDelta =
    firstWeek != null && lastWeek != null && weekly.length >= 2
      ? lastWeek.accuracy - firstWeek.accuracy
      : null

  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="ruled-page fade-in">
      <aside className="ruled-page-margin" aria-label="Tu actividad">
        <p className="ruled-page-date">{today}</p>
        <dl className="margin-facts">
          <div>
            <dt>Precisión general</dt>
            <dd>{formatPercent(currentAccuracy)}</dd>
          </div>
          <div>
            <dt>Preguntas respondidas</dt>
            <dd>{trends?.totalAttempts ?? 0}</dd>
          </div>
          <div>
            <dt>Días de estudio</dt>
            <dd>{trends?.activeDays ?? 0}</dd>
          </div>
          {mostImproved != null && mostImproved.delta != null ? (
            <div>
              <dt>Lo que más mejoró</dt>
              <dd>
                {mostImproved.label} <Delta delta={mostImproved.delta} />
              </dd>
            </div>
          ) : null}
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
                {overallDelta >= 0 ? 'Has subido ' : 'Has bajado '}
                <strong className="text-[var(--text-primary)]">
                  {formatDeltaPoints(Math.abs(overallDelta)).replace('+', '')} puntos
                </strong>{' '}
                de precisión desde tu nivelación.
              </>
            )}
          </p>
        </header>

        <section className="ruled-section" aria-labelledby="progress-trend-title">
          <div className="section-head">
            <h2 id="progress-trend-title" className="section-title">Tu precisión por semana</h2>
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
                <span>{lastWeek != null ? formatWeekLabel(lastWeek.weekStartMs) : ''}</span>
              </div>
            </>
          ) : (
            <p className="m-0 text-sm text-[var(--text-tertiary)]">
              Practica en al menos dos semanas distintas para ver tu tendencia.
            </p>
          )}
        </section>

        {progress?.globalScore != null ? (
          <GlobalScoreCard studentId={studentId} data={progress.globalScore} />
        ) : null}

        <section className="ruled-section" aria-labelledby="progress-levels-title">
          <div className="section-head">
            <h2 id="progress-levels-title" className="section-title">Tu nivel ICFES por área</h2>
            <Link to="/diagnostic" className="section-meta">
              Nivelar un área
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Área</th>
                  <th scope="col">Nivel actual</th>
                  <th scope="col">Al nivelarte</th>
                </tr>
              </thead>
              <tbody>
                {subjectLevels.map((level) => (
                  <SubjectLevelRow key={level.subjectId} level={level} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {syllabus.data != null ? <MasteryOverview subjects={syllabus.data.subjects} levels={levels} /> : null}

        {trends?.confidence != null ? (
          <ConfidenceBreakdownCard breakdown={trends.confidence} />
        ) : null}

        <section className="ruled-section" aria-labelledby="progress-before-title">
          <h2 id="progress-before-title" className="section-title">Antes y ahora, por área</h2>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Área</th>
                  <th scope="col" className="is-number">Al nivelarte</th>
                  <th scope="col" className="is-number">Ahora</th>
                  <th scope="col" className="is-number">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {subjectRows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="subject-dot"
                          style={{ '--subject-color': getSubjectTheme(row.subjectId).color } as CSSProperties}
                        />
                        {row.label}
                      </span>
                    </th>
                    <td className="is-number">
                      {row.baselineAccuracy != null ? formatPercent(row.baselineAccuracy) : '—'}
                    </td>
                    <td className="is-number font-semibold">{formatPercent(row.currentAccuracy)}</td>
                    <td className="is-number">
                      {row.delta != null ? (
                        <Delta delta={row.delta} />
                      ) : (
                        <span className="text-[var(--text-tertiary)]">sin nivelación</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {weakestSubtopics.length > 0 ? (
          <section className="ruled-section" aria-labelledby="progress-weak-title">
            <h2 id="progress-weak-title" className="section-title">Sigue mejorando aquí</h2>
            <ul className="ruled-list">
              {weakestSubtopics.slice(0, 5).map((agg) => (
                <li key={agg._id}>
                  <Link
                    to="/lesson/$subtopicId"
                    params={{ subtopicId: agg.subtopicId ?? 'sin_subtema' }}
                    className="ruled-row no-underline"
                  >
                    <span className="ruled-row-main">
                      <span className="truncate font-semibold">
                        {getSubtopicLabel(agg.subtopicId ?? 'sin_subtema')}
                      </span>
                      <span className="ruled-row-note">{getSubjectLabel(agg.subjectId)}</span>
                    </span>
                    <MasteryBadge level={levelFor(levels, agg.subtopicId ?? '')} />
                    <ArrowRight size={16} aria-hidden className="shrink-0 text-[var(--text-tertiary)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

/** Best level first, so the bar fills from the left as the student advances. */
const OVERVIEW_ORDER: MasteryLevel[] = ['dominado', 'competente', 'familiar', 'intentado', 'sin_empezar']

/**
 * How many subtopics of each area sit at each Khan level, linking to the
 * Temario — counted over the same subtopics the Temario counts.
 */
function MasteryOverview({
  subjects,
  levels,
}: {
  subjects: FunctionReturnType<typeof api.syllabus.getSyllabus>['subjects']
  levels: Map<string, MasteryLevel>
}) {
  return (
    <section className="ruled-section" aria-labelledby="progress-mastery-title">
      <div className="section-head">
        <h2 id="progress-mastery-title" className="section-title">Tu dominio por área</h2>
        <Link to="/syllabus" className="section-meta">
          Ver el temario
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Área</th>
              <th scope="col">Temas por nivel</th>
              <th scope="col" className="is-number">Competente o más</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => {
              const subjectId = subject.id
              const theme = getSubjectTheme(subjectId)
              const counted = countedSubtopics(subjectSubtopics(subject, levels))
              const total = counted.length
              const counts = countByLevel(
                counted.map((subtopic) => subtopic.level),
                total,
              )
              const competentOrAbove = counts.competente + counts.dominado
              const spread = OVERVIEW_ORDER.filter((level) => counts[level] > 0)
                .map((level) => `${counts[level]} ${MASTERY_LEVEL_LABELS[level]}`)
                .join(' · ')
              return (
                <tr key={subjectId}>
                  <th scope="row">
                    <Link to="/syllabus" className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
                      <span
                        aria-hidden
                        className="subject-dot"
                        style={{ '--subject-color': theme.color } as CSSProperties}
                      />
                      {theme.label}
                    </Link>
                  </th>
                  <td>
                    <span className="mastery-spread" role="img" aria-label={spread}>
                      {OVERVIEW_ORDER.filter((level) => level !== 'sin_empezar' && counts[level] > 0).map((level) => (
                        <span
                          key={level}
                          style={{ flexGrow: counts[level] / Math.max(total, 1), background: MASTERY_LEVEL_COLOR[level] }}
                        />
                      ))}
                    </span>
                    <span className="cell-note">{spread}</span>
                  </td>
                  <td className="is-number">
                    {competentOrAbove} de {total}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type SubjectLevelRowData = FunctionReturnType<typeof api.progress.getStudentProgress>['subjectLevels'][number]

/**
 * One area's ICFES performance level. Shows "sin nivel aún" rather than a number
 * when there isn't enough evidence — a level invented from three questions is
 * worse than no level, because the student will believe it.
 */
function SubjectLevelRow({ level }: { level: SubjectLevelRowData }) {
  const theme = getSubjectTheme(level.subjectId)
  const placement = level.current
  const levelledUp =
    placement != null && level.baseline != null && placement.index > level.baseline.index

  // Only rendered when the national contract actually records the figure —
  // see `docs/national-results.v1.json`, which is deliberately incomplete.
  const nationalLine =
    level.national == null || placement == null
      ? null
      : level.national.percentileAtOrBelow != null
        ? `Estás por encima del ${100 - level.national.percentileAtOrBelow}% del país en esta área.`
        : level.national.shareAtThisLevel != null
          ? `El ${level.national.shareAtThisLevel}% del país está en ${placement.band.labelEs} (ICFES ${level.national.year}).`
          : null

  return (
    <tr>
      <th scope="row">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="subject-dot" style={{ '--subject-color': theme.color } as CSSProperties} />
          {theme.label}
        </span>
      </th>
      {placement == null ? (
        <td>
          Sin nivel aún{' '}
          <Link to="/diagnostic" className="text-sm">
            Nivelarme
          </Link>
          <span className="cell-note">{level.attemptCount} preguntas respondidas</span>
        </td>
      ) : (
        <td className={placement.index === 1 ? 'is-low' : undefined}>
          <span className="font-semibold">{placement.band.labelEs}</span>
          <span className="text-[var(--text-tertiary)]">
            {' '}· {placement.index} de {placement.bandCount}
          </span>
          {levelledUp ? <span className="font-semibold text-[var(--success-text)]"> · subiste</span> : null}
          <span className="cell-note">
            {placement.nextBand != null && placement.pointsToNextBand != null
              ? `Te faltan ${placement.pointsToNextBand} puntos para ${placement.nextBand.labelEs}`
              : 'Estás en el nivel más alto de esta área'}
            {level.isCalibrated ? (
              <span title="Ajustado por la dificultad real de las preguntas que respondiste"> · calibrado</span>
            ) : null}
          </span>
          {nationalLine != null ? <span className="cell-note">{nationalLine}</span> : null}
        </td>
      )}
      <td>{level.baseline?.band.labelEs ?? '—'}</td>
    </tr>
  )
}
