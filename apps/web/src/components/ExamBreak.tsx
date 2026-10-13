import { Hourglass, ListChecks, Play } from 'lucide-react'
import { EmptyState } from './EmptyState.tsx'
import { formatTimeLimit } from '../lib/session-display.ts'

/**
 * Between Sesión 1 and Sesión 2 of a full simulacro. Saber 11 is one long day:
 * the student leaves at the end of the morning sitting and comes back after
 * lunch. The Sesión 1 result is not shown here, as on the real day.
 */
export function ExamBreak({
  questionCount,
  timeLimitMs,
  isStarting,
  error,
  onStart,
  onLater,
}: {
  questionCount: number
  timeLimitMs: number
  isStarting: boolean
  error: string | null
  onStart: () => void
  onLater: () => void
}) {
  return (
    <div className="exam-break fade-in">
      <EmptyState
        title="Descanso"
        action={
          <div className="exam-break-actions">
            <button type="button" className="btn-primary" disabled={isStarting} onClick={onStart}>
              <Play size={16} aria-hidden />
              {isStarting ? 'Empezando…' : 'Empezar la Sesión 2'}
            </button>
            <button type="button" className="btn-ghost" disabled={isStarting} onClick={onLater}>
              Más tarde
            </button>
          </div>
        }
      >
        Terminaste la Sesión 1. En el examen real sales y vuelves a la 1:30 p. m.: come algo,
        toma agua y vuelve cuando estés listo.
      </EmptyState>

      <p className="timed-intro-facts exam-break-facts">
        <span>
          <ListChecks size={16} aria-hidden /> {questionCount} preguntas
        </span>
        <span>
          <Hourglass size={16} aria-hidden /> {formatTimeLimit(timeLimitMs)}
        </span>
      </p>

      {error ? (
        <p className="stage-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
