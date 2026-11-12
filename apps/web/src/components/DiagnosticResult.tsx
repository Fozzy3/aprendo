import { Link } from '@tanstack/react-router'
import { ArrowRight, ListChecks } from 'lucide-react'
import { MotionConfig, motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { CareerCard } from './CareerPicker.tsx'
import { motionTokens } from '../lib/motion-tokens.ts'
import { diagnosticAreas } from '../lib/result-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'

/**
 * After the general diagnostic: where the student starts in each area, weakest
 * first. Four questions per area is a starting point, not a verdict, so every
 * level says it is preliminary; practice confirms it.
 *
 * The bars grow in that order, then the plan appears: the result is read
 * before the next step is offered.
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
  const t = motionTokens()
  // Bars stagger at twice the step rhythm so each reads as its own area.
  const barDelay = (index: number) => index * t.stagger * 2
  const planDelay = barDelay(areas.length) + t.step

  return (
    <MotionConfig reducedMotion="user">
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
            {areas.map((area, index) => {
              const theme = getSubjectTheme(area.subjectId)
              return (
                <li key={area.subjectId} style={{ '--subject-color': theme.color } as CSSProperties}>
                  <span className="diagnostic-result-label">
                    <span aria-hidden className="subject-dot" />
                    {theme.label}
                  </span>
                  <span className="diagnostic-result-bar" aria-hidden>
                    <motion.span
                      style={{ width: `${area.score}%` }}
                      initial={{ transform: 'scaleX(0)' }}
                      animate={{ transform: 'scaleX(1)' }}
                      transition={{ duration: t.step, ease: t.ease, delay: barDelay(index) }}
                    />
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

        <motion.section
          className="ruled-section"
          aria-labelledby="diagnostic-plan-title"
          initial={{ opacity: 0, transform: 'translateY(8px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{ duration: t.step, ease: t.ease, delay: planDelay }}
        >
          <h2 id="diagnostic-plan-title" className="section-title">Tu plan está listo</h2>
          {weakest != null ? (
            <p className="mb-3 text-sm text-[var(--text-secondary)]">
              Empezamos por {getSubjectTheme(weakest.subjectId).label}: ahí es donde más puedes subir.
            </p>
          ) : null}
          <Link to="/today" className="btn-primary no-underline">
            Ver mi plan de hoy <ArrowRight size={16} aria-hidden />
          </Link>
        </motion.section>

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
    </MotionConfig>
  )
}
