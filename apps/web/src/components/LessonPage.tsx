import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Play } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { EmptyState } from './EmptyState.tsx'
import { LessonSteps } from './LessonSteps.tsx'
import { MarkdownBlock } from './MarkdownBlock.tsx'
import { buildDemoDocument } from '../lib/demo-document.ts'
import { conceptLessonQuery, studentProgressQuery } from '../lib/student-queries.ts'
import { levelFor, masteryLevelMap } from '../lib/mastery-display.ts'
import { MasteryBadge } from './MasteryBadge.tsx'
import { getSubjectIdForSubtopic, getSubjectLabel, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { useResolvedTheme } from '../lib/use-resolved-theme.ts'
import { readConvexError } from '../lib/convex-error.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'

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
  const progress = useQuery(studentProgressQuery(studentId))

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
          <Link to="/path" className="btn-secondary no-underline">
            Volver a tu ruta
          </Link>
        }
      />
    )
  }

  // Text lands in phase 1; the demo (phase 2) may still be generating. Render the
  // text as soon as it exists so the lesson is readable while the demo builds.
  const hasText = lesson?.ideaBody != null
  const steps = lesson?.steps ?? []
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
    <article className="lesson fade-in" style={{ '--area': getSubjectTheme(subjectId).color } as CSSProperties}>
      <header className="lesson-cover">
        <Link to="/path" search={{ area: subjectId }} className="lesson-back no-underline">
          <ArrowLeft size={18} aria-hidden /> {getSubjectLabel(subjectId)}
        </Link>
        <h1 className="lesson-name">{getSubtopicLabel(subtopicId)}</h1>
      </header>
      {progress.data != null ? (
        <p className="lesson-level">
          <MasteryBadge level={levelFor(masteryLevelMap(progress.data.subtopicMastery), subtopicId)} />
        </p>
      ) : null}

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
              <span>No se pudo actualizar.</span>
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

          {steps.length > 0 ? (
            <LessonSteps key={subtopicId} steps={steps} />
          ) : (
            // A lesson generated before F56: no steps, just its text.
            <section className="ruled-section" aria-labelledby="lesson-idea-title">
              <h2 id="lesson-idea-title" className="section-title">La idea</h2>
              <div className="max-w-[68ch]">
                {lesson?.ideaBody ? <MarkdownBlock markdown={lesson.ideaBody} /> : null}
              </div>
            </section>
          )}

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
              <Writing>Creando la demo…</Writing>
            </section>
          ) : null}
        </>
      )}

      {/* Practice — always available, independent of lesson state */}
      <section id="practica" className="ruled-section" aria-label="Practicar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={practiceMutation.isPending}
            onClick={() => practiceMutation.mutate()}
            className="btn-secondary shrink-0"
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
