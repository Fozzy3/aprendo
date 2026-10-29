import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect } from 'react'
import { api } from '@aprendo/convex/api'
import { getSubjectLabel, getSubjectIdForSubtopic, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'
import { MarkdownBlock } from '../components/MarkdownBlock.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

export const Route = createFileRoute('/teacher/guia/$subtopicId')({
  validateSearch: (search: Record<string, unknown>): { curso?: string } =>
    typeof search.curso === 'string' ? { curso: search.curso } : {},
  component: ClassGuidePage,
})

/**
 * The class guide for one subtopic (F41), printable: the generic half (cached,
 * written with AI) and, when opened from a class, that class's own half: the
 * question it misses most, for the vote in pairs.
 */
function ClassGuidePage() {
  const { subtopicId } = Route.useParams()
  const { curso } = Route.useSearch()
  const router = useRouter()
  const session = useSignedIn()
  const guide = useQuery({ ...convexQuery(api.lessons.getClassGuide, { subtopicId }), enabled: session != null })
  const plan = useQuery({
    ...convexQuery(api.teacher.getClassTeachingPlan, curso == null ? 'skip' : { classGroupId: curso as never }),
    enabled: session != null && curso != null,
  })
  const request = useMutation({ mutationFn: useConvexMutation(api.lessons.requestClassGuide) })

  // First visit: ask for the guide once. A failed one waits for "Reintentar".
  const needsGuide = guide.isSuccess && guide.data == null
  useEffect(() => {
    if (needsGuide && request.isIdle) request.mutate({ subtopicId })
  }, [needsGuide, request, subtopicId])

  if (session == null) return <FullScreenLoader />
  const subjectId = getSubjectIdForSubtopic(subtopicId)
  const trap = plan.data?.items.find((item) => item.subtopicId === subtopicId) ?? null

  return (
    <StaffShell active="classes">
      <div className="report-actions">
        {/* A shared link or a new tab has no history to go back to. */}
        {curso != null ? (
          <Link to="/teacher/$classGroupId" params={{ classGroupId: curso }} className="back-link no-underline">
            <ArrowLeft size={14} aria-hidden /> Volver al curso
          </Link>
        ) : (
          <button type="button" className="back-link" onClick={() => router.history.back()}>
            <ArrowLeft size={14} aria-hidden /> Volver
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          <Printer size={14} aria-hidden /> Imprimir
        </button>
      </div>

      <article className="page-sheet max-w-3xl">
        <header className="ruled-page-head">
          <p className="ruled-page-date">{subjectId != null ? getSubjectLabel(subjectId) : ''} · Guía de clase</p>
          <h1 className="page-title">{getSubtopicLabel(subtopicId)}</h1>
          <p className="page-lede">Una clase corta de 15 a 20 minutos: tú lo haces, lo hacen juntos, cada uno lo hace solo.</p>
        </header>

        {guide.data?.status === 'ready' && guide.data.body != null ? (
          <>
            <MarkdownBlock markdown={guide.data.body} />
            <p className="mt-4 text-xs text-[var(--text-tertiary)]">Escrita con IA: revísala antes de llevarla al aula.</p>
          </>
        ) : guide.isError || request.isError ? (
          <p role="alert" className="notice is-danger">
            {readConvexError(guide.error ?? request.error, 'No pudimos abrir la guía.')}
          </p>
        ) : guide.data?.status === 'failed' ? (
          <div role="alert" className="notice is-danger">
            <p className="m-0">No pudimos escribir la guía.</p>
            <button
              type="button"
              className="btn-secondary mt-2 btn-sm"
              disabled={request.isPending}
              onClick={() => request.mutate({ subtopicId })}
            >
              Reintentar
            </button>
          </div>
        ) : (
          <PageLoader message="Escribiendo la guía…" />
        )}

        {trap != null ? (
          <section className="ruled-section" aria-labelledby="guide-trap-title">
            <h2 id="guide-trap-title" className="section-title">La trampa de tu curso</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {trap.wrong} de {trap.answered} la fallaron y {trap.topWrongCount} eligieron {trap.topWrongOption}
              {trap.correctOption != null ? ` (la correcta es ${trap.correctOption})` : ''}. Ponla en el tablero: que voten,
              discutan en parejas y vuelvan a votar.
            </p>
            <MarkdownBlock markdown={trap.stem} />
            <ul className="item-analysis-options">
              {trap.options.map((option) => (
                <li
                  key={option.label}
                  className={option.label === trap.correctOption ? 'is-correct' : option.label === trap.topWrongOption ? 'is-trap' : undefined}
                >
                  <strong>{option.label})</strong> <MarkdownBlock markdown={option.bodyMarkdown} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </StaffShell>
  )
}
