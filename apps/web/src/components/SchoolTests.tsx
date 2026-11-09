import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { SCHOOL_GRADES, getSubjectLabel } from '@aprendo/convex/taxonomy'
import { ClassRoundDetail } from './ClassRounds.tsx'
import { PageLoader } from './FullScreenLoader.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { endOfDayFromInput } from '../lib/date-input.ts'

const formatDay = (ms: number) => new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
const percent = (accuracy: number) => `${Math.round(accuracy * 100)}%`
const DAY_MS = 86_400_000

type Round = FunctionReturnType<typeof api.schoolTests.listRounds>[number]

/** Pruebas: create the rounds, follow who sat them, read each one by class and area (F67). */
export function SchoolTests({ orgId }: { orgId: string }) {
  const rounds = useQuery(convexQuery(api.schoolTests.listRounds, { orgId: orgId as never }))
  const [chosenId, setChosenId] = useState<string | null>(null)

  return (
    <>
      <CreateRounds orgId={orgId} />
      <section className="ruled-section" aria-labelledby="rounds-title">
        <h2 id="rounds-title" className="section-title">Rondas</h2>
        {rounds.isPending ? (
          <PageLoader message="Cargando las pruebas…" />
        ) : rounds.isError ? (
          <p role="alert" className="notice is-danger">{readConvexError(rounds.error, 'No pudimos cargar las pruebas.')}</p>
        ) : rounds.data.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">Todavía no hay rondas. Cree la primera arriba.</p>
        ) : (
          <ul className="ruled-list">
            {rounds.data.map((round) => (
              <li key={round.schoolTestId} className="ruled-row">
                <span className="ruled-row-main">
                  <span className="font-semibold">{round.title}</span>
                  <span className="ruled-row-note">
                    Grados {round.grades.join(', ')} · del {formatDay(round.opensAt)} al {formatDay(round.closesAt)} ·{' '}
                    {statusNote(round)}
                  </span>
                </span>
                {round.hasOpened ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setChosenId(round.schoolTestId)}>
                    {round.isClosed ? 'Ver resultados' : 'Ver avance'}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {chosenId != null ? <RoundReport schoolTestId={chosenId} /> : null}
    </>
  )
}

export function statusNote(round: Round) {
  if (!round.hasOpened) return `${round.questionCount} preguntas, aún no abre`
  // The list only counts recent rounds; opening an older one shows its report.
  if (round.doneCount == null) return `${round.questionCount} preguntas`
  return `${round.doneCount} de ${round.targetCount} la presentaron`
}

function CreateRounds({ orgId }: { orgId: string }) {
  const create = useConvexMutation(api.schoolTests.createRounds)
  const [draft, setDraft] = useState({ title: '', firstDate: '', rounds: 4, weeksBetween: 4, grades: ['11'] })
  const mutation = useMutation({
    // A round opens at the start of its day in Colombia.
    mutationFn: () => create({
      orgId: orgId as never,
      title: draft.title,
      grades: draft.grades,
      firstOpensAt: endOfDayFromInput(draft.firstDate) + 1000 - DAY_MS,
      rounds: draft.rounds,
      weeksBetween: draft.weeksBetween,
    }),
    onSuccess: () => setDraft((current) => ({ ...current, title: '', firstDate: '' })),
  })
  const toggleGrade = (grade: string) =>
    setDraft((current) => ({
      ...current,
      grades: current.grades.includes(grade) ? current.grades.filter((item) => item !== grade) : [...current.grades, grade],
    }))

  return (
    <section className="ruled-section" aria-labelledby="new-rounds-title">
      <h2 id="new-rounds-title" className="section-title">Programar una prueba</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        Las rondas se crean de una vez, con la misma forma para todo el grado. Cada ronda queda abierta tres días y los
        resultados salen al cerrar.
      </p>
      <form
        className="form-grid"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <label className="field">
          <span>Nombre</span>
          <input className="input" required placeholder="Prueba periódica" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </label>
        <label className="field">
          <span>Abre la primera ronda</span>
          <input className="input" type="date" required value={draft.firstDate} onChange={(event) => setDraft({ ...draft, firstDate: event.target.value })} />
        </label>
        <label className="field">
          <span>Rondas</span>
          <input className="input" type="number" min={1} max={12} required value={draft.rounds} onChange={(event) => setDraft({ ...draft, rounds: Number(event.target.value) })} />
        </label>
        <label className="field">
          <span>Cada cuántas semanas</span>
          <select className="input" value={draft.weeksBetween} onChange={(event) => setDraft({ ...draft, weeksBetween: Number(event.target.value) })}>
            {[2, 4, 6, 8].map((weeks) => <option key={weeks} value={weeks}>{weeks} semanas</option>)}
          </select>
        </label>
        <fieldset className="field col-span-full m-0 border-0 p-0">
          <legend className="text-sm">Grados</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {SCHOOL_GRADES.map((grade) => (
              <label key={grade} className="inline-flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={draft.grades.includes(grade)} onChange={() => toggleGrade(grade)} />
                {grade}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="col-span-full">
          <button type="submit" className="btn-primary" disabled={mutation.isPending || draft.grades.length === 0}>
            {mutation.isPending ? 'Creando…' : 'Crear rondas'}
          </button>
        </div>
        {mutation.error != null ? (
          <p role="alert" className="notice is-danger col-span-full">{readConvexError(mutation.error, 'No se pudieron crear las rondas.')}</p>
        ) : null}
      </form>
    </section>
  )
}

/** One round: every class by area once it closes, and until then only who sat it. */
function RoundReport({ schoolTestId }: { schoolTestId: string }) {
  const report = useQuery(convexQuery(api.schoolTests.getRoundReport, { schoolTestId: schoolTestId as never }))
  const [detailClassId, setDetailClassId] = useState<string | null>(null)
  if (report.isPending) return <PageLoader message="Cargando el informe…" />
  if (report.isError) {
    return <p role="alert" className="notice is-danger">{readConvexError(report.error, 'No pudimos cargar el informe.')}</p>
  }
  const data = report.data
  return (
    <section className="ruled-section" aria-labelledby="round-report-title">
      <div className="section-head">
        <h2 id="round-report-title" className="section-title">{data.title}</h2>
        <button type="button" className="btn-secondary btn-sm" onClick={() => window.print()}>
          <Printer size={14} aria-hidden /> Imprimir
        </button>
      </div>
      {!data.isClosed ? (
        <p className="text-sm text-[var(--text-secondary)]">Los resultados salen cuando la ronda cierre, el {formatDay(data.closesAt)}.</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Curso</th>
              <th scope="col" className="is-number">Presentaron</th>
              {data.school.map((area) => <th key={area.subjectId} scope="col" className="is-number">{getSubjectLabel(area.subjectId)}</th>)}
              {data.isClosed ? <th scope="col"><span className="sr-only">Detalle</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {data.classes.map((row) => (
              <tr key={row.classGroupId}>
                <th scope="row">{row.name}</th>
                <td className="is-number">{row.doneCount} de {row.targetCount}</td>
                {data.school.map((area) => {
                  const result = row.areas.find((item) => item.subjectId === area.subjectId)
                  return (
                    <td key={area.subjectId} className={`is-number${result != null && result.accuracy < 0.5 ? ' is-low' : ''}`}>
                      {result == null ? '—' : percent(result.accuracy)}
                    </td>
                  )
                })}
                {data.isClosed ? (
                  <td>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setDetailClassId(row.classGroupId)}>
                      Preguntas
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
          {data.isClosed && data.school.length > 0 ? (
            <tfoot>
              <tr>
                <th scope="row">Colegio</th>
                <td />
                {data.school.map((area) => <td key={area.subjectId} className="is-number">{percent(area.accuracy)}</td>)}
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {detailClassId != null ? <ClassRoundDetail classGroupId={detailClassId} schoolTestId={schoolTestId} /> : null}
    </section>
  )
}
