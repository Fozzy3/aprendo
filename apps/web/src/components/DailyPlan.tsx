import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  BookOpen,
  ChevronRight,
  Gauge,
  Play,
  RotateCcw,
  Target,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import type { StudyTask, StudyTaskKind } from '@aprendo/convex/studyPlan'
import { readConvexError } from '../lib/convex-error.ts'
import { formatTimeLimit } from '../lib/session-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { taskSessionArgs, timedIntro } from '../lib/today-display.ts'
import { TimedSessionIntro } from './TimedSessionIntro.tsx'

const TASK_ICON: Record<StudyTaskKind, LucideIcon> = {
  lesson: BookOpen,
  practice: Target,
  repaso: RotateCcw,
  reto: Trophy,
  simulacro: Timer,
  nivelacion: Gauge,
}

/**
 * "Tu plan de hoy": the backend's two to four tasks (`studyPlan.ts`), each one
 * tap away, and one big "Empezar" for the first — Khan's daily mission. A
 * timed task (nivelación, simulacro) stops at `TimedSessionIntro` first, as it
 * does in the hub: the clock can't be paused once it starts.
 */
export function DailyPlan({ studentId, tasks }: { studentId: string; tasks: StudyTask[] }) {
  const navigate = useNavigate()
  const createSession = useConvexMutation(api.sessions.createSession)
  const [pendingIntro, setPendingIntro] = useState<StudyTask | null>(null)
  const launch = useMutation({
    mutationFn: async (task: StudyTask) => {
      if (task.action.type === 'lesson') {
        await navigate({ to: '/lesson/$subtopicId', params: { subtopicId: task.action.subtopicId } })
        return
      }
      const sessionId = await createSession({
        studentId: studentId as never,
        ...taskSessionArgs(task.action),
      })
      await navigate({ to: '/practice/$sessionId', params: { sessionId } })
    },
  })

  const open = (task: StudyTask) => {
    if (task.action.type === 'session' && timedIntro(task.action) != null) setPendingIntro(task)
    else launch.mutate(task)
  }

  const first = tasks[0]
  const totalMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0)
  const pendingId = launch.isPending ? launch.variables.id : null

  if (first == null) {
    return (
      <section className="ruled-section">
        <h2 className="section-title">Hoy toca descansar</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Tu examen está muy cerca. Hoy nada pesado: duerme bien y llega con la cabeza fresca.
        </p>
      </section>
    )
  }

  const intro = pendingIntro?.action.type === 'session' ? timedIntro(pendingIntro.action) : null
  if (pendingIntro != null && pendingIntro.action.type === 'session' && intro != null) {
    const { subjectId } = pendingIntro.action
    return (
      <TimedSessionIntro
        title={pendingIntro.title}
        subjectColor={subjectId == null ? undefined : getSubjectTheme(subjectId).color}
        questionCount={intro.questionCount}
        timeLimitMs={intro.timeLimitMs}
        isStarting={launch.isPending}
        error={launch.error ? readConvexError(launch.error, 'No se pudo empezar. Intenta de nuevo.') : null}
        cancelLabel="Volver al plan"
        onStart={() => launch.mutate(pendingIntro)}
        onCancel={() => {
          launch.reset()
          setPendingIntro(null)
        }}
      />
    )
  }

  return (
    <section className="ruled-section" aria-labelledby="daily-plan-title">
      <div className="section-head">
        <h2 id="daily-plan-title" className="section-title">Tu plan de hoy</h2>
        <span className="section-meta">~{formatTimeLimit(totalMinutes * 60_000)}</span>
      </div>

      {/* Numbered lines on the ruling. The first one carries "Empezar". */}
      <ol className="plan-lines">
        {tasks.map((task, index) => {
          const Icon = TASK_ICON[task.kind]
          const isFirst = index === 0
          return (
            <li key={task.id} className={`plan-line${isFirst ? ' is-first' : ''}`}>
              <span className="plan-line-number" aria-hidden>
                {index + 1}
              </span>
              <button
                type="button"
                disabled={launch.isPending}
                onClick={() => open(task)}
                className="plan-line-task"
              >
                <span className="plan-line-title">
                  <Icon size={15} aria-hidden className="shrink-0 text-[var(--text-tertiary)]" />
                  {pendingId === task.id ? 'Preparando…' : task.title}
                </span>
                <span className="plan-line-reason">{task.reason}</span>
              </button>
              <span className="plan-line-minutes">{formatTimeLimit(task.minutes * 60_000)}</span>
              {isFirst ? (
                <button
                  type="button"
                  disabled={launch.isPending}
                  onClick={() => open(first)}
                  className="btn-primary plan-line-start"
                >
                  <Play size={15} aria-hidden />
                  {pendingId === first.id ? 'Preparando…' : 'Empezar'}
                </button>
              ) : (
                <ChevronRight size={16} aria-hidden className="plan-line-chevron" />
              )}
            </li>
          )
        })}
      </ol>

      {launch.error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--danger-text)]">
          {readConvexError(launch.error, 'No se pudo abrir esta tarea. Intenta de nuevo.')}
        </p>
      ) : null}
    </section>
  )
}
