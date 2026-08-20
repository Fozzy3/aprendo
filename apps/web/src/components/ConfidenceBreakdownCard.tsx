import { LEARNING_STATE_DISPLAY, type LearningState } from '../lib/confidence-display.ts'

type Breakdown = {
  mastered: number
  fragile: number
  misconception: number
  gap: number
  declaredCount: number
  undeclaredCount: number
}

/** Worst first: the point of this card is to surface what the student can't see. */
const ORDER: LearningState[] = ['misconception', 'fragile', 'gap', 'mastered']

/**
 * The confidence × correctness breakdown.
 *
 * Correctness alone cannot tell a lucky guess from mastery, or a careless slip
 * from a belief that is simply wrong. This card is the payoff for asking the
 * student to declare: it names the two states a plain accuracy score hides.
 */
export function ConfidenceBreakdownCard({ breakdown }: { breakdown: Breakdown }) {
  // Nothing declared yet: explain the feature instead of rendering four zeros,
  // which would read as "you have no misconceptions" — an actively false claim.
  if (breakdown.declaredCount === 0) {
    return (
      <div className="card confidence-card is-empty">
        <p className="kicker mb-1">Qué tan seguro respondes</p>
        <p className="confidence-card-empty">
          Cuando respondas, dinos si estabas seguro, dudaste o adivinaste. Con eso podemos
          separar lo que de verdad dominas de lo que te salió por suerte.
        </p>
      </div>
    )
  }

  const total = breakdown.declaredCount

  return (
    <div className="card confidence-card">
      <div className="confidence-card-head">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Qué tan seguro respondes
        </h3>
        <span className="confidence-card-evidence">{total} respuestas declaradas</span>
      </div>

      <div className="confidence-bar" role="img" aria-label="Distribución de tus respuestas por estado">
        {ORDER.map((state) => {
          const count = breakdown[state]
          if (count === 0) return null
          return (
            <span
              key={state}
              className={`confidence-bar-seg is-${LEARNING_STATE_DISPLAY[state].tone}`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${LEARNING_STATE_DISPLAY[state].label}: ${count}`}
            />
          )
        })}
      </div>

      <ul className="confidence-legend">
        {ORDER.map((state) => {
          const count = breakdown[state]
          const display = LEARNING_STATE_DISPLAY[state]
          return (
            <li key={state} className={`confidence-legend-row is-${display.tone}`}>
              <span className="confidence-legend-dot" aria-hidden />
              <span className="confidence-legend-body">
                <strong>
                  {display.label} · {count}
                </strong>
                <span>{display.description}</span>
              </span>
            </li>
          )
        })}
      </ul>

      {breakdown.misconception > 0 ? (
        <p className="confidence-card-alert">
          Tienes <strong>{breakdown.misconception}</strong>{' '}
          {breakdown.misconception === 1 ? 'respuesta' : 'respuestas'} donde estabas seguro y
          fallaste. Ese es el error que no se corrige solo, porque no sabes que lo tienes.
        </p>
      ) : null}

      {breakdown.undeclaredCount > 0 ? (
        <p className="confidence-card-note">
          {breakdown.undeclaredCount}{' '}
          {breakdown.undeclaredCount === 1 ? 'respuesta más sin declarar' : 'respuestas más sin declarar'}.
        </p>
      ) : null}
    </div>
  )
}
