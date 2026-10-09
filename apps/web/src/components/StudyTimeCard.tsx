import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock3, Pencil } from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { readConvexError } from '../lib/convex-error.ts'
import { formatTimeLimit } from '../lib/session-display.ts'
import { hoursToGoalMinutes } from '../lib/today-display.ts'

type StudyTime = {
  minutesThisWeek: number
  goalMinutes: number
  weeks: { weekStartMs: number; minutes: number }[]
}

const formatMinutes = (minutes: number) => formatTimeLimit(minutes * 60_000)

function formatWeek(weekStartMs: number) {
  return new Date(weekStartMs).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

/**
 * Minutes studied this calendar week against a goal the student sets (G07),
 * with the last six weeks beside it. Time comes from the questions answered,
 * so it makes no claim about points.
 */
export function StudyTimeCard({ studentId, studyTime }: { studentId: string; studyTime: StudyTime }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const setWeeklyGoal = useConvexMutation(api.students.setWeeklyGoal)
  const save = useMutation({
    mutationFn: async (minutes: number) => setWeeklyGoal({ studentId: studentId as never, minutes }),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      setIsEditing(false)
    },
  })

  const { minutesThisWeek, goalMinutes, weeks } = studyTime
  const reached = minutesThisWeek >= goalMinutes
  const share = Math.min(1, minutesThisWeek / Math.max(goalMinutes, 1))
  const scale = Math.max(goalMinutes, ...weeks.map((week) => week.minutes), 1)
  const parsedDraft = hoursToGoalMinutes(draft)

  return (
    <section className="card p-5" aria-labelledby="study-time-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="study-time-title" className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Clock3 size={15} className="text-[var(--text-tertiary)]" aria-hidden />
          Tu tiempo de estudio
        </h2>
        {!isEditing ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)]"
            onClick={() => {
              setDraft(String(Math.round((goalMinutes / 60) * 10) / 10).replace('.', ','))
              setIsEditing(true)
            }}
          >
            <Pencil size={12} aria-hidden /> Meta: {formatMinutes(goalMinutes)}/semana
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <form
          className="mb-3 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (parsedDraft != null) save.mutate(parsedDraft)
          }}
        >
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            Horas por semana
            <input
              type="text"
              inputMode="decimal"
              className="exam-countdown-input w-20 tabular-nums"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-describedby="study-goal-hint"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={parsedDraft == null || save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" className="btn-ghost text-sm" onClick={() => setIsEditing(false)}>
            Cancelar
          </button>
          <p id="study-goal-hint" className="w-full text-xs text-[var(--text-tertiary)]">
            Entre media hora y 20 horas. Unas 3 horas por semana es un buen ritmo.
          </p>
          {save.error ? (
            <p role="alert" className="w-full text-sm text-[var(--danger-text)]">
              {readConvexError(save.error, 'No se pudo guardar tu meta.')}
            </p>
          ) : null}
        </form>
      ) : null}

      <p className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
        {formatMinutes(minutesThisWeek)}
        <span className="ml-1.5 text-sm font-medium text-[var(--text-tertiary)]">
          de {formatMinutes(goalMinutes)} esta semana
        </span>
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-inset)]"
        role="progressbar"
        aria-label="Avance de tu meta semanal"
        aria-valuemin={0}
        aria-valuemax={goalMinutes}
        aria-valuenow={Math.min(minutesThisWeek, goalMinutes)}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${share * 100}%`, background: reached ? 'var(--success)' : 'var(--accent)' }}
        />
      </div>
      <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
        {reached
          ? '¡Cumpliste tu meta de la semana!'
          : `Te faltan ${formatMinutes(goalMinutes - minutesThisWeek)} para tu meta.`}
      </p>

      {/* Six calendar weeks, this one last; the dashed line is the goal. */}
      <div className="relative mt-4 flex h-16 items-end gap-1.5" role="img" aria-label={`Minutos por semana: ${weeks.map((week) => `${formatWeek(week.weekStartMs)}, ${week.minutes}`).join('; ')}`}>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-[var(--gold)]"
          style={{ bottom: `${(goalMinutes / scale) * 100}%` }}
        />
        {weeks.map((week, index) => (
          <span
            key={week.weekStartMs}
            className="flex-1 rounded-t-[3px]"
            style={{
              height: `${Math.max((week.minutes / scale) * 100, week.minutes > 0 ? 4 : 2)}%`,
              background: index === weeks.length - 1 ? 'var(--accent)' : 'var(--accent-soft)',
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[0.625rem] tabular-nums text-[var(--text-tertiary)]" aria-hidden>
        {weeks.map((week, index) => (
          <span key={week.weekStartMs} className="flex-1 truncate text-center">
            {index === weeks.length - 1 ? 'Esta' : formatWeek(week.weekStartMs)}
          </span>
        ))}
      </div>
    </section>
  )
}
