import { convexQuery } from '@convex-dev/react-query'
import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Copy, Printer } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { getCareerFamily } from '@aprendo/convex/careers'
import { ClassAssignments, ClassWeekPlan } from '../components/ClassWeekPlan.tsx'
import { ClassCycle } from '../components/ClassCycle.tsx'
import { ClassRounds } from '../components/ClassRounds.tsx'
import { ClassWeakSpots } from '../components/ClassWeakSpots.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { levelDistribution } from '../lib/progress-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { familyWeeklyMessage, guidedShareLabel, lastActivityLabel, studentDisplayName } from '../lib/teacher-display.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

type ClassTab = 'semana' | 'resultados' | 'plan'

const CLASS_TABS: { id: ClassTab; label: string }[] = [
  { id: 'semana', label: 'Esta semana' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'plan', label: 'Plan' },
]

export const Route = createFileRoute('/teacher/$classGroupId')({
  validateSearch: (search: Record<string, unknown>): { tab?: ClassTab } =>
    search.tab === 'resultados' || search.tab === 'plan' ? { tab: search.tab } : {},
  component: ClassOverviewPage,
})

/**
 * One class, for its teacher, in three tabs: what to do this week, how the
 * class is doing, and the plan it is working on. No number without evidence: an
 * area without enough answers shows a dash, never a guess.
 */
function ClassOverviewPage() {
  const { classGroupId } = Route.useParams()
  const tab = Route.useSearch().tab ?? 'semana'
  const session = useSignedIn()
  const overviewQuery = useQuery({
    ...convexQuery(api.teacher.getClassOverview, { classGroupId: classGroupId as never }),
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
                  La licencia del colegio venció: nadie puede unirse.
                </p>
              ) : null}
            </header>

            {overview.students.length === 0 ? (
              <EmptyState title="Este curso aún no tiene estudiantes">
                Comparte el código {overview.classGroup.inviteCode}.
              </EmptyState>
            ) : (
              <>
                <nav className="tab-nav mb-6" aria-label="Secciones del curso">
                  {CLASS_TABS.map(({ id, label }) => (
                    <Link
                      key={id}
                      to="/teacher/$classGroupId"
                      params={{ classGroupId }}
                      search={id === 'semana' ? {} : { tab: id }}
                      className={`tab-item${id === tab ? ' is-active' : ''}`}
                      aria-current={id === tab ? 'page' : undefined}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>

                {tab === 'semana' ? (
                  <>
                    <WeekActions
                      classGroupId={classGroupId}
                      className={overview.classGroup.name}
                      canWrite={overview.canWrite}
                      topics={(planQuery.data?.wholeClass ?? []).map((item) => getSubtopicLabel(item.subtopicId))}
                    />
                    {planQuery.data != null ? (
                      <ClassWeekPlan plan={planQuery.data} now={now} classGroupId={classGroupId} canWrite={overview.canWrite} />
                    ) : planQuery.isError ? (
                      <p role="alert" className="notice is-danger">
                        {readConvexError(planQuery.error, 'No pudimos armar el plan de la semana.')}
                      </p>
                    ) : (
                      <PageLoader message="Armando la semana…" />
                    )}
                  </>
                ) : tab === 'resultados' ? (
                  <>
                    <ClassLevelsChart overview={overview} />
                    <StudentsGrid overview={overview} now={now} classGroupId={classGroupId} />
                    <ClassWeakSpots
                      classGroupId={classGroupId}
                      items={planQuery.data?.items ?? []}
                      itemsError={planQuery.isError ? planQuery.error : null}
                    />
                    {planQuery.data != null && guidedShareLabel(planQuery.data.guided) != null ? (
                      <section className="ruled-section" aria-labelledby="guided-signal-title">
                        <h2 id="guided-signal-title" className="section-title">Estudio guiado</h2>
                        <p className="m-0 text-sm text-[var(--text-secondary)]">{guidedShareLabel(planQuery.data.guided)}.</p>
                      </section>
                    ) : null}
                  </>
                ) : (
                  <>
                    <ClassAssignments classGroupId={classGroupId} canWrite={overview.canWrite} />
                    <ClassCycle classGroupId={classGroupId} canWrite={overview.canWrite} />
                    <ClassRounds classGroupId={classGroupId} canWrite={overview.canWrite} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </StaffShell>
  )
}

type Overview = FunctionReturnType<typeof api.teacher.getClassOverview>

function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const link = typeof window === 'undefined' ? '' : `${window.location.origin}/join?codigo=${code}`
  return (
    <div className="invite-code">
      <p className="invite-code-label">Código</p>
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

/** Two things for the class this week that are not about one topic: the game and the note home. */
function WeekActions({
  classGroupId,
  className,
  canWrite,
  topics,
}: {
  classGroupId: string
  className: string
  canWrite: boolean
  topics: string[]
}) {
  const navigate = useNavigate()
  const openDuel = useMutation({
    mutationFn: useConvexMutation(api.duels.openDuel),
    onSuccess: (duelId: string) => navigate({ to: '/teacher/duelo/$id', params: { id: duelId } }),
  })
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {canWrite ? (
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={openDuel.isPending}
          onClick={() => openDuel.mutate({ classGroupId: classGroupId as never })}
        >
          {openDuel.isPending ? 'Abriendo…' : 'Iniciar duelo'}
        </button>
      ) : null}
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => {
          navigator.clipboard.writeText(familyWeeklyMessage({ className, topics })).then(
            () => setCopyState('copied'),
            () => setCopyState('failed'),
          )
        }}
      >
        {copyState === 'copied' ? 'Mensaje copiado' : copyState === 'failed' ? 'No se pudo copiar' : 'Copiar mensaje a familias'}
      </button>
      {openDuel.error != null ? (
        <p role="alert" className="notice is-danger w-full">{readConvexError(openDuel.error, 'No se pudo abrir el duelo.')}</p>
      ) : null}
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
          sin nivel
        </span>
      </p>
    </section>
  )
}

/** Every student and area as a grid of level chips: the pattern, not the prose. */
function StudentsGrid({ overview, now, classGroupId }: { overview: Overview; now: number; classGroupId: string }) {
  return (
    <section className="ruled-section" aria-labelledby="levels-title">
      <div className="section-head">
        <h2 id="levels-title" className="section-title">Cada estudiante</h2>
        <span className="section-meta">— sin evidencia</span>
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
                  <Link to="/teacher/student/$studentId" params={{ studentId: student.studentId }} search={{ curso: classGroupId }}>
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
