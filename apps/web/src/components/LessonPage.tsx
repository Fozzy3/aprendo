import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Play } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { api } from '@aprendo/convex/api'
import { EmptyState } from './EmptyState.tsx'
import { MarkdownBlock } from './MarkdownBlock.tsx'
import { buildDemoDocument } from '../lib/demo-document.ts'
import { conceptLessonQuery } from '../lib/student-queries.ts'
import { getSubjectIdForSubtopic, getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { useResolvedTheme } from '../lib/use-resolved-theme.ts'
import { readConvexError } from '../lib/convex-error.ts'

/** A line of status in place of a section that is still being written. */
function Writing({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="m-0 inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
      <Loader2 size={15} aria-hidden className="animate-spin text-[var(--text-tertiary)]" />
      {children}
    </p>
  )
}

export function LessonPage({ subtopicId, studentId }: { subtopicId: string; studentId: string }) {
  const navigate = useNavigate()
  const theme = useResolvedTheme()
  const subjectId = getSubjectIdForSubtopic(subtopicId)
  const lessonQuery = useQuery({ ...conceptLessonQuery(subtopicId), enabled: subjectId != null })

  const requestLesson = useConvexMutation(api.lessons.requestConceptLesson)
  const requestMutation = useMutation({ mutationFn: async () => requestLesson({ subtopicId }) })

  const createSession = useConvexMutation(api.sessions.createSession)
  const practiceMutation = useMutation({
    mutationFn: async () =>
      createSession({ studentId: studentId as never, kind: 'topic', subtopicId }),
    onSuccess: async (sessionId) => {
      await navigate({ to: '/practice/$sessionId', params: { sessionId } })
    },
  })

  // Kick off generation once when the subtopic has no cached lesson yet, or when
  // the cached one is stale (older prompt, or a generation that died). A stale
  // lesson keeps its text on screen while the rewrite runs.
  const requestedRef = useRef<string | null>(null)
  const lesson = lessonQuery.data
  const needsRequest = lesson === null || lesson?.isStale === true
  useEffect(() => {
    if (subjectId == null) return
    if (lessonQuery.isPending) return
    if (needsRequest && requestedRef.current !== subtopicId) {
      requestedRef.current = subtopicId
      requestMutation.mutate()
    }
  }, [needsRequest, lessonQuery.isPending, requestMutation, subjectId, subtopicId])

  if (subjectId == null) {
    return (
      <EmptyState
        title="Este tema no existe"
        action={
          <Link to="/syllabus" className="btn-primary no-underline">
            Volver al temario
          </Link>
        }
      />
    )
  }

  // Text lands in phase 1; the demo (phase 2) may still be generating. Render the
  // text as soon as it exists so the lesson is readable while the demo builds.
  const hasText = lesson?.ideaBody != null
  // A failed generation, or a request that never reached the server, leaves
  // nothing to wait for. Without text, offer a retry instead of a skeleton that
  // spins forever. With text (a stale lesson whose rewrite failed keeps the old
  // one) the student keeps reading it, and a quiet note offers the retry, since
  // a failed lesson is never rewritten on its own.
  const isFailed = !hasText && (lesson?.status === 'failed' || requestMutation.error != null)
  const rewriteFailed = hasText && lesson?.status === 'failed'
  const isBuildingDemo = lesson?.status === 'generating' && hasText && lesson?.stage === 'demo'

  // A Read surface: one column at reading width, sections opened by a rule.
  return (
    <article className="page-sheet fade-in max-w-3xl">
      <Link to="/syllabus" className="back-link no-underline">
        <ArrowLeft size={14} aria-hidden /> {getSubjectLabel(subjectId)}
      </Link>
      <header className="ruled-page-head">
        <h1 className="page-title">{getSubtopicLabel(subtopicId)}</h1>
        <p className="page-lede">Lee la idea, explórala y luego ponla a prueba con preguntas reales.</p>
      </header>

      {isFailed ? (
        <section className="ruled-section">
          <p role="alert" className="notice is-danger">
            {readConvexError(requestMutation.error, 'No pudimos preparar esta lección.')}
          </p>
          <button
            type="button"
            disabled={requestMutation.isPending}
            onClick={() => requestMutation.mutate()}
            className="btn-primary mt-4"
          >
            {requestMutation.isPending ? 'Reintentando…' : 'Reintentar'}
          </button>
        </section>
      ) : !hasText ? (
        <section className="ruled-section">
          <Writing>Escribiendo tu lección…</Writing>
        </section>
      ) : (
        <>
          {rewriteFailed ? (
            <div role="status" className="notice flex flex-wrap items-center justify-between gap-3">
              <span>No pudimos actualizar esta lección; te mostramos la versión anterior.</span>
              <button
                type="button"
                disabled={requestMutation.isPending}
                onClick={() => requestMutation.mutate()}
                className="btn-secondary"
              >
                {requestMutation.isPending ? 'Reintentando…' : 'Reintentar'}
              </button>
            </div>
          ) : null}

          <section className="ruled-section" aria-labelledby="lesson-idea-title">
            <h2 id="lesson-idea-title" className="section-title">La idea</h2>
            <div className="max-w-[68ch]">
              {lesson?.ideaBody ? <MarkdownBlock markdown={lesson.ideaBody} /> : null}
            </div>
          </section>

          {lesson?.demoHtml ? (
            <section className="ruled-section" aria-labelledby="lesson-demo-title">
              <h2 id="lesson-demo-title" className="section-title">Explóralo</h2>
              <iframe
                srcDoc={buildDemoDocument(lesson.demoHtml, theme)}
                sandbox="allow-scripts"
                title={`Demostración: ${getSubtopicLabel(subtopicId)}`}
                className="h-[26rem] w-full border border-[var(--border)] bg-[var(--bg-card)]"
              />
            </section>
          ) : isBuildingDemo ? (
            <section className="ruled-section" aria-labelledby="lesson-demo-title">
              <h2 id="lesson-demo-title" className="section-title">Explóralo</h2>
              <Writing>Creando una demostración interactiva…</Writing>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">Ya puedes leer la lección mientras tanto.</p>
            </section>
          ) : null}
        </>
      )}

      {/* Practice — always available, independent of lesson state */}
      <section className="ruled-section" aria-labelledby="lesson-practice-title">
        <h2 id="lesson-practice-title" className="section-title">Practica este tema</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm text-[var(--text-secondary)]">Pon a prueba este tema con preguntas reales.</p>
          <button
            type="button"
            disabled={practiceMutation.isPending}
            onClick={() => practiceMutation.mutate()}
            className="btn-primary shrink-0"
          >
            <Play size={16} aria-hidden />
            {practiceMutation.isPending ? 'Preparando…' : 'Practicar este tema'}
          </button>
        </div>
        {practiceMutation.error ? (
          <p role="alert" className="notice is-danger">
            {readConvexError(practiceMutation.error, 'No se pudo iniciar la práctica.')}
          </p>
        ) : null}
      </section>
    </article>
  )
}
