import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@aprendo/convex/api'
import { readConvexError } from '../lib/convex-error.ts'

const COMMIT_DAYS = [3, 5, 7]
const MINUTES_PER_DAY = 10

/**
 * The commitment step (F58): stored as the weekly goal, the one thing it can change later.
 * With `onChange` it only reports the choice and the caller saves it (the welcome's goal step).
 */
export function FirstWeekCommit({
  studentId,
  onDone,
  value,
  onChange,
  minutesPerDay = MINUTES_PER_DAY,
}: {
  studentId: string
  onDone?: () => void
  value?: number
  onChange?: (days: number) => void
  minutesPerDay?: number
}) {
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
      <p className="first-week-note">Unos {minutesPerDay} minutos cada día.</p>
      <div className="first-week-choices">
        {COMMIT_DAYS.map((days) => (
          <button
            key={days}
            type="button"
            className="btn-secondary"
            disabled={commit.isPending}
            aria-pressed={onChange != null ? value === days : undefined}
            onClick={() => (onChange != null ? onChange(days) : commit.mutate(days))}
          >
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
