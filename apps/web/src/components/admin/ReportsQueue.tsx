import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { getSubjectLabel } from '@aprendo/convex/taxonomy'
import { readConvexError } from '../../lib/convex-error.ts'
import { EmptyState } from '../EmptyState.tsx'
import { PageLoader } from '../FullScreenLoader.tsx'
import { MarkdownBlock } from '../MarkdownBlock.tsx'
import { REPORT_REASONS } from '../QuestionReportForm.tsx'

const reasonLabel = (reason: string) =>
  REPORT_REASONS.find((option) => option.value === reason)?.label ?? reason

/**
 * What students reported on questions ("Reportar un problema"), newest first.
 * Each row links to the question in the browser, where it gets fixed; then it
 * is marked resolved here.
 */
export function ReportsQueue() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open')
  const reportsQuery = useQuery(convexQuery(api.questionReports.listQuestionReports, { status }))
  const resolve = useConvexMutation(api.questionReports.resolveQuestionReport)
  const resolveMutation = useMutation({ mutationFn: (reportId: string) => resolve({ reportId: reportId as never }) })

  return (
    <section aria-labelledby="reports-title">
      <div className="section-head">
        <h1 id="reports-title" className="page-title">Reportes de preguntas</h1>
        <nav className="tab-nav" aria-label="Estado">
          {(['open', 'resolved'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`tab-item${status === value ? ' is-active' : ''}`}
              onClick={() => setStatus(value)}
            >
              {value === 'open' ? 'Abiertos' : 'Resueltos'}
            </button>
          ))}
        </nav>
      </div>

      {resolveMutation.error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--danger-text)]">
          {readConvexError(resolveMutation.error, 'No se pudo marcar el reporte como resuelto.')}
        </p>
      ) : null}

      {reportsQuery.isPending ? (
        <PageLoader message="Cargando reportes…" />
      ) : (reportsQuery.data ?? []).length === 0 ? (
        <EmptyState title={status === 'open' ? 'No hay reportes abiertos' : 'Aún no hay reportes resueltos'}>
          {status === 'open' ? 'Cuando un estudiante reporte una pregunta, aparece aquí.' : null}
        </EmptyState>
      ) : (
        <ul className="ruled-list mt-4">
          {(reportsQuery.data ?? []).map((report) => (
            <li key={report._id} className="ruled-row items-start">
              <span className="ruled-row-label tabular-nums">
                {new Date(report.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
              </span>
              <div className="ruled-row-main gap-1.5">
                <p className="m-0 font-semibold">{reasonLabel(report.reason)}</p>
                {report.note ? <p className="m-0 text-sm text-[var(--text-secondary)]">“{report.note}”</p> : null}
                {report.question != null ? (
                  <>
                    <p className="m-0 text-xs text-[var(--text-tertiary)]">
                      {report.question.subjectId != null ? getSubjectLabel(report.question.subjectId) : 'Sin área'} ·
                      pregunta {report.question.questionNumber}
                      {report.question.answerCorrectOption != null ? ` · clave ${report.question.answerCorrectOption}` : ''}
                    </p>
                    <div className="line-clamp-3 text-sm">
                      <MarkdownBlock markdown={report.question.bodyMarkdown} />
                    </div>
                    <Link
                      to="/admin"
                      search={{ tab: 'questions', pdfUploadId: report.question.pdfUploadId }}
                      className="text-sm"
                    >
                      Abrir en el navegador de preguntas
                    </Link>
                  </>
                ) : (
                  <p className="m-0 text-sm text-[var(--text-tertiary)]">La pregunta ya no existe.</p>
                )}
              </div>
              {report.status === 'open' ? (
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  disabled={resolveMutation.isPending}
                  onClick={() => resolveMutation.mutate(report._id)}
                >
                  Marcar resuelto
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
