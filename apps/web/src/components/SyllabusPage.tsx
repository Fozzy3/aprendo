import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { Play } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import type { MasteryLevel } from '@aprendo/convex/mastery'
import { EmptyState } from './EmptyState.tsx'
import { MasteryBadge, MasteryLegend } from './MasteryBadge.tsx'
import { studentProgressQuery, syllabusQuery } from '../lib/student-queries.ts'
import { levelFor, masteryLevelMap, scopeMastery, subjectSubtopics } from '../lib/mastery-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { PageLoader } from '../components/FullScreenLoader.tsx'
import { readConvexError } from '../lib/convex-error.ts'

// The syllabus shape is defined once, in the `getSyllabus` query — derive the
// node types from its inferred return so backend and UI can't drift.
type SyllabusData = FunctionReturnType<typeof api.syllabus.getSyllabus>
type SubjectNode = SyllabusData['subjects'][number]
type SubtopicNode = SubjectNode['categories'][number]['subtopics'][number]
type StartMutation = ReturnType<typeof useMutation<string, Error, { subjectId: string; subtopicId: string }>>

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
    return <PageLoader message="Cargando el temario…" />
  }

  const subjects = syllabus.data?.subjects ?? []
  // Khan levels per subtopic; % and points add them up over what can be practised.
  const levels = masteryLevelMap(progress.data?.subtopicMastery ?? [])
  const courseMastery = scopeMastery(subjects.flatMap((subject) => subjectSubtopics(subject, levels)))
  const activeSubjectId = selectedSubjectId ?? subjects[0]?.id ?? null
  const activeSubject = subjects.find((subject) => subject.id === activeSubjectId) ?? null

  return (
    <div className="ruled-page fade-in">
      {/* The margin: the whole course at a glance. */}
      <aside className="ruled-page-margin" aria-label="Tu dominio">
        <p className="ruled-page-date">Todo el Saber 11</p>
        <dl className="margin-facts">
          <div>
            <dt>Tu dominio</dt>
            <dd>{courseMastery.percent}%</dd>
          </div>
          <div>
            <dt>Puntos</dt>
            <dd className="tabular-nums">
              {courseMastery.points} / {courseMastery.maxPoints}
            </dd>
          </div>
          <div>
            <dt>Competente o más</dt>
            <dd>
              {courseMastery.competenteOrAbove} de {courseMastery.subtopicCount}
            </dd>
          </div>
        </dl>
        <Link to="/path" className="margin-link">
          Seguir la ruta en orden
        </Link>
      </aside>

      <div className="ruled-page-body">
        <header className="ruled-page-head">
          <h1 className="page-title">Temario</h1>
          <p className="page-lede">
            Cada tema que evalúa el Saber 11, con tu dominio. Practica justo donde lo necesitas.
          </p>
        </header>

        <div className="tab-scroll mb-2">
          <nav className="tab-nav" aria-label="Área">
            {subjects.map((subject) => {
              const isActive = subject.id === activeSubjectId
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => setSelectedSubjectId(subject.id)}
                  aria-pressed={isActive}
                  className={`tab-item shrink-0 whitespace-nowrap ${isActive ? 'is-active' : ''}`}
                >
                  {subject.label}
                  <span className="tabular-nums text-xs font-normal text-[var(--text-tertiary)]">
                    {scopeMastery(subjectSubtopics(subject, levels)).percent}%
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        {activeSubject == null ? (
          <EmptyState title="El temario aún no está disponible" />
        ) : (
          <SubjectSection subject={activeSubject} levels={levels} startMutation={startMutation} />
        )}

        {startMutation.error ? (
          <p role="alert" className="notice is-danger">
            {readConvexError(startMutation.error, 'No se pudo iniciar la práctica.')}
          </p>
        ) : null}

        <section className="ruled-section" aria-labelledby="syllabus-levels-title">
          <h2 id="syllabus-levels-title" className="section-title">Cómo se mide el dominio</h2>
          <MasteryLegend />
        </section>
      </div>
    </div>
  )
}

function SubjectSection({
  subject,
  levels,
  startMutation,
}: {
  subject: SubjectNode
  levels: Map<string, MasteryLevel>
  startMutation: StartMutation
}) {
  const mastery = scopeMastery(subjectSubtopics(subject, levels))
  const theme = getSubjectTheme(subject.id)

  return (
    <section className="ruled-section" aria-labelledby="syllabus-subject-title">
      <div className="section-head">
        <h2 id="syllabus-subject-title" className="section-title inline-flex items-center gap-2">
          <span aria-hidden className="subject-dot" style={{ '--subject-color': theme.color } as CSSProperties} />
          {subject.label}
        </h2>
        <span className="section-meta tabular-nums">{mastery.percent}%</span>
      </div>
      <p className="m-0 text-sm tabular-nums text-[var(--text-secondary)]">
        {mastery.points} / {mastery.maxPoints} pts · {mastery.competenteOrAbove} de {mastery.subtopicCount}{' '}
        temas en Competente o más
      </p>

      {subject.categories.map((category) => (
        <div key={category.id} className="mt-6">
          <h3 className="mb-2 text-sm font-semibold text-[var(--text-secondary)]">{category.label}</h3>
          <ul className="ruled-list">
            {category.subtopics.map((subtopic) => (
              <SubtopicRow
                key={subtopic.id}
                subjectId={subject.id}
                subtopic={subtopic}
                level={levelFor(levels, subtopic.id)}
                startMutation={startMutation}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
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
  startMutation: StartMutation
}) {
  const canPractice = subtopic.questionCount > 0
  const isStarting = startMutation.isPending && startMutation.variables?.subtopicId === subtopic.id

  return (
    <li>
      <div className="ruled-row">
        <span className="ruled-row-main">
          <Link
            to="/lesson/$subtopicId"
            params={{ subtopicId: subtopic.id }}
            className="truncate font-semibold text-[var(--text-primary)]"
          >
            {subtopic.label}
          </Link>
          <span className="flex flex-wrap items-center gap-2">
            <MasteryBadge level={level} />
            {subtopic.hasLesson ? <span className="ruled-row-note">Con lección</span> : null}
          </span>
        </span>

        {canPractice ? (
          <button
            type="button"
            disabled={startMutation.isPending}
            onClick={() => startMutation.mutate({ subjectId, subtopicId: subtopic.id })}
            className="btn-ghost shrink-0 text-xs"
          >
            {isStarting ? (
              'Iniciando…'
            ) : (
              <>
                <Play size={13} aria-hidden /> Practicar
                <span className="tabular-nums text-[var(--text-tertiary)]">{subtopic.questionCount}</span>
              </>
            )}
          </button>
        ) : (
          <span className="ruled-row-note shrink-0">Sin preguntas</span>
        )}
      </div>
    </li>
  )
}
