import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { pilotSurveyCsv } from '../../lib/pilot-survey-csv.ts'
import { PageLoader } from '../FullScreenLoader.tsx'

type PilotStep = FunctionReturnType<typeof api.measurement.getPilotFunnel>['steps'][number]['key']

const STEP_LABEL: Record<PilotStep, string> = {
  signedUp: 'Se registraron',
  consented: 'Aceptaron los términos',
  onboarded: 'Terminaron la bienvenida',
  diagnosed: 'Hicieron el diagnóstico',
  practiced: 'Hicieron una práctica',
  active2Days: 'Activos 2 días',
  active7Days: 'Activos 7 días',
}

const percent = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((part / whole) * 100)} %`)

type Return = { eligible: number; returned: number; rate: number | null }
const returnText = ({ eligible, returned }: Return) =>
  eligible === 0 ? 'Aún nadie llega a ese día' : `${returned} de ${eligible} (${percent(returned, eligible)})`

const perWeek = (value: number | null) => (value == null ? '—' : value.toFixed(1))

/** The pilot in numbers: the funnel, who comes back, the reminder emails and how classes use it. */
export function PilotPanel() {
  const funnelQuery = useQuery(convexQuery(api.measurement.getPilotFunnel, {}))
  const engagementQuery = useQuery(convexQuery(api.measurement.getEngagementMetrics, {}))
  const funnel = funnelQuery.data
  const engagement = engagementQuery.data

  return (
    <section aria-labelledby="pilot-title">
      <h1 id="pilot-title" className="page-title">Piloto</h1>
      <p className="page-lede">Cada paso cuenta a los estudiantes que llegaron a él; el equipo de Aprendo no entra en las cuentas.</p>

      {funnel == null || engagement == null ? (
        <PageLoader message="Cargando el piloto…" />
      ) : (
        <>
          <div className="ruled-section">
            <h2 className="section-title">Embudo</h2>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Paso</th>
                    <th scope="col" className="is-number">Estudiantes</th>
                    <th scope="col" className="is-number">De los registrados</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.steps.map((step) => (
                    <tr key={step.key}>
                      <th scope="row">{STEP_LABEL[step.key]}</th>
                      <td className="is-number">{step.count}</td>
                      <td className="is-number">{percent(step.count, funnel.steps[0]?.count ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ruled-section">
            <h2 className="section-title">Regreso después de la primera sesión</h2>
            <table className="data-table">
              <tbody>
                <tr>
                  <th scope="row">Al día siguiente</th>
                  <td className="is-number">{returnText(funnel.d1Return)}</td>
                </tr>
                <tr>
                  <th scope="row">A los 7 días</th>
                  <td className="is-number">{returnText(funnel.d7Return)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="ruled-section">
            <h2 className="section-title">Correos de recordatorio</h2>
            <p className="m-0 text-sm tabular-nums">
              {funnel.reminders.sent} enviados · {funnel.reminders.clicked} abiertos desde el enlace ({percent(funnel.reminders.clicked, funnel.reminders.sent)})
            </p>
          </div>

          <div className="ruled-section">
            <h2 className="section-title">Uso por semana</h2>
            <p className="page-lede">Todas las cuentas. Regreso a los 7 días: {returnText(engagement.day7Return)}.</p>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Semana del</th>
                    <th scope="col" className="is-number">Sesiones</th>
                    <th scope="col" className="is-number">Estudiantes activos</th>
                    <th scope="col" className="is-number">Sesiones por estudiante</th>
                  </tr>
                </thead>
                <tbody>
                  {engagement.weeklySessions.map((week) => (
                    <tr key={week.weekStartMs}>
                      <th scope="row">{new Date(week.weekStartMs).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })}</th>
                      <td className="is-number">{week.sessions}</td>
                      <td className="is-number">{week.activeStudents}</td>
                      <td className="is-number">{week.sessionsPerActiveStudent.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ruled-section">
            <h2 className="section-title">Cursos</h2>
            {engagement.classes.length === 0 ? (
              <p className="m-0 text-sm text-[var(--text-tertiary)]">Aún no hay cursos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Curso</th>
                      <th scope="col">Colegio</th>
                      <th scope="col" className="is-number">Estudiantes</th>
                      <th scope="col" className="is-number">Cuartil menos activo, últimas 4 semanas</th>
                      <th scope="col" className="is-number">4 semanas antes</th>
                      <th scope="col">Liga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagement.classes.map((classGroup) => (
                      <tr key={classGroup.classGroupId}>
                        <th scope="row">{classGroup.name}</th>
                        <td>{classGroup.organizationName}</td>
                        <td className="is-number">{classGroup.studentCount}</td>
                        <td className="is-number">{perWeek(classGroup.bottomQuartile.recent)}</td>
                        <td className="is-number">{perWeek(classGroup.bottomQuartile.previous)}</td>
                        <td>{classGroup.schoolLeagueEnabled && !classGroup.classLeagueOff ? 'Activa' : 'Apagada'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="m-0 mt-2 text-xs text-[var(--text-tertiary)]">Sesiones por semana del cuarto menos activo de cada curso.</p>
          </div>

          <SurveySummary />
        </>
      )}
    </section>
  )
}

const whole = (value: number | null) => (value == null ? '—' : String(Math.round(value)))

function downloadCsv(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** The pilot survey (`pilotSurvey.summary`), question by question, and the raw answers as a CSV. */
function SurveySummary() {
  const summary = useQuery(convexQuery(api.pilotSurvey.summary, {})).data
  const responses = useQuery(convexQuery(api.pilotSurvey.listResponses, {})).data

  return (
    <div className="ruled-section" aria-labelledby="pilot-survey-title">
      <h2 id="pilot-survey-title" className="section-title">Encuesta</h2>
      {summary == null ? (
        <PageLoader message="Cargando la encuesta…" />
      ) : summary.total === 0 ? (
        <p className="m-0 text-sm text-[var(--text-tertiary)]">Todavía nadie ha respondido la encuesta.</p>
      ) : (
        <>
          <p className="m-0 text-sm tabular-nums">
            {summary.total} respuestas · NPS: {whole(summary.nps)} · Muy decepcionados (Sean Ellis): {whole(summary.seanEllis)} %
          </p>
          <button
            type="button"
            className="btn-secondary mt-3"
            disabled={responses == null}
            onClick={() => downloadCsv(`aprendo-encuesta-${new Date().toISOString().slice(0, 10)}.csv`, pilotSurveyCsv(responses ?? []))}
          >
            Descargar CSV
          </button>
          {summary.questions.map((question, index) => (
            <div key={question.id} className="mt-6">
              <h3 className="m-0 text-base font-semibold">{index + 1}. {question.text}</h3>
              <p className="m-0 mt-1 text-sm text-[var(--text-secondary)] tabular-nums">
                {question.answered} de {summary.total} respondieron
                {question.mean == null ? '' : ` · Promedio: ${question.mean.toFixed(1)}`}
              </p>
              {question.kind === 'text' ? (
                question.texts.length === 0 ? null : (
                  <ul className="ruled-list mt-2">
                    {question.texts.map((entry) => (
                      <li key={`${entry.submittedAt}-${entry.text}`} className="ruled-row">
                        <span className="ruled-row-main">
                          <span>{entry.text}</span>
                          <span className="ruled-row-note">
                            {new Date(entry.submittedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <table className="data-table mt-2">
                  <tbody>
                    {question.counts.map((entry) => (
                      <tr key={entry.value}>
                        <th scope="row">{entry.label}</th>
                        <td className="is-number">{entry.count}</td>
                        <td className="is-number">{percent(entry.count, question.answered)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
