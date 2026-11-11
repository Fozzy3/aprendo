import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import type { MasteryLevel } from '@aprendo/convex/mastery'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import { learningPathQuery, pathSubjectsQuery, studentProgressQuery, todayDashboardQuery } from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { focusSubjectId } from '../lib/progress-display.ts'
import { readConvexError } from '../lib/convex-error.ts'
import {
  levelFor,
  masteryLevelMap,
  resolvePathStates,
  scopeMastery,
  topicStats,
  type PathState,
} from '../lib/mastery-display.ts'
import { EmptyState } from './EmptyState.tsx'
import { PageLoader } from './FullScreenLoader.tsx'
import { MasteryBadge, MasteryLegend } from './MasteryBadge.tsx'

const DEFAULT_SUBJECT_ID = 'lectura_critica'
const TOPIC_QUESTIONS = getConfiguredQuestionCount(SESSION_KIND_CONFIG.topic)

type PathNode = {
  subtopicId: string
  label: string
  categoryId: string
  categoryLabel: string
  questionCount: number
  hasLesson: boolean
  attemptCount: number
  accuracy: number | null
  level: MasteryLevel
}

/**
 * Aprende: the area's topics, each with its level and its evidence, and the one
 * topic the plan picks next. The level rules sit behind one disclosure.
 */
export function LearningPathPage({ studentId, initialSubjectId = null }: { studentId: string; initialSubjectId?: string | null }) {
  const navigate = useNavigate()
  const [pickedSubjectId, setSubjectId] = useState<string | null>(initialSubjectId)
  const progress = useQuery(studentProgressQuery(studentId))
  // The plan's picks are the one compass (F33): Aprende opens on their area and marks them.
  const today = useQuery(todayDashboardQuery(studentId))
  const nextSubtopics = today.data?.plan.nextSubtopics ?? []
  const subjectId = pickedSubjectId ?? focusSubjectId(nextSubtopics, progress.data?.subjectAggregates ?? []) ?? DEFAULT_SUBJECT_ID
  const subjects = useQuery(pathSubjectsQuery(studentId))
  const path = useQuery(learningPathQuery(studentId, subjectId))

  const createSession = useConvexMutation(api.sessions.createSession)
  const startTopic = useMutation({
    mutationFn: (subtopicId: string) =>
      createSession({ studentId: studentId as never, kind: 'topic', subjectId, subtopicId }),
    onSuccess: (sessionId: string) => navigate({ to: '/practice/$sessionId', params: { sessionId } }),
  })

  const theme = getSubjectTheme(subjectId)
  const nodes =
    path.data == null || progress.data == null
      ? null
      : withLevels(path.data.nodes, progress.data.subtopicMastery)
  const states = nodes == null ? [] : resolvePathStates(nodes, nextSubtopics.map((item) => item.subtopicId))
  const mastery = nodes == null ? null : scopeMastery(nodes)
  const nextTopic = nodes?.[states.indexOf('current')] ?? null
  const placement = path.data?.level.hasEnoughEvidence === true ? path.data.level.placement : null

  return (
    <div className="aprende fade-in" style={{ '--area': theme.color } as CSSProperties}>
      <nav className="aprende-areas" aria-label="Área">
        {(subjects.data ?? []).map((subject) => (
          <button
            key={subject.subjectId}
            type="button"
            className="aprende-area"
            aria-pressed={subject.subjectId === subjectId}
            style={{ '--area': getSubjectTheme(subject.subjectId).color } as CSSProperties}
            onClick={() => setSubjectId(subject.subjectId)}
          >
            {subject.label}
          </button>
        ))}
      </nav>

      <section className="aprende-head" aria-labelledby="aprende-title" style={{ '--area': theme.color } as CSSProperties}>
        <div className="aprende-head-top">
          <h1 id="aprende-title" className="aprende-name">{theme.label}</h1>
          <span className="aprende-level">{placement?.band.labelEs ?? 'Sin nivel aún'}</span>
        </div>
        {mastery != null ? (
          <>
            <span className="aprende-bar" aria-hidden>
              <span style={{ width: `${mastery.subtopicCount === 0 ? 0 : (mastery.competenteOrAbove / mastery.subtopicCount) * 100}%` }} />
            </span>
            <p className="aprende-count">{mastery.competenteOrAbove} de {mastery.subtopicCount} temas en Competente o más</p>
          </>
        ) : null}
        {path.data != null ? <LevelNote level={path.data.level} /> : null}

        {nextTopic != null ? (
          <button
            type="button"
            className="btn-primary aprende-go"
            disabled={startTopic.isPending}
            onClick={() => startTopic.mutate(nextTopic.subtopicId)}
          >
            {startTopic.isPending && startTopic.variables === nextTopic.subtopicId
              ? 'Preparando…'
              : `Practicar ${nextTopic.label} · ${TOPIC_QUESTIONS} preguntas`}
          </button>
        ) : null}
      </section>

      {startTopic.error ? (
        <p role="alert" className="notice is-danger">
          {readConvexError(startTopic.error, 'No se pudo iniciar la práctica.')}
        </p>
      ) : null}

      {nodes == null ? (
        <PageLoader message="Cargando tus temas…" />
      ) : nodes.length === 0 ? (
        <EmptyState title="Esta área aún no tiene temas">Prueba con otra mientras tanto.</EmptyState>
      ) : (
        <section className="aprende-topics" aria-label="Temas">
          <details className="aprende-more">
            <summary>¿Cómo se sube de nivel en un tema?</summary>
            <MasteryLegend />
          </details>
          {byCategory(nodes).map((group) => (
            <div key={group.categoryId}>
              <h2 className="aprende-category">{group.categoryLabel}</h2>
              <ol className="aprende-list">
                {group.nodes.map((node) => (
                  <TopicRow
                    key={node.subtopicId}
                    node={node}
                    state={states[nodes.indexOf(node)] ?? 'available'}
                    disabled={startTopic.isPending}
                    onPractice={() => startTopic.mutate(node.subtopicId)}
                  />
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}
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

function byCategory(nodes: PathNode[]) {
  const groups: { categoryId: string; categoryLabel: string; nodes: PathNode[] }[] = []
  for (const node of nodes) {
    const last = groups.at(-1)
    if (last?.categoryId === node.categoryId) last.nodes.push(node)
    else groups.push({ categoryId: node.categoryId, categoryLabel: node.categoryLabel, nodes: [node] })
  }
  return groups
}

type SubjectLevel = {
  hasEnoughEvidence: boolean
  attemptsNeeded: number
  placement: {
    band: { labelEs: string; descriptorEs: string }
    nextBand: { labelEs: string } | null
    pointsToNextBand: number | null
  } | null
}

function LevelNote({ level }: { level: SubjectLevel }) {
  const placement = level.hasEnoughEvidence ? level.placement : null
  if (placement == null) {
    return <p className="aprende-note">Te faltan {level.attemptsNeeded} preguntas en esta área para calcular tu nivel ICFES.</p>
  }
  return (
    <p className="aprende-note">
      {placement.band.descriptorEs}
      {placement.nextBand != null && placement.pointsToNextBand != null
        ? ` Te faltan ${placement.pointsToNextBand} puntos para ${placement.nextBand.labelEs}.`
        : ' Estás en el nivel más alto de esta área.'}
    </p>
  )
}

/** A topic: its name, level and evidence (opens the lesson), and its practice button. */
function TopicRow({
  node,
  state,
  disabled,
  onPractice,
}: {
  node: PathNode
  state: PathState
  disabled: boolean
  onPractice: () => void
}) {
  const stats = topicStats(node)
  return (
    <li className={`aprende-topic is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
      <Link to="/lesson/$subtopicId" params={{ subtopicId: node.subtopicId }} className="aprende-topic-main">
        <span className="aprende-topic-label">
          {node.label}
          {state === 'current' ? <span className="aprende-tag">Siguiente</span> : null}
        </span>
        <span className="aprende-topic-meta">
          <MasteryBadge level={node.level} />
          {stats != null ? <span>{stats}</span> : null}
        </span>
      </Link>
      {node.questionCount > 0 ? (
        <button
          type="button"
          className="aprende-topic-go"
          disabled={disabled}
          aria-label={`Practicar ${node.label}`}
          onClick={onPractice}
        >
          <Play size={16} aria-hidden />
          <span aria-hidden>Practicar</span>
        </button>
      ) : (
        <span className="aprende-topic-empty">Sin preguntas</span>
      )}
    </li>
  )
}
