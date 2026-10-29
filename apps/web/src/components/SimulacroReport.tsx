import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Flag, ListChecks } from 'lucide-react'
import type { CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { MAX_GLOBAL_SCORE } from '@aprendo/convex/globalScore'
import { ConfidenceBreakdownCard } from './ConfidenceBreakdownCard.tsx'
import { PageLoader } from './FullScreenLoader.tsx'
import { PracticeSubtopicButton } from './PracticeSubtopicButton.tsx'
import {
  formatClock,
  formatSignedPoints,
  pickPracticeSubtopic,
  simulacroGapMessage,
} from '../lib/result-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { getSubjectLabel, getCompetenciaLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'

const PACE_DISPLAY = {
  adelantado: { label: 'Adelantado', className: 'chip-accent' },
  a_tiempo: { label: 'A tiempo', className: 'chip-success' },
  atrasado: { label: 'Atrasado', className: 'border-[var(--margin)] text-[var(--danger-text)]' },
} as const

/** A change in points, written in green or red ink; no change is pencil. */
function DeltaText({ delta, label }: { delta: number | null; label: string }) {
  if (delta == null) return null
  const tone =
    delta > 0 ? 'text-[var(--success-text)]' : delta < 0 ? 'text-[var(--danger-text)]' : 'text-[var(--text-tertiary)]'
  return (
    <span className={`text-sm font-semibold tabular-nums ${tone}`} title={label}>
      {formatSignedPoints(delta)}
      <span className="sr-only"> {label}</span>
    </span>
  )
}

/**
 * The score report after a simulacro (Bluebook's score report plus Khan's
 * "practice what you missed"). A full exam combines Sesión 1 and 2; without
 * both, or without an area the bank could not serve, it names the gap instead
 * of a 0-500 number.
 */
export function SimulacroReport({
  sessionId,
  studentId,
}: {
  sessionId: string
  studentId: string
}) {
  const reportQuery = useQuery(
    convexQuery(api.sessions.getSimulacroReport, { sessionId: sessionId as never }),
  )

  if (reportQuery.isPending) return <PageLoader message="Armando tu reporte…" />

  const report = reportQuery.data
  if (report == null) {
    return (
      <div className="fade-in mx-auto w-[min(44rem,calc(100%-2rem))] py-10">
        <p className="text-sm text-[var(--text-secondary)]">No pudimos armar el reporte de este simulacro.</p>
        <Link
          to="/practice/$sessionId/review"
          params={{ sessionId }}
          search={{ pregunta: 1 }}
          className="btn-primary mt-4 no-underline"
        >
          Revisar pregunta por pregunta
        </Link>
      </div>
    )
  }

  const isFullExam = report.subjectId == null
  const gapMessage = isFullExam ? simulacroGapMessage(report) : null
  const missingSessionNumber = report.missingSessionNumbers[0] ?? null
  const practiceTarget = pickPracticeSubtopic(report.areas)
  const confidence = report.areas.reduce(
    (sum, area) => ({
      mastered: sum.mastered + area.confidence.mastered,
      fragile: sum.fragile + area.confidence.fragile,
      misconception: sum.misconception + area.confidence.misconception,
      gap: sum.gap + area.confidence.gap,
      declaredCount: sum.declaredCount + area.confidence.declaredCount,
      undeclaredCount: sum.undeclaredCount + area.confidence.undeclaredCount,
    }),
    { mastered: 0, fragile: 0, misconception: 0, gap: 0, declaredCount: 0, undeclaredCount: 0 },
  )
  // Every pace bar shares one scale, so a bar's length is its seconds per
  // question and two areas can be compared by eye.
  const paceScaleMs = Math.max(
    1,
    ...report.areas.flatMap((area) => (area.pace == null ? [] : [area.pace.averageMs, area.pace.officialMs])),
  ) * 1.1
  const sittingLabel = (id: string) =>
    report.sessionIds.length > 1 ? `Sesión ${report.sessionIds.findIndex((sittingId) => sittingId === id) + 1} · ` : ''

  return (
    <div className="fade-in mx-auto w-[min(44rem,calc(100%-2rem))] py-6 sm:py-10">
      <header className="ruled-page-head">
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          Simulacro · {isFullExam ? 'Examen completo' : getSubjectLabel(report.subjectId ?? '')}
        </p>
        <h1 className="page-title mt-1 text-balance">
          {isFullExam ? 'Tu reporte del simulacro' : `Tu resultado en ${getSubjectLabel(report.subjectId ?? '')}`}
        </h1>
      </header>

      {isFullExam && report.global != null ? (
        <section className="ruled-section" aria-labelledby="report-global">
          <div className="section-head">
            <h2 id="report-global" className="section-title">Puntaje global estimado</h2>
            <DeltaText delta={report.globalDeltaVsPrevious} label="frente a tu simulacro anterior" />
          </div>
          <p className="m-0 tabular-nums">
            <span className="figure">{report.global.score}</span>
            <span className="text-sm text-[var(--text-tertiary)]"> de {MAX_GLOBAL_SCORE}</span>
          </p>
          <p className="global-score-band tabular-nums">
            Rango probable: <strong>{report.global.low}–{report.global.high}</strong> (± {report.global.margin})
          </p>
          <div
            className="global-score-track"
            role="img"
            aria-label={`Entre ${report.global.low} y ${report.global.high} de ${MAX_GLOBAL_SCORE}`}
          >
            <span
              className="global-score-range"
              style={{
                left: `${(report.global.low / MAX_GLOBAL_SCORE) * 100}%`,
                width: `${((report.global.high - report.global.low) / MAX_GLOBAL_SCORE) * 100}%`,
              }}
            />
            <span className="global-score-marker" style={{ left: `${(report.global.score / MAX_GLOBAL_SCORE) * 100}%` }} />
          </div>
          <p className="global-score-note">
            Estimado con tus respuestas en Aprendo, no es un puntaje oficial del ICFES.
          </p>
        </section>
      ) : gapMessage != null ? (
        <section className="ruled-section">
          <p className="notice mt-0">{gapMessage}</p>
          {missingSessionNumber != null ? (
            <Link to="/practice" className="btn-secondary mt-3 no-underline">
              Presentar la Sesión {missingSessionNumber} <ArrowRight size={14} aria-hidden />
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="ruled-section" aria-labelledby="report-areas">
        <h2 id="report-areas" className="section-title">
          {isFullExam ? 'Por área' : 'Tu desempeño'}
        </h2>
        <ul className="ruled-list border-t border-[var(--border)]">
          {report.areas.map((area) => {
            const theme = getSubjectTheme(area.subjectId)
            const blanks = area.questionCount - area.answeredCount
            const weakest = area.subtopics.find((entry) => entry.correctCount < entry.questionCount) ?? null
            return (
              <li key={area.subjectId} className="border-b border-[var(--border)] py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                      <span
                        aria-hidden
                        className="subject-dot"
                        style={{ '--subject-color': theme.color } as CSSProperties}
                      />
                      {theme.label}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)] tabular-nums">
                      {area.level != null ? `${area.level.band.labelEs} · ` : ''}
                      {area.correctCount} de {area.questionCount} correctas
                      {blanks > 0 ? ` · ${blanks} en blanco` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <DeltaText delta={area.deltaVsPrevious} label="frente al simulacro anterior" />
                    <p className={`text-xs tabular-nums ${area.level?.index === 1 ? 'text-[var(--danger-text)]' : 'text-[var(--text-tertiary)]'}`}>
                      <strong
                        className={`font-display text-xl font-semibold ${area.level?.index === 1 ? 'text-[var(--danger-text)]' : 'text-[var(--text-primary)]'}`}
                      >
                        {area.score}
                      </strong>{' '}
                      de 100
                    </p>
                  </div>
                </div>

                <dl className="mt-3 grid gap-1.5 text-xs text-[var(--text-secondary)]">
                  {area.pace != null ? (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <dt className="font-semibold text-[var(--text-primary)]">Ritmo</dt>
                      <dd className="m-0 tabular-nums">
                        {formatClock(area.pace.averageMs)} por pregunta · oficial {formatClock(area.pace.officialMs)}
                      </dd>
                      <dd className={`chip m-0 ${PACE_DISPLAY[area.pace.status].className}`}>
                        {PACE_DISPLAY[area.pace.status].label}
                      </dd>
                      <dd className="pace-bar m-0 w-full" aria-hidden>
                        <span
                          className={`pace-bar-fill${area.pace.averageMs > area.pace.officialMs ? ' is-over' : ''}`}
                          style={{ width: `${(area.pace.averageMs / paceScaleMs) * 100}%` }}
                        />
                        <span
                          className="pace-bar-official"
                          style={{ left: `${(area.pace.officialMs / paceScaleMs) * 100}%` }}
                        />
                      </dd>
                    </div>
                  ) : null}
                  {area.flaggedCount > 0 ? (
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                        <Flag size={12} aria-hidden /> Marcadas
                      </dt>
                      <dd className="m-0 tabular-nums">
                        {area.flaggedCount} para revisar · {area.flaggedWrongCount}{' '}
                        {area.flaggedWrongCount === 1 ? 'terminó mal' : 'terminaron mal'}
                      </dd>
                    </div>
                  ) : null}
                  {weakest != null ? (
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Lo que más te costó</dt>
                      <dd className="m-0 tabular-nums">
                        {getSubtopicLabel(weakest.subtopicId)} ({weakest.correctCount} de {weakest.questionCount})
                      </dd>
                    </div>
                  ) : null}
                  {area.competencias.length > 0 ? (
                    // The ICFES reports by competencia (F35): the words of the official result.
                    <div className="flex flex-wrap items-center gap-x-2">
                      <dt className="font-semibold text-[var(--text-primary)]">Por competencia</dt>
                      <dd className="m-0 tabular-nums">
                        {area.competencias
                          .map((row) => `${getCompetenciaLabel(row.competencia)} ${row.correct} de ${row.answered}`)
                          .join(' · ')}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            )
          })}
        </ul>
      </section>

      {practiceTarget != null ? (
        <section className="ruled-section" aria-labelledby="report-practice">
          <h2 id="report-practice" className="section-title">Practicar lo que fallaste</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Empieza por {getSubtopicLabel(practiceTarget.subtopicId)}, el tema donde más fallaste.
          </p>
          <div className="mt-3">
            <PracticeSubtopicButton
              studentId={studentId}
              subtopicId={practiceTarget.subtopicId}
              label="Practicar lo que fallaste"
              variant="primary"
            />
          </div>
        </section>
      ) : null}

      {report.slowestQuestions.length > 0 ? (
        <section className="ruled-section" aria-labelledby="report-slowest">
          <h2 id="report-slowest" className="section-title">Donde se te fue el tiempo</h2>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            Las preguntas en las que más pasaste del ritmo oficial.
          </p>
          <ul className="ruled-list">
            {report.slowestQuestions.map((item) => (
              <li key={item.sessionQuestionId}>
                <Link
                  to="/practice/$sessionId/review"
                  params={{ sessionId: item.sessionId }}
                  search={{ pregunta: item.position }}
                  className="ruled-row no-underline"
                >
                  <span className="ruled-row-main">
                    <span className="block text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                      {sittingLabel(item.sessionId)}Pregunta {item.position}
                    </span>
                    <span className="block truncate text-xs text-[var(--text-tertiary)]">
                      {getSubjectLabel(item.subjectId)}
                      {item.flagged ? ' · marcada' : ''}
                      {' · '}
                      {item.isCorrect === true ? 'Acertaste' : item.isCorrect === false ? 'Fallaste' : 'En blanco'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-[var(--text-tertiary)] tabular-nums">
                    <strong className="block text-sm text-[var(--text-primary)]">{formatClock(item.timeMs ?? 0)}</strong>
                    oficial {formatClock(item.officialMs)}
                  </span>
                  <ChevronRight size={16} aria-hidden className="shrink-0 text-[var(--text-tertiary)]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfidenceBreakdownCard breakdown={confidence} />

      <div className="flex flex-col gap-2 border-t border-[var(--border-strong)] pt-5 sm:flex-row sm:flex-wrap">
        {report.sessionIds.map((id, index) => (
          <Link
            key={id}
            to="/practice/$sessionId/review"
            params={{ sessionId: id }}
            search={{ pregunta: 1 }}
            // One primary action per screen: practice when there is something to
            // practise, else the review.
            className={`${index === 0 && practiceTarget == null ? 'btn-primary' : 'btn-secondary'} justify-center no-underline`}
          >
            <ListChecks size={16} aria-hidden />
            {report.sessionIds.length > 1 ? `Revisar la Sesión ${index + 1}` : 'Revisar pregunta por pregunta'}
          </Link>
        ))}
        <Link to="/practice" className="btn-ghost justify-center no-underline">
          Siguiente simulacro <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  )
}
