import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { useState } from 'react'
import { readConvexError } from '../lib/convex-error.ts'
import { api } from '@aprendo/convex/api'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { belowShareLabel, studentDisplayName } from '../lib/teacher-display.ts'

const formatDay = (ms: number) => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const accuracyCell = (accuracy: number | null) => (accuracy == null ? 'sin datos' : `${Math.round(accuracy * 100)}%`)

/**
 * The two-week teaching cycle (F42): measure, teach, practise, measure again.
 * Starting one freezes the week plan; during it the teacher edits the groups
 * (F39); at any point the table says how many were below Familiar then and now.
 */
export function ClassCycle({ classGroupId, canWrite }: { classGroupId: string; canWrite: boolean }) {
  const cycle = useQuery(convexQuery(api.teacher.getCurrentCycle, { classGroupId: classGroupId as never }))
  const comparison = useQuery(convexQuery(api.schoolTests.getCycleRoundComparison, { classGroupId: classGroupId as never }))
  const start = useMutation({ mutationFn: useConvexMutation(api.teacher.startCycle) })
  const setGroup = useMutation({ mutationFn: useConvexMutation(api.teacher.setCycleGroup) })
  // Restarting mid-cycle drops its baseline and the group edits: two steps, not one click.
  const [confirmRestart, setConfirmRestart] = useState(false)

  const startButton = (label: string, needsConfirm = false) => (
    <>
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={start.isPending}
        onClick={() => {
          if (needsConfirm && !confirmRestart) return setConfirmRestart(true)
          setConfirmRestart(false)
          start.mutate({ classGroupId: classGroupId as never })
        }}
      >
        {start.isPending
          ? 'Empezando…'
          : needsConfirm && confirmRestart
            ? 'Sí, reiniciar: se pierden el punto de partida y los grupos'
            : label}
      </button>
      {needsConfirm && confirmRestart ? (
        <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmRestart(false)}>
          Cancelar
        </button>
      ) : null}
      {start.error != null || setGroup.error != null ? (
        <p role="alert" className="notice is-danger">
          {readConvexError(start.error ?? setGroup.error, 'No se pudo guardar el ciclo.')}
        </p>
      ) : null}
    </>
  )

  if (cycle.isPending) return null
  if (cycle.isError) {
    return <p role="alert" className="notice is-danger">{readConvexError(cycle.error, 'No pudimos cargar el ciclo del curso.')}</p>
  }
  const data = cycle.data
  const compared = comparison.data
  return (
    <section className="ruled-section" aria-labelledby="class-cycle-title">
      <h2 id="class-cycle-title" className="section-title">Ciclo de enseñanza</h2>
      {data == null ? (
        <>
          <p className="text-sm text-[var(--text-secondary)]">
            Dos semanas: enseñas los temas de arriba, el curso practica y al final ves cuántos siguen por debajo de
            Familiar. Empezarlo congela el plan de hoy como punto de partida.
          </p>
          {canWrite ? startButton('Empezar un ciclo de 2 semanas') : null}
        </>
      ) : (
        <>
          <p className="text-sm text-[var(--text-secondary)]">
            {data.isOver ? 'Terminó el' : 'Va del'} {formatDay(data.startedAt)} al {formatDay(data.endsAt)}.
            {data.isOver ? ' Así cambió el curso:' : ' Por debajo de Familiar, al empezar y hoy:'}
          </p>
          {data.progress.length > 0 ? (
            <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tema</th>
                  <th>Para</th>
                  <th className="is-number">Al empezar</th>
                  <th className="is-number">Hoy</th>
                </tr>
              </thead>
              <tbody>
                {data.progress.map((row) => (
                  <tr key={row.subtopicId}>
                    <td>{getSubtopicLabel(row.subtopicId)}</td>
                    <td>{row.tier === 'curso' ? 'Todo el curso' : 'Grupo'}</td>
                    <td className="is-number">{belowShareLabel(row.before)}</td>
                    <td className="is-number">{belowShareLabel(row.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">Este ciclo empezó sin temas pendientes para el curso.</p>
          )}

          {data.groups.map((group) => {
            const memberIds = new Set(group.students.map((student) => student.studentId))
            const others = data.classStudents.filter((student) => !memberIds.has(student.studentId))
            const save = (studentIds: string[]) =>
              setGroup.mutate({ cycleId: data.cycleId, subtopicId: group.subtopicId, studentIds: studentIds as never })
            return (
              <div key={group.subtopicId} className="mt-4">
                <p className="m-0 text-sm font-semibold">Grupo · {getSubtopicLabel(group.subtopicId)}</p>
                <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">
                  {group.students.map((student) => (
                    <li key={student.studentId} className={`chip${canWrite ? ' chip-removable' : ''}`}>
                      <span className="min-w-0 truncate" title={studentDisplayName({ name: student.name ?? null, email: student.email ?? '' })}>
                        {studentDisplayName({ name: student.name ?? null, email: student.email ?? '' })}
                      </span>
                      {canWrite ? (
                        <button
                          type="button"
                          className="tutor-icon-btn chip-remove"
                          aria-label={`Quitar a ${studentDisplayName({ name: student.name ?? null, email: student.email ?? '' })} del grupo`}
                          onClick={() => save([...memberIds].filter((id) => id !== student.studentId))}
                        >
                          <X size={12} aria-hidden />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {canWrite && others.length > 0 ? (
                  <select
                    className="input mt-2"
                    value=""
                    aria-label="Agregar al grupo"
                    onChange={(event) => save([...memberIds, event.target.value])}
                  >
                    <option value="">Agregar al grupo…</option>
                    {others.map((student) => (
                      <option key={student.studentId} value={student.studentId}>
                        {studentDisplayName(student)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            )
          })}

          {data.actions.length > 0 ? (
            <div className="mt-4">
              <p className="m-0 text-sm font-semibold">Plan de mejora</p>
              <ul className="ruled-list">
                {data.actions.map((action) => (
                  <li key={action.subtopicId} className="ruled-row">
                    <span className="ruled-row-main">
                      <span>{action.text}</span>
                      <span className="ruled-row-note">Para el {formatDay(action.dueAt)}</span>
                    </span>
                    <Link
                      to="/teacher/guia/$subtopicId"
                      params={{ subtopicId: action.subtopicId }}
                      search={{ curso: classGroupId }}
                      className="btn-ghost btn-sm no-underline"
                    >
                      Guía de clase
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {compared != null ? (
            <div className="mt-4 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Acierto por tema</th>
                    <th className="is-number">{compared.title}</th>
                    <th className="is-number">{compared.nextTitle ?? 'Siguiente ronda'}</th>
                  </tr>
                </thead>
                <tbody>
                  {compared.rows.map((row) => (
                    <tr key={row.subtopicId}>
                      <td>{getSubtopicLabel(row.subtopicId)}</td>
                      <td className="is-number">{accuracyCell(row.before)}</td>
                      <td className="is-number">{compared.nextClosed ? accuracyCell(row.after) : 'Pendiente'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {canWrite ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {startButton(data.isOver ? 'Empezar el siguiente ciclo' : 'Reiniciar el ciclo con el plan de hoy', !data.isOver)}
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
