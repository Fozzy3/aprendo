import MarkdownBlock from './MarkdownBlock.tsx'

export interface QuestionGroupContext {
  id: string
  contextMarkdown: string
  /** The passage or table rendered from the booklet, when one was captured. */
  imageUrl?: string | null
  memberCount: number
  /** 1-based position of the current question within the group. */
  position: number
}

/**
 * The text/table/graphic a run of questions share ("Responda las preguntas 4 a
 * 7 de acuerdo con la siguiente información").
 *
 * Rendered once above the stem instead of being concatenated into every
 * question's body, and labelled so the student knows the same text covers
 * several questions.
 *
 * `<details>` rather than a JS toggle: collapsing a long passage on a phone is
 * exactly what the native element does, and it keeps the text in the DOM for
 * screen readers and find-in-page.
 */
export function SharedStimulus({
  group,
  panelRef,
}: {
  group: QuestionGroupContext
  /** Lets the solve screen reset the passage scroll when the question changes. */
  panelRef?: React.Ref<HTMLDetailsElement>
}) {
  return (
    <details open ref={panelRef} className="card-inset shared-stimulus">
      <summary className="shared-stimulus-summary">
        <span className="kicker">Texto compartido</span>
        <span className="shared-stimulus-count">
          Pregunta {group.position} de {group.memberCount} de este texto
        </span>
      </summary>
      <div className="shared-stimulus-body">
        {group.imageUrl != null ? (
          <>
            <img src={group.imageUrl} alt="" className="question-scan" loading="lazy" />
            <span className="sr-only">{group.contextMarkdown}</span>
          </>
        ) : (
          <MarkdownBlock markdown={group.contextMarkdown} />
        )}
      </div>
    </details>
  )
}
