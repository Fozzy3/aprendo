import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { progressTrendsQuery, studentProgressQuery } from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { GlobalScoreCard } from './GlobalScoreCard.tsx'
import { ConfidenceBreakdownCard } from './ConfidenceBreakdownCard.tsx'
import { getSubjectLabel, getSubtopicLabel } from '../lib/taxonomy.ts'
import { PageLoader } from '../components/FullScreenLoader.tsx'
import { MascotMessage } from './Mascot.tsx'

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

function DeltaChip({ delta }: { delta: number }) {
  const tone = deltaTone(delta)
  const Icon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : Minus
  const className =
    tone === 'up'
      ? 'bg-[var(--success-soft)] text-[var(--success-text)]'
      : tone === 'down'
        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
        : 'bg-[var(--bg-inset)] text-[var(--text-tertiary)]'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums ${className}`}
    >
      <Icon size={11} />
      {tone === 'flat' ? 'Igual' : `${formatDeltaPoints(delta)} pts`}
    </span>
  )
}

/** Hand-rolled SVG area+line chart of accuracy over time (no chart library). */
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
  const areaPath = `${linePath} L${xFor(count - 1)},${height - padY} L${xFor(0)},${height - padY} Z`
  const midY = yFor(0.5)

  // preserveAspectRatio="none" lets the chart fill the card width; vector-effect
  // keeps strokes an even thickness despite the non-uniform scale (so no dots —
  // circles would distort into ellipses).
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full" preserveAspectRatio="none" role="img" aria-label="Precisión por semana">
      <line x1={padX} y1={midY} x2={width - padX} y2={midY} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <path d={areaPath} fill="var(--accent-soft)" />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function StudentProgressPage({ studentId }: { studentId: string }) {
  const progressQuery = useQuery({ ...studentProgressQuery(studentId), enabled: true })
  const trendsQuery = useQuery({ ...progressTrendsQuery(studentId), enabled: true })

  if (progressQuery.isPending || trendsQuery.isPending) {
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
  const weekly = trends?.weekly ?? []

  if (overallSummary == null) {
    return (
      <div className="fade-in mx-auto max-w-md">
        <div className="card relative overflow-hidden p-8 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--accent-soft),transparent_65%)]" />
          <div className="relative">
            <MascotMessage
              mood="idle"
              title="Todavía no puedo medir nada"
              action={
                <Link to="/diagnostic" className="btn-primary no-underline">
                  Nivelar un área
                </Link>
              }
            >
              Nivélate en un área y desde ahí empiezo a seguir cuánto avanzas.
            </MascotMessage>
          </div>
        </div>
      </div>
    )
  }

  const currentAccuracy = overallSummary.accuracy
  const baselineAccuracy = baseline?.accuracy ?? null
  const overallDelta = baselineAccuracy != null ? currentAccuracy - baselineAccuracy : null

  const heroTitle =
    overallDelta == null
      ? 'Tu punto de partida'
      : overallDelta >= 0.05
        ? 'Vas mejorando'
        : overallDelta <= -0.05
          ? 'Recuperemos el ritmo'
          : 'Sigue sumando práctica'

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

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-5">
      {/* Hero: how much you've improved */}
      <div className="card progress-hero relative overflow-hidden px-6 py-5 sm:px-8 sm:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--accent-soft),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="kicker mb-1">Tu progreso</p>
            <h2 className="font-display text-2xl italic tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {heroTitle}
            </h2>
            {overallDelta != null ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {overallDelta >= 0 ? 'Has subido ' : 'Has bajado '}
                <span className="font-semibold text-[var(--text-primary)]">
                  {formatDeltaPoints(Math.abs(overallDelta)).replace('+', '')} puntos
                </span>{' '}
                de precisión desde tu diagnóstico.
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Practica un poco más para comparar contra tu diagnóstico.
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
                {formatPercent(currentAccuracy)}
              </p>
              {overallDelta != null ? <DeltaChip delta={overallDelta} /> : null}
            </div>
            <p className="text-xs font-medium text-[var(--text-tertiary)]">precisión general</p>
          </div>
        </div>
      </div>

      {/* Activity stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card px-5 py-4">
          <p className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {trends?.totalAttempts ?? 0}
          </p>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">preguntas respondidas</p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {trends?.activeDays ?? 0}
          </p>
          <p className="text-xs font-medium text-[var(--text-tertiary)]">días de estudio</p>
        </div>
        <div className="card col-span-2 px-5 py-4 sm:col-span-1">
          {mostImproved != null && mostImproved.delta != null ? (
            <>
              <div className="flex items-center gap-2">
                <p className="truncate text-lg font-semibold text-[var(--text-primary)]">
                  {mostImproved.label}
                </p>
                <DeltaChip delta={mostImproved.delta} />
              </div>
              <p className="text-xs font-medium text-[var(--text-tertiary)]">lo que más mejoró</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
                {formatPercent(currentAccuracy)}
              </p>
              <p className="text-xs font-medium text-[var(--text-tertiary)]">precisión acumulada</p>
            </>
          )}
        </div>
      </div>

      {/* Trend chart */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tu precisión en el tiempo</h3>
          {trendDelta != null ? <DeltaChip delta={trendDelta} /> : null}
        </div>
        <div className="px-5 py-4">
          {weekly.length >= 2 ? (
            <>
              <TrendChart points={weekly} />
              <div className="mt-1 flex justify-between text-[0.6875rem] font-medium text-[var(--text-tertiary)]">
                <span>{firstWeek != null ? formatWeekLabel(firstWeek.weekStartMs) : ''}</span>
                <span>{lastWeek != null ? formatWeekLabel(lastWeek.weekStartMs) : ''}</span>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--text-tertiary)]">
              Practica en al menos dos semanas distintas para ver tu tendencia.
            </p>
          )}
        </div>
      </div>

      {progress?.globalScore != null ? (
        <GlobalScoreCard studentId={studentId} data={progress.globalScore} />
      ) : null}

      {/* ICFES performance level per area */}
      <div className="card overflow-hidden">
        <div className="flex items-baseline justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tu nivel ICFES por área</h3>
          <Link to="/diagnostic" className="text-xs font-semibold no-underline">
            Nivelar un área
          </Link>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {subjectLevels.map((level) => (
            <SubjectLevelRow key={level.subjectId} level={level} />
          ))}
        </div>
      </div>

      {trends?.confidence != null ? (
        <ConfidenceBreakdownCard breakdown={trends.confidence} />
      ) : null}

      {/* Before vs now, per subject */}
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Antes y ahora, por materia</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {subjectRows.map((row) => (
            <div key={row.id} className="px-5 py-3.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{row.label}</p>
                {row.delta != null ? (
                  <DeltaChip delta={row.delta} />
                ) : (
                  <span className="rounded-full bg-[var(--bg-inset)] px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--text-tertiary)]">
                    Nuevo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Track with baseline tick + current fill */}
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-inset)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.round(row.currentAccuracy * 100)}%`,
                      background: row.delta != null && row.delta < 0 ? 'var(--accent)' : 'var(--success)',
                    }}
                  />
                  {row.baselineAccuracy != null ? (
                    <div
                      className="absolute top-[-2px] h-[calc(100%+4px)] w-0.5 bg-[var(--text-tertiary)]"
                      style={{ left: `${Math.round(row.baselineAccuracy * 100)}%` }}
                      title={`Diagnóstico: ${formatPercent(row.baselineAccuracy)}`}
                    />
                  ) : null}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-[var(--text-tertiary)]">
                  {row.baselineAccuracy != null ? `${formatPercent(row.baselineAccuracy)} → ` : ''}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {formatPercent(row.currentAccuracy)}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Keep improving here */}
      {weakestSubtopics.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Sigue mejorando aquí</h3>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {weakestSubtopics.slice(0, 5).map((agg) => (
              <Link
                key={agg._id}
                to="/lesson/$subtopicId"
                params={{ subtopicId: agg.subtopicId ?? 'sin_subtema' }}
                className="flex items-center gap-3.5 px-5 py-3.5 no-underline transition-colors hover:bg-[var(--bg-inset)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
                  <BookOpen size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {getSubtopicLabel(agg.subtopicId ?? 'sin_subtema')}
                  </p>
                  <p className="text-[0.6875rem] text-[var(--text-tertiary)]">
                    {getSubjectLabel(agg.subjectId)} · {formatPercent(agg.masteryScore)} de dominio
                  </p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-[var(--text-tertiary)]" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type SubjectLevelRowData = {
  subjectId: string
  hasEnoughEvidence: boolean
  attemptCount: number
  isPlaced: boolean
  currentScore: number | null
  isCalibrated: boolean
  baselineScore: number | null
  national: {
    shareAtThisLevel: number | null
    percentileAtOrBelow: number | null
    year: number | null
  } | null
  current: {
    band: { id: string; labelEs: string; descriptorEs: string }
    index: number
    bandCount: number
    nextBand: { labelEs: string } | null
    pointsToNextBand: number | null
  } | null
  baseline: { index: number } | null
}

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
    <div className="px-5 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
          <span aria-hidden="true">{theme.emoji}</span>
          {theme.label}
        </p>
        {placement == null ? (
          <Link to="/diagnostic" className="text-xs font-semibold no-underline">
            Nivelarme
          </Link>
        ) : (
          <span className="flex items-center gap-1.5">
            {levelledUp && (
              <span className="rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[0.625rem] font-bold text-[var(--success-text)]">
                ¡Subiste de nivel!
              </span>
            )}
            <span className="text-sm font-bold" style={{ color: theme.color }}>
              {placement.band.labelEs}
            </span>
          </span>
        )}
      </div>

      {placement == null ? (
        <p className="text-xs text-[var(--text-tertiary)]">
          Sin nivel aún · {level.attemptCount} preguntas respondidas
        </p>
      ) : (
        <>
          <div className="flex gap-1" role="img" aria-label={`Nivel ${placement.index} de ${placement.bandCount}`}>
            {Array.from({ length: placement.bandCount }, (_, position) => (
              <span
                key={position}
                className="h-2 flex-1 rounded-full"
                style={{
                  background: position < placement.index ? theme.color : 'var(--bg-inset)',
                  outline:
                    level.baseline != null && position === level.baseline.index - 1
                      ? '2px solid var(--text-tertiary)'
                      : undefined,
                  outlineOffset: '1px',
                }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
            {placement.nextBand != null && placement.pointsToNextBand != null
              ? `Te faltan ${placement.pointsToNextBand} puntos para ${placement.nextBand.labelEs}`
              : 'Estás en el nivel más alto de esta área'}
            {level.isCalibrated ? (
              <span className="level-calibrated" title="Ajustado por la dificultad real de las preguntas que respondiste">
                {' '}· calibrado
              </span>
            ) : null}
          </p>

          {nationalLine != null ? (
            <p className="level-national">🇨🇴 {nationalLine}</p>
          ) : null}
        </>
      )}
    </div>
  )
}
