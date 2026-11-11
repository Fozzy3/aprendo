import { Link } from '@tanstack/react-router'
import { ArrowRight, ListChecks } from 'lucide-react'
import type { CSSProperties } from 'react'
import { CareerCard } from './CareerPicker.tsx'
import { diagnosticAreas } from '../lib/result-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'

/**
 * After the general diagnostic: where the student starts in each area, weakest
 * first. Four questions per area is a starting point, not a verdict, so every
 * level says it is preliminary; practice confirms it.
 */
export function DiagnosticResult({
  session,
  studentId,
}: {
  session: {
    _id: string
    summary?: {
      correctCount: number
      questionCount: number
      subjectScores?: { subjectId: string; correctCount: number; questionCount: number }[]
    } | null
  }
  studentId: string
}) {
  const areas = diagnosticAreas(session.summary?.subjectScores ?? [])
  const weakest = areas[0]

  return (
    <div className="fade-in mx-auto w-[min(40rem,calc(100%-2rem))] py-6 sm:py-10">
      <header className="ruled-page-head">
        <p className="m-0 text-sm text-[var(--text-secondary)]">Diagnóstico inicial</p>
        <h1 className="page-title mt-1 text-balance">Tu punto de partida</h1>
        {session.summary != null ? (
          <p className="page-lede tabular-nums">
            Acertaste {session.summary.correctCount} de {session.summary.questionCount}. Así quedaste en cada área.
          </p>
        ) : null}
      </header>

      <section className="ruled-section" aria-label="Tu nivel por área">
        <ul className="diagnostic-result-areas">
          {areas.map((area) => {
            const theme = getSubjectTheme(area.subjectId)
            return (
              <li key={area.subjectId} style={{ '--subject-color': theme.color } as CSSProperties}>
                <span className="diagnostic-result-label">
                  <span aria-hidden className="subject-dot" />
                  {theme.label}
                </span>
                <span className="diagnostic-result-bar" aria-hidden>
                  <span style={{ width: `${area.score}%` }} />
                </span>
                <span className="diagnostic-result-level">
                  <strong>{area.level?.band.labelEs ?? 'Sin nivel'}</strong>
                  <small className="tabular-nums">{area.correctCount} de {area.questionCount}</small>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="notice">
          <strong className="text-[var(--text-primary)]">Niveles preliminares.</strong> Salen de pocas preguntas
          por área; tu práctica los confirma o los corrige.
        </p>
      </section>

      <section className="ruled-section">
        {weakest != null ? (
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            Empezamos por {getSubjectTheme(weakest.subjectId).label}: ahí es donde más puedes subir.
          </p>
        ) : null}
        <Link to="/today" className="btn-primary no-underline">
          Ver mi plan de hoy <ArrowRight size={16} aria-hidden />
        </Link>
      </section>

      <CareerCard studentId={studentId} mode="invite" />

      <div className="border-t border-[var(--border-strong)] pt-5">
        <Link
          to="/practice/$sessionId/review"
          params={{ sessionId: session._id }}
          search={{ pregunta: 1 }}
          className="btn-secondary no-underline"
        >
          <ListChecks size={16} aria-hidden /> Revisar pregunta por pregunta
        </Link>
      </div>
    </div>
  )
}
