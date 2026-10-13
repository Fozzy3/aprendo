import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpen, Play } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import type { MasteryLevel } from '@aprendo/convex/mastery'
import { learningPathQuery, pathSubjectsQuery, studentProgressQuery } from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { readConvexError } from '../lib/convex-error.ts'
import {
  levelFor,
  masteryLevelMap,
  resolvePathStates,
  scopeMastery,
  type PathState,
} from '../lib/mastery-display.ts'
import { EmptyState } from './EmptyState.tsx'
import { PageLoader } from './FullScreenLoader.tsx'
import { MasteryBadge, MasteryLegend } from './MasteryBadge.tsx'

const DEFAULT_SUBJECT_ID = 'lectura_critica'

type PathNode = {
  subtopicId: string
  label: string
  categoryLabel: string
  questionCount: number
  hasLesson: boolean
  level: MasteryLevel
}

export function LearningPathPage({ studentId }: { studentId: string }) {
  const [subjectId, setSubjectId] = useState(DEFAULT_SUBJECT_ID)
  const subjects = useQuery(pathSubjectsQuery(studentId))
  const path = useQuery(learningPathQuery(studentId, subjectId))
  const progress = useQuery(studentProgressQuery(studentId))

  const theme = getSubjectTheme(subjectId)
  const nodes =
    path.data == null || progress.data == null
      ? null
      : withLevels(path.data.nodes, progress.data.subtopicMastery)
  const mastery = nodes == null ? null : scopeMastery(nodes)

  return (
    <div className="ruled-page fade-in" style={{ '--subject-color': theme.color } as CSSProperties}>
      {/* The margin: the area this page is about and how far along it is. */}
      <aside className="ruled-page-margin" aria-label="Tu área">
        <p className="ruled-page-date inline-flex items-center gap-2">
          <span aria-hidden className="subject-dot" style={{ '--subject-color': theme.color } as CSSProperties} />
          {theme.label}
        </p>
        {mastery != null ? (
          <dl className="margin-facts">
            <div>
              <dt>Dominio del área</dt>
              <dd>{mastery.percent}%</dd>
            </div>
            <div>
              <dt>Competente o más</dt>
              <dd>
                {mastery.competenteOrAbove} de {mastery.subtopicCount}
              </dd>
            </div>
          </dl>
        ) : null}
        <Link to="/syllabus" className="margin-link">
          Ver todo el temario
        </Link>
      </aside>

      <div className="ruled-page-body">
        <header className="ruled-page-head">
          <h1 className="page-title">Ruta de aprendizaje</h1>
          <p className="page-lede">Un tema a la vez, en orden, hasta tu siguiente nivel.</p>
        </header>

        <div className="tab-scroll mb-2">
          <nav className="tab-nav" aria-label="Área">
            {(subjects.data ?? []).map((subject) => {
              const isActive = subject.subjectId === subjectId
              return (
                <button
                  key={subject.subjectId}
                  type="button"
                  onClick={() => setSubjectId(subject.subjectId)}
                  aria-pressed={isActive}
                  className={`tab-item shrink-0 whitespace-nowrap ${isActive ? 'is-active' : ''}`}
                >
                  <span
                    aria-hidden
                    className="subject-dot"
                    style={{ '--subject-color': getSubjectTheme(subject.subjectId).color } as CSSProperties}
                  />
                  {subject.label}
                </button>
              )
            })}
          </nav>
        </div>

        {path.data == null || nodes == null || mastery == null ? (
          <PageLoader message="Cargando la ruta…" />
        ) : (
          <>
            <LevelSection level={path.data.level} />
            <section className="ruled-section" aria-labelledby="path-topics-title">
              <div className="section-head">
                <h2 id="path-topics-title" className="section-title">Temas, en orden</h2>
                {nodes.length > 0 ? (
                  <span className="section-meta tabular-nums">
                    {mastery.points} / {mastery.maxPoints} pts
                  </span>
                ) : null}
              </div>
              {nodes.length === 0 ? (
                <EmptyState title="Esta área aún no tiene temas">
                  Todavía no hay preguntas cargadas para esta materia. Prueba con otra mientras tanto.
                </EmptyState>
              ) : (
                <>
                  <PathLines nodes={nodes} studentId={studentId} />
                  <div className="mt-5">
                    <MasteryLegend />
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function withLevels(
  nodes: Omit<PathNode, 'level'>[],
  subtopicMastery: { subtopicId: string; masteryLevel: MasteryLevel }[],
): PathNode[] {
  const levels = masteryLevelMap(subtopicMastery)
  return nodes.map((node) => ({ ...node, level: levelFor(levels, node.subtopicId) }))
}

type SubjectLevel = {
  hasEnoughEvidence: boolean
  attemptsNeeded: number
  score: number | null
  placement: {
    band: { labelEs: string; descriptorEs: string }
    index: number
    bandCount: number
    nextBand: { labelEs: string } | null
    pointsToNextBand: number | null
  } | null
}

function LevelSection({ level }: { level: SubjectLevel }) {
  const placement = level.hasEnoughEvidence ? level.placement : null
  return (
    <section className="ruled-section" aria-labelledby="path-level-title">
      <h2 id="path-level-title" className="section-title">Tu nivel ICFES</h2>
      {placement == null ? (
        <>
          <p className="m-0 font-display text-2xl font-semibold text-[var(--text-primary)]">Sin nivel aún</p>
          <p className="mt-1 max-w-[60ch] text-sm text-[var(--text-secondary)]">
            Te faltan {level.attemptsNeeded} preguntas en esta área para calcular tu nivel ICFES con
            confianza. Haz la nivelación o practica un poco más.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="m-0 font-display text-2xl font-semibold text-[var(--text-primary)]">
              {placement.band.labelEs}
            </p>
            {placement.nextBand != null && placement.pointsToNextBand != null ? (
              <p className="m-0 text-sm text-[var(--text-secondary)]">
                Te faltan <strong className="text-[var(--text-primary)]">{placement.pointsToNextBand} puntos</strong>{' '}
                para {placement.nextBand.labelEs}
              </p>
            ) : (
              <p className="m-0 text-sm text-[var(--text-secondary)]">Estás en el nivel más alto de esta área</p>
            )}
          </div>
          <div
            className="mt-3 flex gap-px"
            role="img"
            aria-label={`Nivel ${placement.index} de ${placement.bandCount}`}
          >
            {Array.from({ length: placement.bandCount }, (_, position) => (
              <span
                key={position}
                className="h-1.5 flex-1"
                style={{ background: position < placement.index ? 'var(--subject-color, var(--text-primary))' : 'var(--bg-inset)' }}
              />
            ))}
          </div>
          <p className="mt-3 max-w-[60ch] text-sm text-[var(--text-secondary)]">{placement.band.descriptorEs}</p>
        </>
      )}
    </section>
  )
}

/** The path as numbered lines: the line you are on is inked, the rest wait. */
function PathLines({ nodes, studentId }: { nodes: PathNode[]; studentId: string }) {
  const states = resolvePathStates(nodes)
  return (
    <ol className="plan-lines">
      {nodes.map((node, index) => (
        <PathLine
          key={node.subtopicId}
          node={node}
          number={index + 1}
          state={states[index] ?? 'locked'}
          studentId={studentId}
        />
      ))}
    </ol>
  )
}

function PathLine({
  node,
  number,
  state,
  studentId,
}: {
  node: PathNode
  number: number
  state: PathState
  studentId: string
}) {
  const navigate = useNavigate()
  const createSession = useMutation({
    mutationFn: useConvexMutation(api.sessions.createSession),
    onSuccess: (sessionId: string) => {
      void navigate({ to: '/practice/$sessionId', params: { sessionId } })
    },
  })

  const isLocked = state === 'locked'
  const isCurrent = state === 'current'
  const hasQuestions = node.questionCount > 0
  const isMuted = isLocked || state === 'empty'

  return (
    <li className={`plan-line path-line${isCurrent ? ' is-first' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
      <span className="plan-line-number" aria-hidden>
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-1 py-3">
        <span className="text-xs text-[var(--text-tertiary)]">{node.categoryLabel}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`plan-line-title ${isMuted ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>
            {node.label}
          </span>
          <MasteryBadge level={node.level} />
        </span>
        <span className="plan-line-reason">
          {isCurrent && 'Estás aquí · '}
          {hasQuestions ? `${node.questionCount} preguntas` : 'Sin preguntas aún: no bloquea tu ruta'}
          {isLocked && ' · se abre cuando llegues a Familiar en el tema anterior'}
        </span>

        {createSession.error ? (
          <p role="alert" className="notice is-danger">
            {readConvexError(createSession.error, 'No se pudo iniciar la práctica.')}
          </p>
        ) : null}
      </div>

      {!isLocked ? (
        <span className="path-line-actions">
          <Link
            to="/lesson/$subtopicId"
            params={{ subtopicId: node.subtopicId }}
            className="btn-ghost text-xs no-underline"
          >
            <BookOpen size={13} aria-hidden />
            {node.hasLesson ? 'Ver lección' : 'Aprender el tema'}
          </Link>
          {hasQuestions ? (
            <button
              type="button"
              disabled={createSession.isPending}
              onClick={() =>
                createSession.mutate({
                  studentId: studentId as never,
                  kind: 'topic',
                  subtopicId: node.subtopicId,
                })
              }
              className={`${isCurrent ? 'btn-primary' : 'btn-secondary'} text-xs`}
            >
              <Play size={13} aria-hidden />
              {createSession.isPending ? 'Preparando…' : 'Practicar'}
            </button>
          ) : null}
        </span>
      ) : null}
    </li>
  )
}
