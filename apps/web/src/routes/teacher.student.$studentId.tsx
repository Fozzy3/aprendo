import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { EmptyState } from '../components/EmptyState.tsx'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { studentProgressQuery } from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { studentDisplayName } from '../lib/teacher-display.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

export const Route = createFileRoute('/teacher/student/$studentId')({
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
  const router = useRouter()
  const session = useSignedIn()
  const progressQuery = useQuery({ ...studentProgressQuery(studentId), enabled: session != null })
  const activityQuery = useQuery({
    ...convexQuery(api.history.getActivitySummary, { studentId: studentId as never, weeks: 8 }),
    enabled: session != null,
  })
  if (session == null) return <FullScreenLoader />

  const progress = progressQuery.data
  const stats = activityQuery.data?.stats

  return (
    <StaffShell active="classes">
      <button type="button" className="back-link" onClick={() => router.history.back()}>
        <ArrowLeft size={14} aria-hidden /> Volver al curso
      </button>

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
                  <dt>Preguntas respondidas</dt>
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
                  <dt>Racha más larga</dt>
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
                  Aún no: falta evidencia en{' '}
                  {progress.globalScore.missingSubjectIds.map(getSubjectLabel).join(', ')}.
                </p>
              )}
            </section>

            <section className="ruled-section" aria-labelledby="student-levels-title">
              <h2 id="student-levels-title" className="section-title">Nivel por área</h2>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Área</th>
                      <th scope="col">Nivel actual</th>
                      <th scope="col" className="is-number">Puntaje</th>
                      <th scope="col">Al nivelarse</th>
                      <th scope="col" className="is-number">Respuestas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.subjectLevels.map((level) => (
                      <tr key={level.subjectId}>
                        <th scope="row">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden
                              className="subject-dot"
                              style={{ '--subject-color': getSubjectTheme(level.subjectId).color } as CSSProperties}
                            />
                            {getSubjectLabel(level.subjectId)}
                          </span>
                        </th>
                        <td className={level.current?.index === 1 ? 'is-low' : undefined}>
                          {level.current?.band.labelEs ?? 'Sin nivel aún'}
                        </td>
                        <td className="is-number">{level.hasEnoughEvidence ? level.currentScore : '—'}</td>
                        <td>{level.baseline?.band.labelEs ?? '—'}</td>
                        <td className="is-number">{level.attemptCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="ruled-section" aria-labelledby="student-weak-title">
              <h2 id="student-weak-title" className="section-title">Temas que más le cuestan</h2>
              {progress.weakestSubtopics.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">Todavía no ha practicado temas.</p>
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
                        {aggregate.correctCount} de {aggregate.attemptCount} correctas
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
