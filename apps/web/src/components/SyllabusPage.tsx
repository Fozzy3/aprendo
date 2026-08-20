import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { BookOpen, ChevronRight, Play } from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { RingProgress } from './RingProgress.tsx'
import { syllabusQuery } from '../lib/student-queries.ts'
import { formatMasteryPercent, getSyllabusStatus } from '../lib/syllabus-status.ts'

// The syllabus shape is defined once, in the `getSyllabus` query — derive the
// node types from its inferred return so backend and UI can't drift.
type SyllabusData = FunctionReturnType<typeof api.syllabus.getSyllabus>
type SubjectNode = SyllabusData['subjects'][number]
type SubtopicNode = SubjectNode['categories'][number]['subtopics'][number]

function MasteryBar({ value, color }: { value: number | null; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.round((value ?? 0) * 100)}%`, background: color }}
      />
    </div>
  )
}

export function SyllabusPage({ studentId }: { studentId: string }) {
  const navigate = useNavigate()
  const syllabus = useQuery({ ...syllabusQuery(studentId), enabled: true })

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)

  const createSession = useConvexMutation(api.sessions.createSession)
  const startMutation = useMutation({
    mutationFn: async (input: { subjectId: string; subtopicId: string }) =>
      createSession({ studentId: studentId as never, kind: 'topic', ...input }),
    onSuccess: async (sessionId) => {
      await navigate({ to: '/practice/$sessionId', params: { sessionId } })
    },
  })

  if (syllabus.isPending) {
    return (
      <div className="fade-in mx-auto max-w-xl py-12 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Cargando el temario…</p>
      </div>
    )
  }

  const data = syllabus.data
  const subjects = data?.subjects ?? []
  const overallMastery = data?.overallMastery ?? null
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
          <div className="hidden text-right sm:block">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
              {formatMasteryPercent(overallMastery)}
            </p>
            <p className="text-xs font-medium text-[var(--text-tertiary)]">tu dominio</p>
          </div>
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
                {formatMasteryPercent(subject.mastery)}
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
          startMutation={startMutation}
        />
      )}

      {startMutation.error ? (
        <div className="stage-alert">
          {startMutation.error instanceof Error
            ? startMutation.error.message
            : 'No se pudo iniciar la práctica.'}
        </div>
      ) : null}
    </div>
  )
}

function SubjectPanel({
  subject,
  startMutation,
}: {
  subject: SubjectNode
  startMutation: ReturnType<
    typeof useMutation<string, Error, { subjectId: string; subtopicId: string }>
  >
}) {
  const subjectStatus = getSyllabusStatus({
    questionCount: subject.questionCount,
    attemptCount: subject.attemptCount,
    mastery: subject.mastery,
  })

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-[var(--border)] px-5 py-4">
        <div className="relative shrink-0">
          <RingProgress value={subject.mastery ?? 0} size={52} strokeWidth={6} color={subjectStatus.color} />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-[var(--text-primary)]">
            {formatMasteryPercent(subject.mastery)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl italic text-[var(--text-primary)]">{subject.label}</h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            {subject.questionCount} {subject.questionCount === 1 ? 'pregunta' : 'preguntas'} disponibles
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold ${subjectStatus.tone}`}
        >
          {subjectStatus.label}
        </span>
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
  startMutation,
}: {
  subjectId: string
  subtopic: SubtopicNode
  startMutation: ReturnType<
    typeof useMutation<string, Error, { subjectId: string; subtopicId: string }>
  >
}) {
  const status = getSyllabusStatus({
    questionCount: subtopic.questionCount,
    attemptCount: subtopic.attemptCount,
    mastery: subtopic.mastery,
  })
  const canPractice = subtopic.questionCount > 0
  const isStarting =
    startMutation.isPending && startMutation.variables?.subtopicId === subtopic.id

  return (
    <div className="flex items-center gap-3.5 rounded-[var(--radius-md)] px-2.5 py-2.5 transition-colors hover:bg-[var(--bg-inset)]">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
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
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold ${status.tone}`}
          >
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="max-w-[14rem] flex-1">
            <MasteryBar value={subtopic.mastery} color={status.color} />
          </div>
          <span className="shrink-0 text-[0.6875rem] font-semibold tabular-nums text-[var(--text-tertiary)]">
            {formatMasteryPercent(subtopic.mastery)}
          </span>
        </div>
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
