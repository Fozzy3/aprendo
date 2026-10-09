import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { BookOpen, ChevronRight, Play } from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import type { MasteryLevel } from '@aprendo/convex/mastery'
import { MasteryBadge, MasteryLegend } from './MasteryBadge.tsx'
import { RingProgress } from './RingProgress.tsx'
import { studentProgressQuery, syllabusQuery } from '../lib/student-queries.ts'
import { levelFor, masteryLevelMap, scopeMastery, subjectSubtopics } from '../lib/mastery-display.ts'
import { PageLoader } from '../components/FullScreenLoader.tsx'
import { readConvexError } from '../lib/convex-error.ts'

// The syllabus shape is defined once, in the `getSyllabus` query — derive the
// node types from its inferred return so backend and UI can't drift.
type SyllabusData = FunctionReturnType<typeof api.syllabus.getSyllabus>
type SubjectNode = SyllabusData['subjects'][number]
type SubtopicNode = SubjectNode['categories'][number]['subtopics'][number]

export function SyllabusPage({ studentId }: { studentId: string }) {
  const navigate = useNavigate()
  const syllabus = useQuery({ ...syllabusQuery(studentId), enabled: true })
  const progress = useQuery({ ...studentProgressQuery(studentId), enabled: true })

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)

  const createSession = useConvexMutation(api.sessions.createSession)
  const startMutation = useMutation({
    mutationFn: async (input: { subjectId: string; subtopicId: string }) =>
      createSession({ studentId: studentId as never, kind: 'topic', ...input }),
    onSuccess: async (sessionId) => {
      await navigate({ to: '/practice/$sessionId', params: { sessionId } })
    },
  })

  if (syllabus.isPending || progress.isPending) {
    return (
      <PageLoader message="Cargando el temario…" />
    )
  }

  const data = syllabus.data
  const subjects = data?.subjects ?? []
  // Khan levels per subtopic; % and points add them up over what can be practised.
  const levels = masteryLevelMap(progress.data?.subtopicMastery ?? [])
  const courseMastery = scopeMastery(subjects.flatMap((subject) => subjectSubtopics(subject, levels)))
  const activeSubjectId = selectedSubjectId ?? subjects[0]?.id ?? null
  const activeSubject = subjects.find((subject) => subject.id === activeSubjectId) ?? null

  return (
    <div className="fade-in mx-auto max-w-5xl space-y-5">
      <div className="card progress-hero relative overflow-hidden px-6 py-5 sm:px-8 sm:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--accent-soft),transparent_55%)]" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="kicker mb-1">Temario ICFES Saber 11</p>
            <h2 className="font-display text-2xl italic tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Tu mapa de estudio
            </h2>
            <p className="mt-1 max-w-md text-sm text-[var(--text-secondary)]">
              Explora cada tema, mira tu dominio y practica justo donde lo necesitas.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
              {courseMastery.percent}%
            </p>
            <p className="text-xs font-medium text-[var(--text-tertiary)]">tu dominio</p>
            <p className="text-[0.6875rem] tabular-nums text-[var(--text-tertiary)]">
              {courseMastery.points} / {courseMastery.maxPoints} pts
            </p>
          </div>
        </div>
        <div className="relative mt-4 border-t border-[var(--border)] pt-3">
          <MasteryLegend />
        </div>
      </div>

      {/* Subject selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {subjects.map((subject) => {
          const isActive = subject.id === activeSubjectId
          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => setSelectedSubjectId(subject.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'border-transparent bg-[var(--accent)] text-[var(--text-inverted)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              <span>{subject.label}</span>
              <span
                className={`tabular-nums text-xs font-bold ${
                  isActive ? 'text-[var(--text-inverted)]' : 'text-[var(--text-tertiary)]'
                }`}
              >
                {scopeMastery(subjectSubtopics(subject, levels)).percent}%
              </span>
            </button>
          )
        })}
      </div>

      {activeSubject == null ? (
        <div className="card px-5 py-10 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">El temario aún no está disponible.</p>
        </div>
      ) : (
        <SubjectPanel
          subject={activeSubject}
          levels={levels}
          startMutation={startMutation}
        />
      )}

      {startMutation.error ? (
        <div className="stage-alert">
          {readConvexError(startMutation.error, 'No se pudo iniciar la práctica.')}
        </div>
      ) : null}
    </div>
  )
}

function SubjectPanel({
  subject,
  levels,
  startMutation,
}: {
  subject: SubjectNode
  levels: Map<string, MasteryLevel>
  startMutation: ReturnType<
    typeof useMutation<string, Error, { subjectId: string; subtopicId: string }>
  >
}) {
  const mastery = scopeMastery(subjectSubtopics(subject, levels))

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-[var(--border)] px-5 py-4">
        <div className="relative shrink-0">
          <RingProgress value={mastery.percent / 100} size={52} strokeWidth={6} color="var(--accent)" />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-[var(--text-primary)]">
            {mastery.percent}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl italic text-[var(--text-primary)]">{subject.label}</h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            {mastery.points} / {mastery.maxPoints} pts · {mastery.competenteOrAbove} de{' '}
            {mastery.subtopicCount} temas en Competente o más
          </p>
        </div>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {subject.categories.map((category) => (
          <div key={category.id} className="px-5 py-4">
            <p className="kicker mb-3">{category.label}</p>
            <div className="space-y-2.5">
              {category.subtopics.map((subtopic) => (
                <SubtopicRow
                  key={subtopic.id}
                  subjectId={subject.id}
                  subtopic={subtopic}
                  level={levelFor(levels, subtopic.id)}
                  startMutation={startMutation}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SubtopicRow({
  subjectId,
  subtopic,
  level,
  startMutation,
}: {
  subjectId: string
  subtopic: SubtopicNode
  level: MasteryLevel
  startMutation: ReturnType<
    typeof useMutation<string, Error, { subjectId: string; subtopicId: string }>
  >
}) {
  const canPractice = subtopic.questionCount > 0
  const isStarting =
    startMutation.isPending && startMutation.variables?.subtopicId === subtopic.id

  return (
    <div className="flex items-center gap-3.5 rounded-[var(--radius-md)] px-2.5 py-2.5 transition-colors hover:bg-[var(--bg-inset)]">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex min-w-0 items-center gap-2">
          <Link
            to="/lesson/$subtopicId"
            params={{ subtopicId: subtopic.id }}
            className="group inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-[var(--text-primary)] no-underline"
          >
            <span className="truncate">{subtopic.label}</span>
            <ChevronRight
              size={14}
              className="shrink-0 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          {subtopic.hasLesson ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--accent-text)]">
              <BookOpen size={10} /> Lección
            </span>
          ) : null}
        </div>
        <MasteryBadge level={level} />
      </div>

      {canPractice ? (
        <button
          type="button"
          disabled={startMutation.isPending}
          onClick={() => startMutation.mutate({ subjectId, subtopicId: subtopic.id })}
          className="btn-ghost flex shrink-0 items-center gap-1.5 text-xs"
        >
          {isStarting ? (
            'Iniciando…'
          ) : (
            <>
              <Play size={13} /> Practicar
              <span className="tabular-nums text-[var(--text-tertiary)]">{subtopic.questionCount}</span>
            </>
          )}
        </button>
      ) : (
        <span className="shrink-0 text-[0.6875rem] font-medium text-[var(--text-tertiary)]">
          Sin preguntas
        </span>
      )}
    </div>
  )
}
