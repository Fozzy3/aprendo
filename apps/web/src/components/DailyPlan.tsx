import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  BookOpen,
  ChevronRight,
  Gauge,
  Moon,
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
      <div className="card flex items-start gap-3.5 p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
          <Moon size={18} />
        </span>
        <div>
          <p className="text-base font-semibold text-[var(--text-primary)]">Hoy toca descansar</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Tu examen está muy cerca. Hoy nada pesado: duerme bien y llega con la cabeza
            fresca.
          </p>
        </div>
      </div>
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
    <section className="card relative overflow-hidden p-5 sm:p-6" aria-labelledby="daily-plan-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--accent-soft),transparent_60%)]" />
      <div className="relative">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="daily-plan-title" className="font-display text-xl font-bold text-[var(--text-primary)]">
            Tu plan de hoy
          </h2>
          <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--text-tertiary)]">
            ~{formatTimeLimit(totalMinutes * 60_000)}
          </span>
        </div>

        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {tasks.map((task, index) => {
            const Icon = TASK_ICON[task.kind]
            const isFirst = index === 0
            return (
              <li key={task.id}>
                <button
                  type="button"
                  disabled={launch.isPending}
                  onClick={() => open(task)}
                  className="flex w-full items-start gap-3 rounded-[var(--radius-md)] px-2 py-2.5 text-left transition-colors hover:bg-[var(--bg-inset)] disabled:opacity-60"
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      isFirst
                        ? 'bg-[var(--accent)] text-[var(--text-inverted)]'
                        : 'bg-[var(--bg-inset)] text-[var(--text-secondary)]'
                    }`}
                    aria-hidden
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--text-primary)]">
                      {pendingId === task.id ? 'Preparando…' : task.title}
                    </span>
                    <span className="block text-xs text-[var(--text-secondary)]">{task.reason}</span>
                  </span>
                  <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums text-[var(--text-tertiary)]">
                    {formatTimeLimit(task.minutes * 60_000)}
                    <ChevronRight size={14} aria-hidden />
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <button
          type="button"
          disabled={launch.isPending}
          onClick={() => open(first)}
          className="btn-primary mt-4 w-full justify-center sm:w-auto"
        >
          <Play size={16} />
          {pendingId === first.id ? 'Preparando…' : 'Empezar'}
        </button>

        {launch.error ? (
          <p role="alert" className="mt-3 text-sm text-[var(--danger-text)]">
            {readConvexError(launch.error, 'No se pudo abrir esta tarea. Intenta de nuevo.')}
          </p>
        ) : null}
      </div>
    </section>
  )
}
