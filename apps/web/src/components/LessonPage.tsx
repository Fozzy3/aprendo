import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAction } from 'convex/react'
import { ArrowLeft, Lightbulb, Loader2, Play, Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { api } from '@aprendo/convex/api'
import MarkdownBlock from './MarkdownBlock.tsx'
import { buildDemoDocument } from '../lib/demo-document.ts'
import { conceptLessonQuery } from '../lib/student-queries.ts'
import { getSubjectIdForSubtopic, getSubjectLabel, getSubtopicLabel } from '../lib/taxonomy.ts'
import { useResolvedTheme } from '../lib/use-resolved-theme.ts'

/** Shown while the text sections are still being drafted (no content yet). */
function WritingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
        <Loader2 size={15} className="animate-spin text-[var(--accent)]" />
        Escribiendo tu lección…
      </div>
      <div className="card h-32 animate-pulse bg-[var(--bg-inset)]" />
      <div className="card h-40 animate-pulse bg-[var(--bg-inset)]" />
    </div>
  )
}

/** Placeholder in the demo slot while the interactive demo is being built. */
function DemoBuildingPlaceholder() {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] px-6 py-3">
        <p className="kicker">Demostración interactiva</p>
      </div>
      <div className="flex h-40 flex-col items-center justify-center gap-2 bg-[var(--bg-inset)]">
        <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Creando una demostración interactiva…
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">Ya puedes leer la lección mientras tanto.</p>
      </div>
    </section>
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

  const generate = useAction(api.generatedQuestions.generateSubtopicQuestions)
  const generateMutation = useMutation({ mutationFn: async () => generate({ subtopicId, count: 5 }) })

  // Kick off generation once when the subtopic has no cached lesson yet.
  const requestedRef = useRef<string | null>(null)
  const lesson = lessonQuery.data
  useEffect(() => {
    if (subjectId == null) return
    if (lessonQuery.isPending) return
    if (lesson === null && requestedRef.current !== subtopicId) {
      requestedRef.current = subtopicId
      requestMutation.mutate()
    }
  }, [lesson, lessonQuery.isPending, requestMutation, subjectId, subtopicId])

  if (subjectId == null) {
    return (
      <div className="fade-in mx-auto max-w-md py-12 text-center">
        <p className="mb-4 text-sm text-[var(--text-secondary)]">Este subtema no existe.</p>
        <Link to="/syllabus" className="btn-primary no-underline">
          Volver al temario
        </Link>
      </div>
    )
  }

  const isFailed = lesson?.status === 'failed'
  // Text lands in phase 1; the demo (phase 2) may still be generating. Render the
  // text as soon as it exists so the lesson is readable while the demo builds.
  const hasText = lesson?.ideaBody != null
  const isBuildingDemo = lesson?.status === 'generating' && hasText && lesson?.stage === 'demo'

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-5">
      {/* Breadcrumb + title */}
      <div>
        <Link
          to="/syllabus"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] no-underline transition-colors hover:text-[var(--text-secondary)]"
        >
          <ArrowLeft size={14} /> {getSubjectLabel(subjectId)}
        </Link>
        <h1 className="mt-2 font-display text-3xl italic tracking-tight text-[var(--text-primary)] sm:text-4xl">
          {getSubtopicLabel(subtopicId)}
        </h1>
      </div>

      {isFailed ? (
        <div className="card p-6 text-center">
          <div className="stage-alert mb-4">No pudimos preparar esta lección.</div>
          <button
            type="button"
            disabled={requestMutation.isPending}
            onClick={() => requestMutation.mutate()}
            className="btn-primary"
          >
            {requestMutation.isPending ? 'Reintentando…' : 'Reintentar'}
          </button>
        </div>
      ) : !hasText ? (
        <WritingSkeleton />
      ) : (
        <>
          <section className="card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb size={16} className="text-[var(--accent)]" />
              <p className="kicker">La idea</p>
            </div>
            {lesson?.ideaBody ? <MarkdownBlock markdown={lesson.ideaBody} /> : null}
          </section>

          {lesson?.demoHtml ? (
            <section className="card overflow-hidden">
              <div className="border-b border-[var(--border)] px-6 py-3">
                <p className="kicker">Explóralo</p>
              </div>
              <iframe
                srcDoc={buildDemoDocument(lesson.demoHtml, theme)}
                sandbox="allow-scripts"
                title={`Demostración: ${getSubtopicLabel(subtopicId)}`}
                className="h-[26rem] w-full border-0 bg-[var(--bg-card)]"
              />
            </section>
          ) : isBuildingDemo ? (
            <DemoBuildingPlaceholder />
          ) : null}
        </>
      )}

      {/* Practice CTA — always available, independent of lesson state */}
      <div className="card flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="text-base font-semibold text-[var(--text-primary)]">¿List@ para practicar?</p>
          <p className="text-sm text-[var(--text-secondary)]">Pon a prueba este tema con preguntas reales.</p>
        </div>
        <button
          type="button"
          disabled={practiceMutation.isPending}
          onClick={() => practiceMutation.mutate()}
          className="btn-primary shrink-0"
        >
          <Play size={16} />
          {practiceMutation.isPending ? 'Preparando…' : 'Practicar este tema'}
        </button>
      </div>

      {practiceMutation.error ? (
        <div className="stage-alert">
          {practiceMutation.error instanceof Error
            ? practiceMutation.error.message
            : 'No se pudo iniciar la práctica.'}
        </div>
      ) : null}

      {/* AI question generation (thin inventory) */}
      <div className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          disabled={generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
          className="btn-ghost inline-flex items-center gap-1.5 text-sm"
        >
          <Sparkles size={14} />
          {generateMutation.isPending ? 'Generando preguntas…' : 'Generar más práctica con IA'}
        </button>
        {generateMutation.data != null ? (
          <p className="text-xs text-[var(--success-text)]">
            Se añadieron {generateMutation.data.inserted} preguntas nuevas a este tema.
          </p>
        ) : null}
        {generateMutation.error ? (
          <p className="text-xs text-[var(--accent-text)]">No se pudieron generar preguntas.</p>
        ) : null}
      </div>
    </div>
  )
}
