import MarkdownBlock from './MarkdownBlock.tsx'

export interface QuestionGroupContext {
  id: string
  contextMarkdown: string
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
export function SharedStimulus({ group }: { group: QuestionGroupContext }) {
  return (
    <details open className="card-inset shared-stimulus">
      <summary className="shared-stimulus-summary">
        <span className="kicker">Texto compartido</span>
        <span className="shared-stimulus-count">
          Pregunta {group.position} de {group.memberCount} de este texto
        </span>
      </summary>
      <div className="shared-stimulus-body">
        <MarkdownBlock markdown={group.contextMarkdown} />
      </div>
    </details>
  )
}
