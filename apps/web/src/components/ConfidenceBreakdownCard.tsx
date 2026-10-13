import { useId } from 'react'
import { LEARNING_STATE_DISPLAY, type LearningState } from '../lib/confidence-display.ts'

type Breakdown = {
  mastered: number
  fragile: number
  misconception: number
  gap: number
  declaredCount: number
  undeclaredCount: number
}

/** Worst first: the point of this section is to surface what the student can't see. */
const ORDER: LearningState[] = ['misconception', 'fragile', 'gap', 'mastered']

/** The inks of the notebook: red is the mistake, pencil the tentative, green the sure. */
const TONE_INK = {
  good: 'var(--success)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  neutral: 'var(--text-tertiary)',
} as const

/**
 * The confidence × correctness breakdown.
 *
 * Correctness alone cannot tell a lucky guess from mastery, or a careless slip
 * from a belief that is simply wrong. This section is the payoff for asking the
 * student to declare: it names the two states a plain accuracy score hides.
 */
export function ConfidenceBreakdownCard({ breakdown }: { breakdown: Breakdown }) {
  const titleId = useId()
  const total = breakdown.declaredCount

  return (
    <section className="ruled-section" aria-labelledby={titleId}>
      <div className="section-head">
        <h2 id={titleId} className="section-title">Qué tan seguro respondes</h2>
        {total > 0 ? <span className="section-meta">{total} respuestas declaradas</span> : null}
      </div>

      {/* Nothing declared yet: explain the feature instead of rendering four zeros,
          which would read as "you have no misconceptions" — an actively false claim. */}
      {total === 0 ? (
        <p className="m-0 max-w-[60ch] text-sm text-[var(--text-secondary)]">
          Cuando respondas, dinos si estabas seguro, dudaste o adivinaste. Con eso podemos
          separar lo que de verdad dominas de lo que te salió por suerte.
        </p>
      ) : (
        <>
          <div
            className="flex h-2 gap-px bg-[var(--bg-inset)]"
            role="img"
            aria-label="Distribución de tus respuestas por estado"
          >
            {ORDER.map((state) => {
              const count = breakdown[state]
              if (count === 0) return null
              const display = LEARNING_STATE_DISPLAY[state]
              return (
                <span
                  key={state}
                  style={{ width: `${(count / total) * 100}%`, background: TONE_INK[display.tone] }}
                  title={`${display.label}: ${count}`}
                />
              )
            })}
          </div>

          <ul className="ruled-list mt-4">
            {ORDER.map((state) => {
              const display = LEARNING_STATE_DISPLAY[state]
              return (
                <li key={state} className="ruled-row items-start">
                  <span
                    aria-hidden
                    className="mt-1.5 h-2 w-2 shrink-0"
                    style={{ background: TONE_INK[display.tone] }}
                  />
                  <span className="ruled-row-main">
                    <span className="text-sm font-semibold">{display.label}</span>
                    <span className="ruled-row-note">{display.description}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{breakdown[state]}</span>
                </li>
              )
            })}
          </ul>

          {breakdown.misconception > 0 ? (
            <p className="notice is-danger">
              Tienes <strong>{breakdown.misconception}</strong>{' '}
              {breakdown.misconception === 1 ? 'respuesta' : 'respuestas'} donde estabas seguro y
              fallaste. Ese es el error que no se corrige solo, porque no sabes que lo tienes.
            </p>
          ) : null}

          {breakdown.undeclaredCount > 0 ? (
            <p className="mt-3 mb-0 text-xs text-[var(--text-tertiary)]">
              {breakdown.undeclaredCount}{' '}
              {breakdown.undeclaredCount === 1 ? 'respuesta más sin declarar' : 'respuestas más sin declarar'}.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}
