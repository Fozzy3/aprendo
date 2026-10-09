import { ChevronRight, CircleCheck, CircleX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import MarkdownBlock from './MarkdownBlock.tsx'
import type { answerFeedback } from '../lib/answer-feedback.ts'

type AnswerFeedbackProps = {
  feedback: NonNullable<ReturnType<typeof answerFeedback>>
  explanationSource: 'icfes' | 'ai_generated' | 'human' | null
  isLast: boolean
  /** Bring the verdict into view: only right after "Comprobar", not on a revisit. */
  scrollIntoView: boolean
  onNext: () => void
}

/**
 * The verdict on one checked answer, in an immediate-feedback practice: right
 * or wrong (in the semantic colours, with words, never colour alone), why the
 * chosen option looked right, the solution, then the other options.
 */
export function AnswerFeedback({
  feedback,
  explanationSource,
  isLast,
  scrollIntoView,
  onNext,
}: AnswerFeedbackProps) {
  const ref = useRef<HTMLElement | null>(null)
  const verdictRef = useRef<HTMLParagraphElement | null>(null)
  useEffect(() => {
    if (!scrollIntoView) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
    // "Comprobar" unmounts with the check: focus lands on the verdict, which is read aloud.
    verdictRef.current?.focus({ preventScroll: true })
  }, [scrollIntoView])

  const { isCorrect, correctOption, picked, solutionMarkdown, others } = feedback
  const hasExplanation = picked != null || solutionMarkdown != null || others.length > 0

  return (
    <section ref={ref} className="answer-feedback" aria-label="Resultado de tu respuesta">
      <p
        ref={verdictRef}
        tabIndex={-1}
        className={`answer-verdict ${isCorrect ? 'is-correct' : 'is-incorrect'}`}
      >
        {isCorrect ? <CircleCheck size={20} aria-hidden /> : <CircleX size={20} aria-hidden />}
        <strong>{isCorrect ? 'Correcta' : 'Incorrecta'}</strong>
        {isCorrect ? null : <span>La respuesta es la {correctOption}.</span>}
      </p>

      {picked != null ? (
        <div className="review-explanation is-distractor">
          <h3 className="answer-feedback-heading">Por qué la {picked.label} parece correcta</h3>
          <MarkdownBlock markdown={picked.rationaleMarkdown} />
        </div>
      ) : null}

      {solutionMarkdown != null ? (
        <div className="review-explanation">
          <h3 className="answer-feedback-heading">Explicación</h3>
          <MarkdownBlock markdown={solutionMarkdown} />
        </div>
      ) : null}

      {others.length > 0 ? (
        <details className="answer-feedback-others">
          <summary>Por qué no son las otras opciones</summary>
          {others.map((item) => (
            <div key={item.label} className="answer-feedback-other">
              <span className="option-label" aria-hidden>{item.label}</span>
              <div className="min-w-0 flex-1">
                <span className="sr-only">Opción {item.label}: </span>
                <MarkdownBlock markdown={item.rationaleMarkdown} />
              </div>
            </div>
          ))}
        </details>
      ) : null}

      {!hasExplanation ? (
        <p className="answer-feedback-note">Esta pregunta todavía no tiene una explicación escrita.</p>
      ) : explanationSource === 'ai_generated' ? (
        <p className="answer-feedback-note">Explicación escrita con IA.</p>
      ) : null}

      <button type="button" className="btn-primary answer-feedback-next" onClick={onNext}>
        {isLast ? 'Terminar' : 'Siguiente'}
        <ChevronRight size={16} aria-hidden />
      </button>
    </section>
  )
}
