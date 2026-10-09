import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronRight, Clock3, Play } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { officialMsPerQuestion } from '@aprendo/convex/pacing'
import {
  MAX_PRACTICE_QUESTIONS,
  MIN_PRACTICE_QUESTIONS,
  PRACTICE_DIFFICULTIES,
  PRACTICE_SOURCES,
} from '@aprendo/convex/practiceBuilder'
import { SESSION_KIND_CONFIG } from '@aprendo/convex/sessionKinds'
import {
  COUNT_OPTIONS,
  DEFAULT_BUILDER,
  DIFFICULTY_LABELS,
  SOURCE_LABELS,
  availableLabel,
  builderFilters,
  builderSessionArgs,
  builderStatus,
  selectSubject,
  subtopicsForSubject,
  toggleSubtopic,
  type BuilderState,
} from '../lib/practice-builder.ts'
import { formatTimeLimit, getKindIcon } from '../lib/session-display.ts'
import { practiceBuilderCountsQuery } from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { subjectIds } from '../lib/taxonomy.ts'

type PracticeBuilderProps = {
  studentId: string
  expanded: boolean
  /** Another session is starting from the hub. */
  disabled: boolean
  isStarting: boolean
  error: string | null
  onToggle: () => void
  onStart: (args: ReturnType<typeof builderSessionArgs>) => void
}

const MS_PER_QUESTION = officialMsPerQuestion({ kind: 'personalizada' })
const Icon = getKindIcon('personalizada')

function Choice({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className="topic-chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  )
}

function Field({ legend, children, help }: { legend: string; children: ReactNode; help?: string }) {
  return (
    <fieldset className="builder-field">
      <legend className="builder-legend">{legend}</legend>
      <div className="builder-choices">{children}</div>
      {help != null ? <p className="builder-help">{help}</p> : null}
    </fieldset>
  )
}

/**
 * "Arma tu práctica" (kind `personalizada`): a hub card that opens into the
 * builder. Collapsed it is one line on the hub, so the phone screen stays
 * scannable; open, every choice is a chip and the count of matching questions
 * updates as the student narrows.
 */
export function PracticeBuilder({
  studentId,
  expanded,
  disabled,
  isStarting,
  error,
  onToggle,
  onStart,
}: PracticeBuilderProps) {
  const [state, setState] = useState<BuilderState>(DEFAULT_BUILDER)
  const update = (patch: Partial<BuilderState>) => setState((prev) => ({ ...prev, ...patch }))

  const countsQuery = useQuery({
    ...practiceBuilderCountsQuery(studentId, expanded ? builderFilters(state) : null),
    // Keep the last number on screen while the next one loads, not a flicker.
    placeholderData: keepPreviousData,
  })
  const counts = countsQuery.data
  const status = countsQuery.isError
    ? { canStart: false, message: 'No pudimos contar las preguntas. Revisa tu conexión.' }
    : builderStatus(state, counts)
  const subtopics = subtopicsForSubject(state.subjectId)
  const config = SESSION_KIND_CONFIG.personalizada

  return (
    <div className={`launch-card is-builder${expanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="launch-card-main"
        disabled={disabled}
        aria-expanded={expanded}
        aria-controls="practice-builder"
        onClick={onToggle}
      >
        <span className="launch-card-icon" aria-hidden>
          <Icon size={20} />
        </span>
        <span className="launch-card-body">
          <span className="launch-card-title">Arma tu práctica</span>
          <span className="launch-card-copy">{config.taglineEs}</span>
          <span className="launch-card-meta">
            <span>{MIN_PRACTICE_QUESTIONS} a {MAX_PRACTICE_QUESTIONS} preguntas</span>
            <span>Con o sin reloj</span>
          </span>
        </span>
        <span className="launch-card-cta" aria-hidden>
          <ChevronRight size={18} />
        </span>
      </button>

      {expanded ? (
        <div id="practice-builder" className="builder">
          <div className="builder-fields">
            <Field legend="Área">
              <Choice pressed={state.subjectId == null} onClick={() => setState((prev) => selectSubject(prev, null))}>
                Todas
              </Choice>
              {subjectIds.map((subjectId) => {
                const theme = getSubjectTheme(subjectId)
                return (
                  <Choice
                    key={subjectId}
                    pressed={state.subjectId === subjectId}
                    onClick={() => setState((prev) => selectSubject(prev, subjectId))}
                  >
                    <span
                      className="subject-dot"
                      style={{ '--subject-color': theme.color } as CSSProperties}
                      aria-hidden
                    />
                    {theme.label}
                  </Choice>
                )
              })}
            </Field>

            {subtopics.length > 0 ? (
              <Field legend="Subtemas">
                <Choice pressed={state.subtopicIds.length === 0} onClick={() => update({ subtopicIds: [] })}>
                  Todos
                </Choice>
                {subtopics.map((subtopic) => (
                  <Choice
                    key={subtopic.id}
                    pressed={state.subtopicIds.includes(subtopic.id)}
                    onClick={() => setState((prev) => toggleSubtopic(prev, subtopic.id))}
                  >
                    {subtopic.label}
                  </Choice>
                ))}
              </Field>
            ) : null}

            <Field legend="Dificultad">
              <Choice pressed={state.difficulty == null} onClick={() => update({ difficulty: null })}>
                Cualquiera
              </Choice>
              {PRACTICE_DIFFICULTIES.map((difficulty) => (
                <Choice
                  key={difficulty}
                  pressed={state.difficulty === difficulty}
                  onClick={() => update({ difficulty })}
                >
                  {DIFFICULTY_LABELS[difficulty]}
                  {counts != null ? (
                    <span className="builder-count">{counts.byDifficulty[difficulty]}</span>
                  ) : null}
                </Choice>
              ))}
            </Field>

            <Field legend="Preguntas">
              {PRACTICE_SOURCES.map((source) => (
                <Choice key={source} pressed={state.source === source} onClick={() => update({ source })}>
                  {SOURCE_LABELS[source]}
                </Choice>
              ))}
            </Field>

            <Field legend="Cuántas">
              {COUNT_OPTIONS.map((count) => (
                <Choice key={count} pressed={state.count === count} onClick={() => update({ count })}>
                  {count}
                </Choice>
              ))}
            </Field>

            <Field legend="Reloj">
              <Choice pressed={!state.timed} onClick={() => update({ timed: false })}>
                Sin reloj
              </Choice>
              <Choice pressed={state.timed} onClick={() => update({ timed: true })}>
                <Clock3 size={13} aria-hidden />
                Con reloj · {formatTimeLimit(state.count * MS_PER_QUESTION)}
              </Choice>
            </Field>

            <Field
              legend="Respuestas"
              help={
                state.feedbackMode === 'inmediata'
                  ? 'Compruebas cada respuesta y ves la explicación en el momento.'
                  : 'Como en el examen: ves las respuestas al entregar.'
              }
            >
              <Choice
                pressed={state.feedbackMode === 'inmediata'}
                onClick={() => update({ feedbackMode: 'inmediata' })}
              >
                Inmediata
              </Choice>
              <Choice
                pressed={state.feedbackMode === 'al_final'}
                onClick={() => update({ feedbackMode: 'al_final' })}
              >
                Al final
              </Choice>
            </Field>
          </div>

          <div className="builder-foot">
            <p className="builder-available" aria-live="polite">
              {counts != null ? availableLabel(counts.available) : 'Contando preguntas…'}
            </p>
            {status.message != null ? <p className="builder-note">{status.message}</p> : null}
            {error != null ? (
              <div className="stage-alert" role="alert">
                {error}
              </div>
            ) : null}
            <button
              type="button"
              className="btn-primary builder-start"
              disabled={!status.canStart || disabled}
              onClick={() => onStart(builderSessionArgs(state))}
            >
              <Play size={16} aria-hidden />
              {isStarting ? 'Empezando…' : `Empezar · ${state.count} preguntas`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
