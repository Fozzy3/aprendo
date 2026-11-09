import { ChevronRight, CircleCheck, CircleX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { MarkdownBlock } from './MarkdownBlock.tsx'
import type { answerFeedback } from '../lib/answer-feedback.ts'

type AnswerFeedbackProps = {
  feedback: NonNullable<ReturnType<typeof answerFeedback>>
  explanationSource: 'icfes' | 'ai_generated' | 'human' | null
  isLast: boolean
  /** The verdict just arrived: bring focus to it. Not on a revisit. */
  justChecked: boolean
  /** How the guided path ended, for a wrong first answer; null when there was none. */
  outcome: 'self_corrected' | 'revealed' | null
  reveal: string | null
  onNext: () => void
}

/**
 * The close of one answer: the verdict, and "¿por qué funciona?" one tap away.
 * Only a right answer, or the end of a guided path (F56), reaches this screen.
 */
export function AnswerFeedback({
  feedback,
  explanationSource,
  isLast,
  justChecked,
  outcome,
  reveal,
  onNext,
}: AnswerFeedbackProps) {
  const verdictRef = useRef<HTMLParagraphElement | null>(null)
  useEffect(() => {
    if (justChecked) verdictRef.current?.focus({ preventScroll: true })
  }, [justChecked])

  const { isCorrect, correctOption, picked, solutionMarkdown, others } = feedback
  const discovered = outcome === 'self_corrected'
  const isGood = isCorrect || discovered
  const hasExplanation = picked != null || solutionMarkdown != null || others.length > 0

  return (
    <section className={`verdict${isGood ? ' is-good' : ''}`} aria-label="Resultado de tu respuesta">
      <div className="verdict-inner">
        <p ref={verdictRef} tabIndex={-1} className={`answer-verdict ${isGood ? 'is-correct' : 'is-incorrect'}`}>
          {isGood ? <CircleCheck size={22} aria-hidden /> : <CircleX size={22} aria-hidden />}
          <strong>{discovered ? 'Lo descubriste' : isCorrect ? 'Correcta' : `La respuesta es la ${correctOption}.`}</strong>
        </p>

        {reveal != null ? <div className="verdict-reveal"><MarkdownBlock markdown={reveal} /></div> : null}

        {hasExplanation ? (
          <details className="verdict-more">
            <summary>¿Por qué funciona?</summary>
            {picked != null ? (
              <div className="review-explanation is-distractor">
                <h3 className="answer-feedback-heading">Por qué la {picked.label} parece correcta</h3>
                <MarkdownBlock markdown={picked.rationaleMarkdown} />
              </div>
            ) : null}
            {solutionMarkdown != null ? (
              <div className="review-explanation">
                <MarkdownBlock markdown={solutionMarkdown} />
              </div>
            ) : null}
            {others.map((item) => (
              <div key={item.label} className="answer-feedback-other">
                <span className="option-label" aria-hidden>{item.label}</span>
                <div className="min-w-0 flex-1">
                  <span className="sr-only">Opción {item.label}: </span>
                  <MarkdownBlock markdown={item.rationaleMarkdown} />
                </div>
              </div>
            ))}
            {explanationSource === 'ai_generated' ? <p className="answer-feedback-note">Explicación escrita con IA.</p> : null}
          </details>
        ) : null}

        <button type="button" className="btn-primary answer-feedback-next" onClick={onNext}>
          {isLast ? 'Terminar' : 'Siguiente'}
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </section>
  )
}
