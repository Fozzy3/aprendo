import * as Dialog from '@radix-ui/react-dialog'
import { ClipboardCheck, Flag, X } from 'lucide-react'
import { navigatorRuns } from '../lib/solve-state.ts'

export type NavigatorQuestion = {
  answered: boolean
  flagged: boolean
  /** Shared-text group; consecutive questions on one text are shown together. */
  groupId: string | null
}

/**
 * Every question of the session at a glance — respondida, sin responder,
 * marcada, actual — and a tap to go to any of them. A bottom sheet on a phone,
 * where the thumb already is; a floating panel above the footer on desktop.
 * Radix gives it the focus trap, Escape and the portal (the solve chrome uses
 * backdrop-filter, which would otherwise trap a fixed sheet inside the footer).
 */
export function QuestionNavigator({
  open,
  onOpenChange,
  questions,
  currentIndex,
  onJump,
  onReview,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  questions: NavigatorQuestion[]
  currentIndex: number
  onJump: (index: number) => void
  onReview: () => void
}) {
  const answeredCount = questions.filter((question) => question.answered).length
  const flaggedCount = questions.filter((question) => question.flagged).length

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="solve-sheet-scrim" />
        <Dialog.Content className="solve-sheet solve-nav-sheet" aria-describedby={undefined}>
          <span className="solve-sheet-handle" aria-hidden />
          <header className="solve-sheet-head">
            <div>
              <Dialog.Title className="solve-sheet-title">Preguntas</Dialog.Title>
              <p className="solve-sheet-sub">
                {answeredCount} de {questions.length} respondidas
                {flaggedCount > 0
                  ? ` · ${flaggedCount} marcada${flaggedCount === 1 ? '' : 's'}`
                  : ''}
              </p>
            </div>
            <Dialog.Close className="solve-icon-btn" aria-label="Cerrar el mapa de preguntas">
              <X size={18} />
            </Dialog.Close>
          </header>

          <ul className="solve-map-legend" aria-label="Leyenda">
            <li><span className="solve-map-key is-answered" aria-hidden /> respondida</li>
            <li><span className="solve-map-key" aria-hidden /> sin responder</li>
            <li><Flag size={12} className="solve-map-flag-key" aria-hidden /> marcada</li>
            <li><span className="solve-map-key is-current" aria-hidden /> actual</li>
          </ul>

          <nav className="solve-map-grid" aria-label="Ir a una pregunta">
            {navigatorRuns(questions.map((question) => question.groupId)).map((run) => {
              const cells = run.indexes.flatMap((index) => {
                const question = questions[index]
                return question == null ? [] : [
                  <QuestionCell
                    key={index}
                    index={index}
                    question={question}
                    isCurrent={index === currentIndex}
                    onJump={onJump}
                  />,
                ]
              })
              if (run.groupId == null) return cells
              const first = (run.indexes[0] ?? 0) + 1
              const last = (run.indexes.at(-1) ?? 0) + 1
              return (
                <div
                  key={`${run.groupId}-${first}`}
                  role="group"
                  aria-label={`Preguntas ${first} a ${last}: mismo texto`}
                  className="solve-map-run"
                >
                  {cells}
                </div>
              )
            })}
          </nav>

          <button type="button" className="btn-primary solve-sheet-cta" onClick={onReview}>
            <ClipboardCheck size={16} aria-hidden />
            Revisar y entregar
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function QuestionCell({
  index,
  question,
  isCurrent = false,
  onJump,
}: {
  index: number
  question: Pick<NavigatorQuestion, 'answered' | 'flagged'>
  isCurrent?: boolean
  onJump: (index: number) => void
}) {
  const state = [
    question.answered ? 'respondida' : 'sin responder',
    question.flagged ? 'marcada' : null,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <button
      type="button"
      className={[
        'solve-map-cell',
        question.answered ? 'is-answered' : '',
        isCurrent ? 'is-current' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onJump(index)}
      aria-label={`Pregunta ${index + 1}, ${state}`}
      aria-current={isCurrent ? 'true' : undefined}
    >
      {index + 1}
      {question.flagged ? <Flag size={11} className="solve-map-flag" aria-hidden /> : null}
    </button>
  )
}
