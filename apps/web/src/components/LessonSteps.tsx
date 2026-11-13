import { ArrowDown, ChevronRight, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { canSpeak, speak, stopSpeaking } from '../lib/speech.ts'
import { MarkdownBlock } from './MarkdownBlock.tsx'

type Step = { predict: string; reveal: string }

/** A lesson that asks first (F56): predict, then see why, one step at a time. */
export function LessonSteps({ steps }: { steps: Step[] }) {
  const [index, setIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  const step = steps[index]!
  const isLast = index === steps.length - 1

  // A voice left talking over the next step, or another page, is worse than none.
  useEffect(() => stopSpeaking, [])
  const goNext = () => {
    stopSpeaking()
    setIsRevealed(false)
    setIndex(index + 1)
  }

  return (
    <section className="lesson-step" aria-label={`Paso ${index + 1} de ${steps.length}`}>
      <div className="lesson-beads" aria-hidden>
        {steps.map((item, position) => (
          <i key={item.predict} className={position <= index ? 'is-done' : undefined} />
        ))}
      </div>

      <div className="lesson-predict"><MarkdownBlock markdown={step.predict} /></div>

      {isRevealed ? <div className="lesson-reveal"><MarkdownBlock markdown={step.reveal} /></div> : null}

      <div className="lesson-actions">
        {canSpeak() ? (
          <button
            type="button"
            className="lesson-listen"
            onClick={() => speak(isRevealed ? `${step.predict} ${step.reveal}` : step.predict)}
          >
            <Volume2 size={20} aria-hidden />
            Escuchar
          </button>
        ) : null}
        {!isRevealed ? (
          <button type="button" className="btn-primary" onClick={() => setIsRevealed(true)}>
            Ver por qué
          </button>
        ) : !isLast ? (
          <button type="button" className="btn-primary" onClick={goNext}>
            Siguiente
            <ChevronRight size={18} aria-hidden />
          </button>
        ) : (
          <a href="#practica" className="btn-secondary no-underline">
            Practicar este tema
            <ArrowDown size={18} aria-hidden />
          </a>
        )}
      </div>
    </section>
  )
}
