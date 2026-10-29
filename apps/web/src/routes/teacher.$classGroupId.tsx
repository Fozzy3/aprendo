import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Copy, Printer } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { getCompetenciaLabel, getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { getCareerFamily } from '@aprendo/convex/careers'
import { ClassAssignments, ClassWeekPlan } from '../components/ClassWeekPlan.tsx'
import { ClassCycle } from '../components/ClassCycle.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { levelDistribution, weakestCompetencies } from '../lib/progress-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { lastActivityLabel, studentDisplayName } from '../lib/teacher-display.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

export const Route = createFileRoute('/teacher/$classGroupId')({
  component: ClassOverviewPage,
})

/**
 * One class, for its teacher: the code to invite students, who needs attention
 * and why, every student's level per area with its evidence, and the
 * competencies the class gets wrong. No number without evidence: an area
 * without enough answers shows a dash, never a guess.
 */
function ClassOverviewPage() {
  const { classGroupId } = Route.useParams()
  const session = useSignedIn()
  const overviewQuery = useQuery({
    ...convexQuery(api.teacher.getClassOverview, { classGroupId: classGroupId as never }),
    enabled: session != null,
  })
  const competencyQuery = useQuery({
    ...convexQuery(api.teacher.getCompetencyReport, { classGroupId: classGroupId as never }),
    enabled: session != null,
  })
  const competenciasQuery = useQuery({
    ...convexQuery(api.teacher.getClassCompetencias, { classGroupId: classGroupId as never }),
    enabled: session != null,
  })
  const planQuery = useQuery({
    ...convexQuery(api.teacher.getClassTeachingPlan, { classGroupId: classGroupId as never }),
    enabled: session != null,
  })
  if (session == null) return <FullScreenLoader />

  const overview = overviewQuery.data
  const now = Date.now()

  return (
    <StaffShell active="classes">
      <div className="report-actions">
        <Link to="/teacher" className="back-link no-underline">
          <ArrowLeft size={14} aria-hidden /> Tus cursos
        </Link>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          <Printer size={14} aria-hidden /> Imprimir
        </button>
      </div>

      {overviewQuery.isPending ? (
        <PageLoader message="Cargando el curso…" />
      ) : overviewQuery.isError || overview == null ? (
        <EmptyState title="No pudimos abrir este curso">
          {readConvexError(overviewQuery.error, 'Puede que ya no tengas acceso a él.')}
        </EmptyState>
      ) : (
        <div className="ruled-page">
          <aside className="ruled-page-margin" aria-label="Datos del curso">
            <p className="ruled-page-date">{overview.organization.name}</p>
            <dl className="margin-facts">
              <div>
                <dt>Estudiantes</dt>
                <dd>{overview.students.length}</dd>
              </div>
              <div>
                <dt>Necesitan atención</dt>
                <dd>{overview.students.filter((student) => student.riskReasons.length > 0).length}</dd>
              </div>
            </dl>
            <InviteCode code={overview.classGroup.inviteCode} />
          </aside>

          <div className="ruled-page-body">
            <header className="ruled-page-head">
              <h1 className="page-title">{overview.classGroup.name}</h1>
              <p className="page-lede">Grado {overview.classGroup.grade}</p>
              {!overview.organization.licenseActive ? (
                <p role="status" className="notice is-danger">
                  La licencia del colegio venció: nadie puede unirse a este curso hasta que se renueve. Los
                  datos del curso siguen aquí.
                </p>
              ) : null}
            </header>

            {overview.students.length === 0 ? (
              <EmptyState title="Este curso aún no tiene estudiantes">
                Comparte el código del curso ({overview.classGroup.inviteCode}). Cada estudiante crea su cuenta
                en Aprendo y lo escribe en «Unirme a un curso».
              </EmptyState>
            ) : (
              <>
                {planQuery.data != null ? (
                  <ClassWeekPlan plan={planQuery.data} now={now} classGroupId={classGroupId} />
                ) : planQuery.isError ? (
                  <p role="alert" className="notice is-danger">
                    {readConvexError(planQuery.error, 'No pudimos armar el plan de la semana.')}
                  </p>
                ) : (
                  <PageLoader message="Armando la semana…" />
                )}
                <ClassLevelsChart overview={overview} />
                <StudentsGrid overview={overview} now={now} />
                <CompetencyBars rows={competencyQuery.data ?? []} isPending={competencyQuery.isPending} />
                <IcfesCompetencias rows={competenciasQuery.data ?? []} />
                <ClassAssignments classGroupId={classGroupId} />
                <ClassCycle classGroupId={classGroupId} />
              </>
            )}
          </div>
        </div>
      )}
    </StaffShell>
  )
}

type Overview = FunctionReturnType<typeof api.teacher.getClassOverview>
type CompetencyRow = FunctionReturnType<typeof api.teacher.getCompetencyReport>[number]

function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/join?codigo=${code}`
  return (
    <div className="invite-code">
      <p className="invite-code-label">Código para unirse</p>
      <p className="invite-code-value">{code}</p>
      <button
        type="button"
        className="btn-ghost invite-code-copy"
        onClick={() => {
          void navigator.clipboard.writeText(link).then(() => setCopied(true))
        }}
      >
        <Copy size={14} aria-hidden />
        {copied ? 'Enlace copiado' : 'Copiar enlace'}
      </button>
    </div>
  )
}

const LEVEL_NAMES = ['Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4']

/**
 * The class at a glance: per area, how many students sit at each ICFES level.
 * Level 1 is in the margin's red; the higher levels deepen the pen's blue; the
 * hatched part has not levelled yet.
 */
function ClassLevelsChart({ overview }: { overview: Overview }) {
  return (
    <section className="ruled-section" aria-labelledby="class-levels-title">
      <h2 id="class-levels-title" className="section-title">El curso por área</h2>
      <ul className="area-chart-rows">
        {overview.subjects.map((subject) => {
          const theme = getSubjectTheme(subject.subjectId)
          const spread = levelDistribution(overview.students, subject.subjectId)
          const segments = [
            ...spread.byLevel.map((count, index) => ({ key: `level-${index + 1}`, count, label: LEVEL_NAMES[index]! })),
            { key: 'level-none', count: spread.none, label: 'sin nivel' },
          ].filter((segment) => segment.count > 0)
          return (
            <li key={subject.subjectId} className="area-chart-row" style={{ '--subject-color': theme.color } as CSSProperties}>
              <span className="area-chart-label">
                <span aria-hidden className="subject-dot" />
                {theme.label}
              </span>
              <span
                className="level-stack"
                role="img"
                aria-label={`${theme.label}: ${segments.map((segment) => `${segment.count} ${segment.label}`).join(', ')}`}
              >
                {segments.map((segment) => (
                  <span
                    key={segment.key}
                    className={`level-stack-segment ${segment.key}`}
                    style={{ flexGrow: segment.count }}
                    title={`${segment.count} · ${segment.label}`}
                  >
                    {segment.count}
                  </span>
                ))}
              </span>
              <span className="area-chart-level">
                {subject.averageScore != null ? (
                  <>
                    <strong>{subject.averageScore}</strong>
                    <span className="area-chart-score">promedio</span>
                  </>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="area-chart-legend">
        {LEVEL_NAMES.map((name, index) => (
          <span key={name} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={`level-swatch level-${index + 1}`} />
            {name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="level-swatch level-none" />
          sin nivel aún
        </span>
      </p>
    </section>
  )
}

/** Every student and area as a grid of level chips: the pattern, not the prose. */
function StudentsGrid({ overview, now }: { overview: Overview; now: number }) {
  return (
    <section className="ruled-section" aria-labelledby="levels-title">
      <div className="section-head">
        <h2 id="levels-title" className="section-title">Cada estudiante</h2>
        <span className="section-meta">— : aún sin evidencia suficiente</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table level-grid">
          <thead>
            <tr>
              <th scope="col">Estudiante</th>
              {overview.subjects.map((subject) => (
                <th key={subject.subjectId} scope="col" className="level-grid-area">
                  <span
                    aria-hidden
                    className="subject-dot"
                    style={{ '--subject-color': getSubjectTheme(subject.subjectId).color } as CSSProperties}
                  />{' '}
                  {getSubjectLabel(subject.subjectId)}
                </th>
              ))}
              <th scope="col">Última práctica</th>
            </tr>
          </thead>
          <tbody>
            {overview.students.map((student) => (
              <tr key={student.studentId}>
                <th scope="row">
                  <Link to="/teacher/student/$studentId" params={{ studentId: student.studentId }}>
                    {studentDisplayName(student)}
                  </Link>
                  {/* The career the student studies for (meta de carrera). */}
                  {getCareerFamily(student.careerFamily) != null ? (
                    <span className="block text-xs font-normal text-[var(--text-tertiary)]">
                      {getCareerFamily(student.careerFamily)!.label}
                    </span>
                  ) : null}
                </th>
                {student.subjects.map((subject) => (
                  <td key={subject.subjectId} className="level-grid-cell">
                    {subject.levelLabel == null || subject.levelIndex == null ? (
                      <span className="text-[var(--text-tertiary)]" title={`${subject.attemptCount} respuestas en esta área`}>
                        —
                      </span>
                    ) : (
                      <span className={`level-chip level-${subject.levelIndex}`} title={`${subject.levelLabel} · ${subject.score}/100`}>
                        <span aria-hidden>{subject.levelIndex}</span>
                        <span className="sr-only">
                          {subject.levelLabel}, {subject.score} de 100
                        </span>
                      </span>
                    )}
                  </td>
                ))}
                <td className="text-[var(--text-secondary)]">{lastActivityLabel(student.lastActiveAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** The five competencies the class misses most, as bars of its accuracy. */
function CompetencyBars({ rows, isPending }: { rows: CompetencyRow[]; isPending: boolean }) {
  const weakest = weakestCompetencies(rows)
  return (
    <section className="ruled-section" aria-labelledby="competency-title">
      <h2 id="competency-title" className="section-title">Lo que más le cuesta al curso</h2>
      {isPending ? (
        <PageLoader message="Calculando competencias…" />
      ) : weakest.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">Todavía nadie del curso ha practicado temas.</p>
      ) : (
        <ul className="area-chart-rows">
          {weakest.map((row) => {
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
      )}
    </section>
  )
}

/**
 * The class per official ICFES competencia (F35), in the words of the school's
 * Informe por Colegio. Only tagged questions count, so a competencia with few
 * answers says so instead of claiming a percentage.
 */
function IcfesCompetencias({ rows }: { rows: FunctionReturnType<typeof api.teacher.getClassCompetencias> }) {
  if (rows.length === 0) return null
  const subjectIds = [...new Set(rows.map((row) => row.subjectId))]
  return (
    <section className="ruled-section" aria-labelledby="icfes-competencias-title">
      <h2 id="icfes-competencias-title" className="section-title">Por competencia ICFES</h2>
      {subjectIds.map((subjectId) => (
        <div key={subjectId} className="mb-4">
          <h3 className="m-0 mb-1 text-sm font-semibold">{getSubjectLabel(subjectId)}</h3>
          <div className="overflow-x-auto">
          <table className="data-table">
            <tbody>
              {rows.filter((row) => row.subjectId === subjectId).map((row) => (
                <tr key={row.competencia}>
                  <td>{getCompetenciaLabel(row.competencia)}</td>
                  <td className="is-number">
                    {row.answered < MIN_COMPETENCIA_ANSWERS
                      ? `${row.answered} respuestas: aún pocas`
                      : `${Math.round((row.correct / row.answered) * 100)}% de acierto · ${row.answered} respuestas`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}
    </section>
  )
}

/** Below this many answers a competencia percentage would be noise. */
const MIN_COMPETENCIA_ANSWERS = 10
