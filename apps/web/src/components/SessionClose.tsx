import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowRight, ArrowUp, ListChecks, Minus } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { MasteryLevel } from '@aprendo/convex/mastery'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { closingLine } from '../lib/mastery-display.ts'

const ICON = { up: ArrowUp, down: ArrowDown, same: Minus }

/**
 * The close of a practice, a repaso or a reto (F32): how each subtopic moved,
 * or what the next level needs, and where to go next. Nivelación and simulacro
 * have their own result screens.
 */
export function SessionClose({
  sessionId,
  correctCount,
  questionCount,
  changes,
}: {
  sessionId: string
  correctCount: number
  questionCount: number
  changes: { subtopicId: string; from: MasteryLevel; to: MasteryLevel }[]
}) {
  return (
    <div className="ruled-page fade-in">
      <div className="ruled-page-body">
        <header className="ruled-page-head">
          <h1 className="page-title">
            {correctCount} de {questionCount} correctas
          </h1>
          <p className="page-lede">Así quedaron los temas de esta sesión.</p>
        </header>

        <ul className="ruled-list">
          {changes.map((change, index) => {
            const line = closingLine(change)
            const Icon = ICON[line.moved]
            return (
              <li key={change.subtopicId} className="ruled-row">
                <span
                  className={`session-close-mark is-${line.moved}`}
                  style={{ '--i': index } as CSSProperties}
                  aria-hidden
                >
                  <Icon size={16} />
                </span>
                <span className="ruled-row-main">
                  <span className="font-semibold">{getSubtopicLabel(change.subtopicId)}</span>
                  <span className="ruled-row-note">{line.text}</span>
                </span>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/today" className="btn-primary no-underline">
            Siguiente paso en mi plan <ArrowRight size={16} aria-hidden />
          </Link>
          <Link
            to="/practice/$sessionId/review"
            params={{ sessionId }}
            search={{ pregunta: 1 }}
            className="btn-secondary no-underline"
          >
            <ListChecks size={16} aria-hidden /> Revisar pregunta por pregunta
          </Link>
        </div>
      </div>
    </div>
  )
}
