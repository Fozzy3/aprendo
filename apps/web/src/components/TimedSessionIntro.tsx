import { BotOff, Flag, Hourglass, ListChecks, Play } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { formatTimeLimit } from '../lib/session-display.ts'

/**
 * The step between choosing a timed session and its clock starting.
 *
 * Tapping a nivelación area or a simulacro used to start the countdown on the
 * spot. The clock is a server timestamp, so it keeps running through a closed
 * tab or a phone call — the student has to know that, and the rules of the
 * session, before it starts rather than after.
 *
 * Focus moves to the title when it opens and back to the button that opened
 * it on cancel. Both callers unmount that button while the intro shows, so it
 * is found again by its place in the page (captured while rendering, before
 * this commit removes it) rather than kept as a node.
 */
export function TimedSessionIntro({
  title,
  subjectColor,
  questionCount,
  timeLimitMs,
  isStarting,
  error,
  cancelLabel,
  onStart,
  onCancel,
}: {
  title: string
  subjectColor?: string
  questionCount: number
  timeLimitMs: number
  isStarting: boolean
  error?: string | null
  cancelLabel: string
  onStart: () => void
  onCancel: () => void
}) {
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [triggerPath] = useState(() =>
    typeof document === 'undefined' || document.activeElement == null
      ? null
      : domPath(document.activeElement),
  )

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const cancel = () => {
    onCancel()
    // After the caller has put the picker back.
    requestAnimationFrame(() => {
      const trigger = triggerPath == null ? null : elementAt(triggerPath)
      if (trigger instanceof HTMLElement) trigger.focus()
    })
  }

  return (
    <section className="timed-intro fade-in" aria-labelledby={titleId}>
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="timed-intro-title">
        {subjectColor != null ? (
          <span
            aria-hidden="true"
            className="subject-dot subject-dot-lg"
            style={{ '--subject-color': subjectColor } as CSSProperties}
          />
        ) : null}
        {title}
      </h2>

      <p className="timed-intro-facts">
        <span>
          <ListChecks size={16} aria-hidden /> {questionCount} preguntas
        </span>
        <span>
          <Hourglass size={16} aria-hidden /> {formatTimeLimit(timeLimitMs)}
        </span>
      </p>

      <ul className="timed-intro-rules">
        <li>
          <BotOff size={18} aria-hidden />
          <span>
            <strong>Sin tutor y sin explicaciones hasta el final.</strong> Las
            respuestas correctas y el tutor llegan en la revisión.
          </span>
        </li>
        <li>
          <Hourglass size={18} aria-hidden />
          <span>
            <strong>El reloj sigue corriendo si sales.</strong> Puedes volver y
            seguir mientras quede tiempo.
          </span>
        </li>
        <li>
          <Flag size={18} aria-hidden />
          <span>
            <strong>Si se acaba el tiempo, se entrega sola</strong> con lo que
            hayas respondido.
          </span>
        </li>
      </ul>

      {error ? (
        <p className="timed-intro-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="timed-intro-actions">
        <button type="button" className="btn-primary" disabled={isStarting} onClick={onStart}>
          <Play size={16} aria-hidden />
          {isStarting ? 'Empezando…' : 'Empezar'}
        </button>
        <button type="button" className="btn-ghost" disabled={isStarting} onClick={cancel}>
          {cancelLabel}
        </button>
      </div>
    </section>
  )
}

/** Where an element sits, as child indexes from <html> down. */
function domPath(element: Element): number[] {
  const path: number[] = []
  for (let node = element; node.parentElement != null; node = node.parentElement) {
    path.unshift([...node.parentElement.children].indexOf(node))
  }
  return path
}

function elementAt(path: number[]): Element | undefined {
  let node: Element | undefined = document.documentElement
  for (const index of path) node = node?.children[index]
  return node
}
