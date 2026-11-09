import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { readConvexError } from '../lib/convex-error.ts'

const COMMIT_DAYS = [3, 5, 7]
const MINUTES_PER_DAY = 10

/** The commitment step (F58): stored as the weekly goal, the one thing it can change later. */
export function FirstWeekCommit({ studentId, onDone }: { studentId: string; onDone?: () => void }) {
  const queryClient = useQueryClient()
  const setWeeklyGoal = useConvexMutation(api.students.setWeeklyGoal)
  const commit = useMutation({
    mutationFn: (days: number) => setWeeklyGoal({ studentId: studentId as never, minutes: days * MINUTES_PER_DAY }),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      onDone?.()
    },
  })

  return (
    <div className="first-week-commit">
      <h2 className="first-week-title">¿Cuántos días esta semana?</h2>
      <p className="first-week-note">{MINUTES_PER_DAY} minutos cada día.</p>
      <div className="first-week-choices">
        {COMMIT_DAYS.map((days) => (
          <button key={days} type="button" className="btn-secondary" disabled={commit.isPending} onClick={() => commit.mutate(days)}>
            {days} días
          </button>
        ))}
      </div>
      {commit.error != null ? (
        <p role="alert" className="notice is-danger">{readConvexError(commit.error, 'No se pudo guardar. Intenta de nuevo.')}</p>
      ) : null}
    </div>
  )
}

const STATE_NAME = { done: 'hecho', today: 'hoy', open: 'sin hacer', upcoming: 'por venir' } as const

/** Seven numbered days. A past day without practice stays open, never "missed" (G5). */
export function FirstWeek({
  studentId,
  firstWeek,
}: {
  studentId: string
  firstWeek: { committed: boolean; days: { day: number; status: keyof typeof STATE_NAME }[] }
}) {
  return (
    <section className="first-week" aria-label="Tu primera semana">
      {firstWeek.committed ? null : <FirstWeekCommit studentId={studentId} />}
      {firstWeek.days.length > 0 ? (
        <>
          <h2 className="first-week-title">Tu primera semana</h2>
          <ol className="first-week-days">
            {firstWeek.days.map(({ day, status }) => (
              <li key={day} className={`first-week-day is-${status}`} aria-label={`Día ${day}: ${STATE_NAME[status]}`}>
                {status === 'done' ? <Check size={18} strokeWidth={3} aria-hidden /> : day}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  )
}
