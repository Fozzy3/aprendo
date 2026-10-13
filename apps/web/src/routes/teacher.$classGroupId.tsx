import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Copy } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { MASTERY_LEVELS, MASTERY_LEVEL_LABELS } from '@aprendo/convex/mastery'
import { getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { EmptyState } from '../components/EmptyState.tsx'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'
import { MASTERY_LEVEL_COLOR } from '../components/MasteryBadge.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { lastActivityLabel, riskLabel, studentDisplayName } from '../lib/teacher-display.ts'
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
  if (session == null) return <FullScreenLoader />

  const overview = overviewQuery.data
  const now = Date.now()

  return (
    <StaffShell active="classes">
      <Link to="/teacher" className="back-link no-underline">
        <ArrowLeft size={14} aria-hidden /> Tus cursos
      </Link>

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
                <AtRisk students={overview.students} now={now} />
                <LevelsTable overview={overview} now={now} />
                <CompetencyTable rows={competencyQuery.data ?? []} isPending={competencyQuery.isPending} />
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

function AtRisk({ students, now }: { students: Overview['students']; now: number }) {
  const atRisk = students.filter((student) => student.riskReasons.length > 0)
  return (
    <section className="ruled-section" aria-labelledby="at-risk-title">
      <h2 id="at-risk-title" className="section-title">Necesitan atención</h2>
      {atRisk.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Nadie por ahora: todos están nivelados, practican y ninguno está en el nivel 1 de un área.
        </p>
      ) : (
        <ul className="ruled-list">
          {atRisk.map((student) => (
            <li key={student.studentId}>
              <Link
                to="/teacher/student/$studentId"
                params={{ studentId: student.studentId }}
                className="ruled-row no-underline"
              >
                <span className="ruled-row-main">
                  <span className="font-semibold">{studentDisplayName(student)}</span>
                  <span className="margin-note">{student.riskReasons.map(riskLabel).join(' · ')}</span>
                </span>
                <span className="ruled-row-note shrink-0">{lastActivityLabel(student.lastActiveAt, now)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LevelsTable({ overview, now }: { overview: Overview; now: number }) {
  return (
    <section className="ruled-section" aria-labelledby="levels-title">
      <div className="section-head">
        <h2 id="levels-title" className="section-title">Nivel por área</h2>
        <span className="section-meta">— : aún sin evidencia suficiente</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Estudiante</th>
              {overview.subjects.map((subject) => (
                <th key={subject.subjectId} scope="col">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="subject-dot"
                      style={{ '--subject-color': getSubjectTheme(subject.subjectId).color } as CSSProperties}
                    />
                    {getSubjectLabel(subject.subjectId)}
                  </span>
                </th>
              ))}
              <th scope="col">Última práctica</th>
            </tr>
          </thead>
          <tbody>
            <tr className="is-summary">
              <th scope="row">Promedio del curso</th>
              {overview.subjects.map((subject) => (
                <td key={subject.subjectId}>
                  {subject.averageScore == null ? (
                    '—'
                  ) : (
                    <>
                      <span className="tabular-nums">{subject.averageScore}</span>
                      <span className="cell-note">
                        {subject.levelledCount} con nivel{subject.lowLevelCount > 0 ? ` · ${subject.lowLevelCount} en nivel 1` : ''}
                      </span>
                    </>
                  )}
                </td>
              ))}
              <td />
            </tr>
            {overview.students.map((student) => (
              <tr key={student.studentId}>
                <th scope="row">
                  <Link to="/teacher/student/$studentId" params={{ studentId: student.studentId }}>
                    {studentDisplayName(student)}
                  </Link>
                </th>
                {student.subjects.map((subject) => (
                  <td key={subject.subjectId} className={subject.levelIndex === 1 ? 'is-low' : undefined}>
                    {subject.levelLabel == null ? (
                      <span title={`${subject.attemptCount} respuestas en esta área`}>—</span>
                    ) : (
                      <>
                        {subject.levelLabel}
                        <span className="cell-note tabular-nums">{subject.score}/100</span>
                      </>
                    )}
                  </td>
                ))}
                <td>{lastActivityLabel(student.lastActiveAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CompetencyTable({ rows, isPending }: { rows: CompetencyRow[]; isPending: boolean }) {
  return (
    <section className="ruled-section" aria-labelledby="competency-title">
      <h2 id="competency-title" className="section-title">Por competencia</h2>
      <p className="mb-3 text-sm text-[var(--text-secondary)]">
        De lo que el curso más falla a lo que mejor resuelve. Solo aparecen los temas que alguien ya practicó.
      </p>
      {isPending ? (
        <PageLoader message="Calculando competencias…" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">Todavía nadie del curso ha practicado temas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Tema</th>
                <th scope="col">Área</th>
                <th scope="col" className="is-number">Estudiantes</th>
                <th scope="col" className="is-number">Aciertos</th>
                <th scope="col">Dominio del curso</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.subtopicId}>
                  <th scope="row">{getSubtopicLabel(row.subtopicId)}</th>
                  <td>{getSubjectLabel(row.subjectId)}</td>
                  <td className="is-number">{row.studentCount}</td>
                  <td className={`is-number${row.accuracy < 0.5 ? ' is-low' : ''}`}>{Math.round(row.accuracy * 100)}%</td>
                  <td>
                    <MasterySpread counts={row.masteryCounts} total={row.studentCount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** How the students who practiced a subtopic spread over the mastery levels. */
function MasterySpread({ counts, total }: { counts: CompetencyRow['masteryCounts']; total: number }) {
  const levels = MASTERY_LEVELS.filter((level) => level !== 'sin_empezar' && counts[level] > 0)
  return (
    <span
      className="mastery-spread"
      role="img"
      aria-label={levels.map((level) => `${counts[level]} ${MASTERY_LEVEL_LABELS[level]}`).join(', ')}
    >
      {levels.map((level) => (
        <span
          key={level}
          title={`${counts[level]} · ${MASTERY_LEVEL_LABELS[level]}`}
          style={{ flexGrow: counts[level] / total, background: MASTERY_LEVEL_COLOR[level] }}
        />
      ))}
    </span>
  )
}
