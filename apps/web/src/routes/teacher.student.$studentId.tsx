import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { AreaLevelsChart } from '../components/AreaLevelsChart.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { areaChartRow } from '../lib/progress-display.ts'
import { studentProgressQuery } from '../lib/student-queries.ts'
import { guidedShareLabel, studentDisplayName } from '../lib/teacher-display.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

export const Route = createFileRoute('/teacher/student/$studentId')({
  validateSearch: (search: Record<string, unknown>): { curso?: string; colegio?: string } => ({
    ...(typeof search.curso === 'string' ? { curso: search.curso } : {}),
    ...(typeof search.colegio === 'string' ? { colegio: search.colegio } : {}),
  }),
  component: TeacherStudentPage,
})

/**
 * One student, as their teacher reads them: level per area with its evidence
 * and where it started, the estimated global score (or which areas are still
 * missing), the weakest subtopics and how regularly they practice. Read-only:
 * the backend lets a teacher see a student, never act for them.
 */
function TeacherStudentPage() {
  const { studentId } = Route.useParams()
  const { curso, colegio } = Route.useSearch()
  const session = useSignedIn()
  const progressQuery = useQuery({ ...studentProgressQuery(studentId), enabled: session != null })
  const activityQuery = useQuery({
    ...convexQuery(api.history.getActivitySummary, { studentId: studentId as never, weeks: 8 }),
    enabled: session != null,
  })
  const guidedQuery = useQuery({
    ...convexQuery(api.teacher.getStudentGuidedSignal, { studentId: studentId as never }),
    enabled: session != null,
  })
  if (session == null) return <FullScreenLoader />

  const progress = progressQuery.data
  const guidedLabel = guidedQuery.data == null ? null : guidedShareLabel(guidedQuery.data)
  const stats = activityQuery.data?.stats

  return (
    <StaffShell active="classes">
      <div className="report-actions">
        {/* A shared link has no history to go back to, so the page says where it came from. */}
        {curso != null ? (
          <Link to="/teacher/$classGroupId" params={{ classGroupId: curso }} search={{ tab: 'resultados' }} className="back-link no-underline">
            <ArrowLeft size={14} aria-hidden /> Volver al curso
          </Link>
        ) : colegio != null ? (
          <Link to="/school" search={{ colegio, tab: 'personas' }} className="back-link no-underline">
            <ArrowLeft size={14} aria-hidden /> Volver al colegio
          </Link>
        ) : (
          <Link to="/teacher" className="back-link no-underline">
            <ArrowLeft size={14} aria-hidden /> Tus cursos
          </Link>
        )}
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          <Printer size={14} aria-hidden /> Imprimir
        </button>
      </div>

      {progressQuery.isPending ? (
        <PageLoader message="Cargando al estudiante…" />
      ) : progressQuery.isError || progress == null ? (
        <EmptyState title="No pudimos abrir este estudiante">
          {readConvexError(progressQuery.error, 'Puede que ya no esté en tu colegio.')}
        </EmptyState>
      ) : (
        <div className="ruled-page">
          <aside className="ruled-page-margin" aria-label="Actividad">
            <p className="ruled-page-date">Últimas 8 semanas</p>
            {stats != null ? (
              <dl className="margin-facts">
                <div>
                  <dt>Respondidas</dt>
                  <dd>{stats.totalAnswered}</dd>
                </div>
                <div>
                  <dt>Aciertos</dt>
                  <dd>{stats.accuracy == null ? '—' : `${Math.round(stats.accuracy * 100)}%`}</dd>
                </div>
                <div>
                  <dt>Días de estudio</dt>
                  <dd>{stats.activeDayCount}</dd>
                </div>
                <div>
                  <dt>Mejor racha</dt>
                  <dd>{stats.longestStreakDays} días</dd>
                </div>
              </dl>
            ) : null}
          </aside>

          <div className="ruled-page-body">
            <header className="ruled-page-head">
              <h1 className="page-title">{studentDisplayName(progress.account)}</h1>
              {progress.account.name != null ? <p className="page-lede">{progress.account.email}</p> : null}
            </header>

            <section className="ruled-section" aria-labelledby="student-global-title">
              <h2 id="student-global-title" className="section-title">Puntaje global estimado</h2>
              {progress.globalScore.estimate != null ? (
                <p className="m-0">
                  <span className="figure">{progress.globalScore.estimate.score}</span>
                  <span className="text-sm text-[var(--text-secondary)]"> /500 · entre {progress.globalScore.estimate.low} y{' '}
                  {progress.globalScore.estimate.high}</span>
                </p>
              ) : (
                <p className="m-0 text-sm text-[var(--text-secondary)]">
                  Falta: {progress.globalScore.missingSubjectIds.map(getSubjectLabel).join(', ')}
                </p>
              )}
            </section>

            <section className="ruled-section" aria-labelledby="student-levels-title">
              <h2 id="student-levels-title" className="section-title">Nivel por área</h2>
              <AreaLevelsChart rows={progress.subjectLevels.map(areaChartRow)} />
            </section>

            {guidedLabel != null ? (
              <section className="ruled-section" aria-labelledby="student-guided-title">
                <h2 id="student-guided-title" className="section-title">Estudio guiado</h2>
                <p className="m-0 text-sm text-[var(--text-secondary)]">{guidedLabel}.</p>
              </section>
            ) : null}

            <section className="ruled-section" aria-labelledby="student-weak-title">
              <h2 id="student-weak-title" className="section-title">Temas que más le cuestan</h2>
              {progress.weakestSubtopics.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">Sin práctica aún.</p>
              ) : (
                <ul className="ruled-list">
                  {progress.weakestSubtopics.map((aggregate) => (
                    <li key={aggregate._id} className="ruled-row">
                      <span className="ruled-row-main">
                        <span className="font-semibold">
                          {aggregate.subtopicId != null ? getSubtopicLabel(aggregate.subtopicId) : getSubjectLabel(aggregate.subjectId)}
                        </span>
                        <span className="ruled-row-note">{getSubjectLabel(aggregate.subjectId)}</span>
                      </span>
                      <span className="ruled-row-note shrink-0 tabular-nums">
                        {aggregate.correctCount}/{aggregate.attemptCount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </StaffShell>
  )
}
