import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import type { FunctionReturnType } from 'convex/server'
import type { CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { getCompetenciaLabel, getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { PageLoader } from './FullScreenLoader.tsx'
import { MarkdownBlock } from './MarkdownBlock.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { weakestCompetencies } from '../lib/progress-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'

type CompetencyRow = FunctionReturnType<typeof api.teacher.getCompetencyReport>[number]
type IcfesRow = FunctionReturnType<typeof api.teacher.getClassCompetencias>[number]

/** Below this many answers a competencia percentage would be noise. */
const MIN_COMPETENCIA_ANSWERS = 10

export type MissedQuestion = {
  questionId: string
  subtopicId: string | null
  answered: number
  wrong: number
  revealedCount: number
  topWrongOption: string
  topWrongCount: number
  correctOption: string | null
  stem: string
  options: { label: string; bodyMarkdown: string }[]
}

/**
 * The class's weak spots in one place: by topic, by official competencia and
 * the questions it misses most. A query that failed says so; only a query that
 * answered with nothing may say there is nothing.
 */
export function ClassWeakSpots({
  classGroupId,
  items,
  itemsError,
}: {
  classGroupId: string
  items: MissedQuestion[]
  itemsError: unknown
}) {
  const topics = useQuery(convexQuery(api.teacher.getCompetencyReport, { classGroupId: classGroupId as never }))
  const competencias = useQuery(convexQuery(api.teacher.getClassCompetencias, { classGroupId: classGroupId as never }))

  return (
    <section className="ruled-section" aria-labelledby="weak-spots-title">
      <h2 id="weak-spots-title" className="section-title">Puntos débiles del curso</h2>

      <h3 className="m-0 mb-2 text-sm font-semibold">Por tema</h3>
      {topics.isError ? (
        <p role="alert" className="notice is-danger">{readConvexError(topics.error, 'No pudimos cargar los temas del curso.')}</p>
      ) : topics.isPending ? (
        <PageLoader message="Calculando temas…" />
      ) : topics.data.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">Sin respuestas aún.</p>
      ) : (
        <TopicBars rows={weakestCompetencies(topics.data)} />
      )}

      {competencias.isError ? (
        <p role="alert" className="notice is-danger mt-4">{readConvexError(competencias.error, 'No pudimos cargar las competencias.')}</p>
      ) : (competencias.data ?? []).length > 0 ? (
        <IcfesCompetencias rows={competencias.data!} />
      ) : null}

      {itemsError != null ? (
        <p role="alert" className="notice is-danger mt-4">{readConvexError(itemsError, 'No pudimos cargar las preguntas más falladas.')}</p>
      ) : items.length > 0 ? (
        <div className="mt-5">
          <h3 className="m-0 mb-1 text-sm font-semibold">Más falladas</h3>
          <MissedQuestions items={items} />
        </div>
      ) : null}
    </section>
  )
}

function TopicBars({ rows }: { rows: CompetencyRow[] }) {
  return (
    <ul className="area-chart-rows">
      {rows.map((row) => {
        const percent = Math.round(row.accuracy * 100)
        return (
          <li
            key={row.subtopicId}
            className="area-chart-row"
            style={{ '--subject-color': getSubjectTheme(row.subjectId).color } as CSSProperties}
          >
            <span className="area-chart-label is-topic">
              <span aria-hidden className="subject-dot" />
              <span className="min-w-0">
                <span className="block truncate" title={getSubtopicLabel(row.subtopicId)}>{getSubtopicLabel(row.subtopicId)}</span>
                <span className="area-chart-score">{getSubjectLabel(row.subjectId)}</span>
              </span>
            </span>
            <span className="area-chart-track" role="img" aria-label={`${percent}% de aciertos`}>
              <span className={`area-chart-fill is-ink${row.accuracy < 0.5 ? ' is-low' : ''}`} style={{ width: `${percent}%` }} />
            </span>
            <span className={`area-chart-level${row.accuracy < 0.5 ? ' is-low' : ''}`}>
              <strong>{percent}%</strong>
              <span className="area-chart-score">
                {row.studentCount} {row.studentCount === 1 ? 'estudiante' : 'estudiantes'}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** In the words of the school's Informe por Colegio; a thin competencia says so instead of claiming a percentage. */
function IcfesCompetencias({ rows }: { rows: IcfesRow[] }) {
  const subjectIds = [...new Set(rows.map((row) => row.subjectId))]
  return (
    <div className="mt-5">
      <h3 className="m-0 mb-2 text-sm font-semibold">Por competencia ICFES</h3>
      {subjectIds.map((subjectId) => (
        <div key={subjectId} className="mb-4">
          <p className="m-0 mb-1 text-sm text-[var(--text-secondary)]">{getSubjectLabel(subjectId)}</p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <tbody>
                {rows.filter((row) => row.subjectId === subjectId).map((row) => (
                  <tr key={row.competencia}>
                    <td>{getCompetenciaLabel(row.competencia)}</td>
                    <td className="is-number">
                      {row.answered < MIN_COMPETENCIA_ANSWERS
                        ? `— · ${row.answered} respuestas`
                        : `${Math.round((row.correct / row.answered) * 100)}% · ${row.answered} respuestas`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Each question open to its stem and options; used for a class and for a round. */
export function MissedQuestions({ items }: { items: MissedQuestion[] }) {
  return (
    <ul className="ruled-list">
      {items.map((item) => (
        <li key={item.questionId} className="ruled-row">
          <details className="ruled-row-main item-analysis">
            <summary>
              <span className="font-semibold">
                {item.subtopicId != null ? getSubtopicLabel(item.subtopicId) : 'Pregunta'}
              </span>{' '}
              <span className="ruled-row-note">
                {item.wrong}/{item.answered} fallaron · {item.topWrongCount} eligieron {item.topWrongOption}
                {item.correctOption != null ? ` · correcta: ${item.correctOption}` : ''}
                {item.revealedCount > 0 ? ` · ${item.revealedCount} vieron la respuesta` : ''}
              </span>
            </summary>
            <MarkdownBlock markdown={item.stem} />
            <ul className="item-analysis-options">
              {item.options.map((option) => (
                <li
                  key={option.label}
                  className={option.label === item.correctOption ? 'is-correct' : option.label === item.topWrongOption ? 'is-trap' : undefined}
                >
                  <strong>{option.label})</strong> <MarkdownBlock markdown={option.bodyMarkdown} />
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  )
}
