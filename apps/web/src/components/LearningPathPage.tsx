import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpen, Check, Lock, Play } from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { learningPathQuery, pathSubjectsQuery } from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { getSyllabusStatus } from '../lib/syllabus-status.ts'

const DEFAULT_SUBJECT_ID = 'lectura_critica'

type PathNode = {
  subtopicId: string
  label: string
  categoryLabel: string
  questionCount: number
  attemptCount: number
  mastery: number | null
  hasLesson: boolean
}

/** Where the student is on the path: the first node that isn't mastered yet. */
type NodeState = 'mastered' | 'current' | 'available' | 'locked'

export function LearningPathPage({ studentId }: { studentId: string }) {
  const [subjectId, setSubjectId] = useState(DEFAULT_SUBJECT_ID)
  const subjects = useQuery(pathSubjectsQuery(studentId))
  const path = useQuery(learningPathQuery(studentId, subjectId))

  const theme = getSubjectTheme(subjectId)

  return (
    <div className="page-container py-8">
      <header className="fade-in mb-6">
        <p className="kicker">Tu ruta</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Ruta de aprendizaje
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Un tema a la vez, hasta tu siguiente nivel.{' '}
          <Link to="/syllabus" className="font-semibold">
            Ver todo el temario
          </Link>
        </p>
      </header>

      <div className="fade-in stagger-1 topic-picker mb-6">
        {(subjects.data ?? []).map((subject) => {
          const subjectTheme = getSubjectTheme(subject.subjectId)
          const isActive = subject.subjectId === subjectId
          return (
            <button
              key={subject.subjectId}
              type="button"
              onClick={() => setSubjectId(subject.subjectId)}
              aria-pressed={isActive}
              className={`topic-chip ${isActive ? 'is-active' : ''}`}
              style={isActive ? { borderColor: subjectTheme.color } : undefined}
            >
              <span aria-hidden="true">{subjectTheme.emoji}</span> {subject.label}
            </button>
          )
        })}
      </div>

      {path.data == null ? (
        <div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-inset)]" />
      ) : (
        <>
          <LevelHeader level={path.data.level} color={theme.color} />
          <PathTrack
            nodes={path.data.nodes}
            studentId={studentId}
            subjectColor={theme.color}
          />
        </>
      )}
    </div>
  )
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

function LevelHeader({ level, color }: { level: SubjectLevel; color: string }) {
  if (!level.hasEnoughEvidence || level.placement == null) {
    return (
      <section className="fade-in stagger-2 card mb-6 p-5">
        <p className="text-sm font-bold text-[var(--text-primary)]">Sin nivel aún</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Te faltan {level.attemptsNeeded} preguntas en esta área para calcular tu nivel ICFES
          con confianza. Haz la nivelación o practica un poco más.
        </p>
      </section>
    )
  }

  const { band, index, bandCount, nextBand, pointsToNextBand } = level.placement

  return (
    <section className="fade-in stagger-2 card mb-6 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="kicker">Tu nivel ICFES</p>
          <p className="font-display text-2xl font-bold text-[var(--text-primary)]">
            {band.labelEs}
          </p>
        </div>
        {nextBand != null && pointsToNextBand != null && (
          <p className="text-sm text-[var(--text-secondary)]">
            Te faltan{' '}
            <strong className="text-[var(--text-primary)]">{pointsToNextBand} puntos</strong> para{' '}
            {nextBand.labelEs}
          </p>
        )}
      </div>

      <div
        className="flex gap-1"
        role="img"
        aria-label={`Nivel ${index} de ${bandCount}`}
      >
        {Array.from({ length: bandCount }, (_, position) => (
          <span
            key={position}
            className="h-2 flex-1 rounded-[var(--radius-pill)]"
            style={{
              background: position < index ? color : 'var(--bg-inset)',
              border: '1px solid var(--border)',
            }}
          />
        ))}
      </div>

      <p className="mt-3 text-sm text-[var(--text-secondary)]">{band.descriptorEs}</p>
    </section>
  )
}

/**
 * A node is locked until the one before it is mastered, so the path reads as a
 * route rather than a list. Mastery bands come from `syllabus-status.ts`, shared
 * with the Temario and Progreso.
 */
function resolveStates(nodes: PathNode[]): NodeState[] {
  let previousMastered = true
  let currentAssigned = false

  return nodes.map((node) => {
    const status = getSyllabusStatus({
      questionCount: node.questionCount,
      attemptCount: node.attemptCount,
      mastery: node.mastery,
    })

    if (status.status === 'mastered') {
      previousMastered = true
      return 'mastered'
    }

    const unlocked = previousMastered
    previousMastered = false

    if (!unlocked) return 'locked'
    if (!currentAssigned) {
      currentAssigned = true
      return 'current'
    }
    return 'available'
  })
}

function PathTrack({
  nodes,
  studentId,
  subjectColor,
}: {
  nodes: PathNode[]
  studentId: string
  subjectColor: string
}) {
  const states = resolveStates(nodes)

  if (nodes.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Todavía no hay temas disponibles en esta área.
        </p>
      </div>
    )
  }

  return (
    <ol className="fade-in stagger-3 relative m-0 flex list-none flex-col gap-3 p-0">
      {nodes.map((node, index) => (
        <PathNodeRow
          key={node.subtopicId}
          node={node}
          state={states[index] ?? 'locked'}
          studentId={studentId}
          subjectColor={subjectColor}
          isLast={index === nodes.length - 1}
        />
      ))}
    </ol>
  )
}

function PathNodeRow({
  node,
  state,
  studentId,
  subjectColor,
  isLast,
}: {
  node: PathNode
  state: NodeState
  studentId: string
  subjectColor: string
  isLast: boolean
}) {
  const navigate = useNavigate()
  const createSession = useMutation({
    mutationFn: useConvexMutation(api.sessions.createSession),
    onSuccess: (sessionId: string) => {
      void navigate({ to: '/practice/$sessionId', params: { sessionId } })
    },
  })

  const isLocked = state === 'locked'
  const hasQuestions = node.questionCount > 0
  const isCurrent = state === 'current'

  return (
    <li className="relative">
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute left-[1.4rem] top-[3.2rem] bottom-[-0.75rem] w-[3px] rounded-full"
          style={{ background: state === 'mastered' ? subjectColor : 'var(--border-strong)' }}
        />
      )}

      <div
        className="card flex items-start gap-3 p-4"
        style={isCurrent ? { borderColor: subjectColor } : undefined}
      >
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
          style={{
            background: state === 'mastered' ? subjectColor : 'var(--bg-card)',
            borderColor: isLocked ? 'var(--border-strong)' : subjectColor,
            color: state === 'mastered' ? 'var(--text-inverted)' : subjectColor,
            boxShadow: isCurrent ? `0 3px 0 ${subjectColor}` : undefined,
          }}
        >
          {state === 'mastered' ? (
            <Check size={18} />
          ) : isLocked ? (
            <Lock size={16} />
          ) : (
            <Play size={16} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">
            {node.categoryLabel}
          </p>
          <p className="text-sm font-bold text-[var(--text-primary)]">{node.label}</p>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            {isCurrent && 'Estás aquí · '}
            {hasQuestions ? `${node.questionCount} preguntas` : 'Sin preguntas aún'}
            {node.mastery != null && ` · ${Math.round(node.mastery * 100)}% de dominio`}
          </p>

          {!isLocked && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Link
                to="/lesson/$subtopicId"
                params={{ subtopicId: node.subtopicId }}
                className="btn-ghost text-xs no-underline"
              >
                <BookOpen size={13} />
                {node.hasLesson ? 'Ver lección' : 'Aprender el tema'}
              </Link>
              {hasQuestions && (
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
                  className="btn-primary text-xs"
                >
                  {createSession.isPending ? 'Preparando…' : 'Practicar'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
