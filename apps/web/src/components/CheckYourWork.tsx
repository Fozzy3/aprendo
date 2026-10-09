import { ArrowLeft, Send } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { QuestionCell } from './QuestionNavigator.tsx'

/**
 * "Revisa antes de entregar": the step between the last question and handing
 * the sitting in. In the real exam nothing tells you what you left blank; here
 * the blanks and the marked ones are one tap away, and "Entregar" is a
 * deliberate second press rather than the same "Siguiente" thumb motion.
 */
export function CheckYourWork({
  questionCount,
  summary,
  isSubmitting,
  submitLabel,
  onJump,
  onBack,
  onSubmit,
}: {
  questionCount: number
  summary: { answeredCount: number; blank: number[]; flagged: number[] }
  isSubmitting: boolean
  submitLabel: string
  onJump: (index: number) => void
  onBack: () => void
  onSubmit: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const blankCount = summary.blank.length
  const flaggedCount = summary.flagged.length

  return (
    <>
      <main className="solve-main">
        <section className="solve-check fade-in" aria-labelledby="solve-check-title">
          <h2 id="solve-check-title" ref={headingRef} tabIndex={-1} className="solve-check-title">
            Revisa antes de entregar
          </h2>
          <p className="solve-check-lead">
            Respondiste <strong>{summary.answeredCount}</strong> de {questionCount}.
          </p>

          {blankCount > 0 ? (
            <div className="solve-check-group">
              <h3>
                {blankCount} sin responder
              </h3>
              <p>Una respuesta en blanco no suma nada; adivinar sí puede sumar.</p>
              <div className="solve-check-cells">
                {summary.blank.map((index) => (
                  <QuestionCell
                    key={index}
                    index={index}
                    question={{ answered: false, flagged: summary.flagged.includes(index) }}
                    onJump={onJump}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="solve-check-done">No dejaste ninguna en blanco.</p>
          )}

          {flaggedCount > 0 ? (
            <div className="solve-check-group">
              <h3>
                {flaggedCount} marcada{flaggedCount === 1 ? '' : 's'} para revisar
              </h3>
              <div className="solve-check-cells">
                {summary.flagged.map((index) => (
                  <QuestionCell
                    key={index}
                    index={index}
                    question={{ answered: !summary.blank.includes(index), flagged: true }}
                    onJump={onJump}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <p className="solve-check-note">
            Al entregar ya no podrás cambiar tus respuestas.
          </p>
        </section>
      </main>

      <footer className="solve-footer">
        <button type="button" className="solve-nav-btn" onClick={onBack} disabled={isSubmitting}>
          <ArrowLeft size={16} aria-hidden />
          Volver
        </button>
        <button type="button" className="btn-primary" onClick={onSubmit} disabled={isSubmitting}>
          <Send size={16} aria-hidden />
          {submitLabel}
        </button>
      </footer>
    </>
  )
}
