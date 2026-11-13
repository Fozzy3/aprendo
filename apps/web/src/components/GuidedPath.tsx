import { useEffect, useRef, useState } from 'react'
import { canRevealNow, guideEyebrow, type GuideView } from '../lib/solve-view.ts'
import { MarkdownBlock } from './MarkdownBlock.tsx'

type OpenGuide = Exclude<GuideView, { phase: 'ended' }>

/**
 * The bottom panel after a wrong answer (F56): the app asks instead of telling.
 * Every step is a tap; the correct option is never shown here. "Muéstrame"
 * appears only once the student has answered the first step.
 */
export function GuidedPath({
  guide,
  lastCorrect,
  isBusy,
  error,
  onChoose,
  onReveal,
  onAskTutor,
}: {
  guide: OpenGuide
  /** The last tap: null right after the diagnosis, which has no wrong answer. */
  lastCorrect: boolean | null
  isBusy: boolean
  error: string | null
  onChoose: (choiceIndex: number) => void
  onReveal: () => void
  onAskTutor?: () => void
}) {
  // Each new step is read aloud, and a keyboard continues from it.
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const stepKey = guide.phase === 'step' ? `step-${guide.stepIndex}` : guide.phase
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [stepKey])

  const prompt = guide.phase === 'retry' ? 'Toca otra opción.' : guide.prompt
  const choices = guide.phase === 'retry' ? [] : guide.choices

  return (
    <section className="ask" aria-label="Camino guiado">
      <div className="ask-inner">
        <p className="ask-eyebrow">
          <span>{guideEyebrow(guide, lastCorrect)}</span>
          {guide.phase === 'step' ? (
            <span className="ask-count">{guide.stepIndex + 1} de {guide.stepCount}</span>
          ) : null}
        </p>
        <h2 ref={headingRef} tabIndex={-1} className="ask-prompt"><MarkdownBlock markdown={prompt} /></h2>

        <div className="ask-chips">
          {choices.map((choice, index) => (
            <button key={choice} type="button" className="ask-chip" disabled={isBusy} onClick={() => onChoose(index)}>
              <MarkdownBlock markdown={choice} />
            </button>
          ))}
        </div>

        {error != null ? <p role="alert" className="ask-error">{error}</p> : null}

        {canRevealNow(guide) || onAskTutor != null ? (
          <div className="ask-actions">
            {canRevealNow(guide) ? (
              <button type="button" className="ask-link" disabled={isBusy} onClick={onReveal}>
                Muéstrame
              </button>
            ) : null}
            {onAskTutor != null ? (
              <button type="button" className="ask-link" onClick={onAskTutor}>
                Pregúntale al tutor
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

type ReviewGuide = {
  steps: { prompt: string; choices: { text: string; correct?: boolean }[] }[]
}

/**
 * "Descúbrelo" in the review: the same path, walked locally because every key of
 * a completed session is already out. The answer is always one tap away.
 */
export function ReviewDiscover({ guide, onShowAnswer }: { guide: ReviewGuide; onShowAnswer: () => void }) {
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null)
  const step = guide.steps[index]

  if (!started || step == null) {
    return (
      <section className="ask ask-review" aria-label="Descúbrelo">
        <div className="ask-inner">
          <h2 className="ask-prompt">¿Lo descubres?</h2>
          <button type="button" className="ask-go" onClick={() => setStarted(true)}>
            Descúbrelo
          </button>
          <div className="ask-actions">
            <button type="button" className="ask-link" onClick={onShowAnswer}>
              Ver la respuesta
            </button>
          </div>
        </div>
      </section>
    )
  }

  const choose = (choiceIndex: number) => {
    if (index + 1 >= guide.steps.length) {
      onShowAnswer()
      return
    }
    // The diagnosis (step 0) has no right answer: it only says where the student went.
    setLastCorrect(index === 0 ? null : step.choices[choiceIndex]?.correct === true)
    setIndex(index + 1)
  }

  return (
    <GuidedPath
      guide={{
        phase: 'step',
        stepIndex: index,
        stepCount: guide.steps.length,
        prompt: step.prompt,
        choices: step.choices.map((choice) => choice.text),
        canReveal: index > 0,
      }}
      lastCorrect={lastCorrect}
      isBusy={false}
      error={null}
      onChoose={choose}
      onReveal={onShowAnswer}
    />
  )
}
