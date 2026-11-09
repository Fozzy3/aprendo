import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { getSubjectLabel } from '@aprendo/convex/taxonomy'
import { MissedQuestions } from './ClassWeakSpots.tsx'
import { readConvexError } from '../lib/convex-error.ts'

const formatDay = (ms: number) => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

type AreaResult = { subjectId: string; accuracy: number; questionCount: number }

export function AreaResults({ areas }: { areas: AreaResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <tbody>
          {areas.map((area) => (
            <tr key={area.subjectId}>
              <td>{getSubjectLabel(area.subjectId)}</td>
              <td className={`is-number${area.accuracy < 0.5 ? ' is-low' : ''}`}>{Math.round(area.accuracy * 100)}% de acierto</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A closed round's report for one class: its areas and what it missed most (F67). */
export function ClassRoundDetail({ classGroupId, schoolTestId }: { classGroupId: string; schoolTestId: string }) {
  const detail = useQuery(convexQuery(api.schoolTests.getClassRoundDetail, {
    classGroupId: classGroupId as never,
    schoolTestId: schoolTestId as never,
  }))
  if (detail.isError) {
    return <p role="alert" className="notice is-danger">{readConvexError(detail.error, 'No pudimos cargar el informe de la ronda.')}</p>
  }
  if (detail.data == null || detail.data.items.length === 0) return null
  return (
    <div className="mt-4">
      <h3 className="m-0 mb-1 text-sm font-semibold">Las preguntas que más falló el curso</h3>
      <MissedQuestions items={detail.data.items} />
    </div>
  )
}

/**
 * The school's rounds as this class lived them (F67, F68): who sat each one,
 * the results once it closes and, from them, the improvement plan.
 */
export function ClassRounds({ classGroupId, canWrite }: { classGroupId: string; canWrite: boolean }) {
  const rounds = useQuery(convexQuery(api.schoolTests.listClassRounds, { classGroupId: classGroupId as never }))
  const generate = useMutation({ mutationFn: useConvexMutation(api.schoolTests.generateImprovementPlan) })
  const [chosenId, setChosenId] = useState<string | null>(null)

  if (rounds.isError) {
    return <p role="alert" className="notice is-danger">{readConvexError(rounds.error, 'No pudimos cargar las pruebas del colegio.')}</p>
  }
  if (rounds.data == null || rounds.data.length === 0) return null
  const shownId = chosenId ?? rounds.data.find((round) => round.isClosed)?.schoolTestId ?? null
  const shown = rounds.data.find((round) => round.schoolTestId === shownId)

  return (
    <section className="ruled-section" aria-labelledby="class-rounds-title">
      <h2 id="class-rounds-title" className="section-title">Pruebas del colegio</h2>
      <ul className="ruled-list">
        {rounds.data.map((round) => (
          <li key={round.schoolTestId} className="ruled-row">
            <span className="ruled-row-main">
              <span className="font-semibold">{round.title}</span>
              <span className="ruled-row-note">
                Del {formatDay(round.opensAt)} al {formatDay(round.closesAt)} · {round.doneCount} de {round.targetCount} la presentaron
                {round.isClosed ? '' : ' · los resultados salen al cerrar'}
              </span>
            </span>
            {round.isClosed ? (
              <span className="flex shrink-0 flex-wrap gap-2">
                {round.schoolTestId !== shownId ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setChosenId(round.schoolTestId)}>
                    Ver resultados
                  </button>
                ) : null}
                {canWrite && !round.hasPlan ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={generate.isPending}
                    onClick={() => generate.mutate({ classGroupId: classGroupId as never, schoolTestId: round.schoolTestId })}
                  >
                    Generar plan
                  </button>
                ) : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {generate.error != null ? (
        <p role="alert" className="notice is-danger">{readConvexError(generate.error, 'No se pudo generar el plan.')}</p>
      ) : null}
      {shown != null ? (
        <div className="mt-4">
          <h3 className="m-0 mb-2 text-sm font-semibold">{shown.title}</h3>
          <AreaResults areas={shown.areas} />
          <ClassRoundDetail classGroupId={classGroupId} schoolTestId={shown.schoolTestId} />
        </div>
      ) : null}
    </section>
  )
}
