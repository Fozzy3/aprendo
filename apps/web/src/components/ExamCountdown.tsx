import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Pencil } from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import type { ExamPhase } from '@aprendo/convex/examPlan'

type ExamPlan = {
  daysRemaining: number
  phase: ExamPhase
  weeksRemaining: number
  projectedSessions: number
}

/**
 * How the countdown reads at each distance. The register changes on purpose:
 * "faltan 8 meses" should feel like room to plan, "faltan 3 días" should not.
 */
const PHASE_COPY: Record<ExamPhase, { kicker: string; tone: string }> = {
  far: { kicker: 'Tienes tiempo. Úsalo.', tone: 'is-far' },
  approaching: { kicker: 'Ya se ve en el calendario.', tone: 'is-approaching' },
  final_stretch: { kicker: 'Recta final.', tone: 'is-final' },
  imminent: { kicker: 'Es esta semana.', tone: 'is-imminent' },
  past: { kicker: 'Tu examen ya pasó.', tone: 'is-past' },
}

/** `<input type="date">` speaks YYYY-MM-DD; the backend stores ms. */
function toDateInputValue(examDate: number): string {
  return new Date(examDate).toISOString().slice(0, 10)
}

/**
 * Parse the date input at **local noon**, not midnight UTC.
 *
 * `new Date('2026-11-08')` is midnight UTC, which is 7pm on the 7th in Bogotá —
 * the countdown would be off by one day for every student in the country.
 */
function fromDateInputValue(value: string): number | null {
  const [year, month, day] = value.split('-').map(Number)
  if (year == null || month == null || day == null) return null
  const parsed = new Date(year, month - 1, day, 12, 0, 0)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

export function ExamCountdown({
  studentId,
  examDate,
  plan,
}: {
  studentId: string
  examDate: number | null
  plan: ExamPlan | null
}) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(examDate == null ? '' : toDateInputValue(examDate))

  const setExamDate = useConvexMutation(api.students.setExamDate)
  const saveMutation = useMutation({
    mutationFn: async (value: number | null) =>
      setExamDate({ studentId: studentId as never, examDate: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      setIsEditing(false)
    },
  })

  // The prompt, shown until a date exists. Deliberately a card and not a modal:
  // it is an invitation, not a gate.
  if (examDate == null || plan == null) {
    return (
      <div className="exam-countdown is-empty">
        <span className="exam-countdown-icon" aria-hidden>
          <CalendarDays size={20} />
        </span>
        <div className="exam-countdown-body">
          <p className="exam-countdown-title">¿Cuándo presentas el ICFES?</p>
          <p className="exam-countdown-sub">
            Con la fecha, tu plan deja de ser una sugerencia y pasa a tener rumbo.
          </p>
        </div>
        <form
          className="exam-countdown-form"
          onSubmit={(event) => {
            event.preventDefault()
            const parsed = fromDateInputValue(draft)
            if (parsed != null) saveMutation.mutate(parsed)
          }}
        >
          <input
            type="date"
            className="exam-countdown-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Fecha del examen"
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={draft === '' || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </div>
    )
  }

  const copy = PHASE_COPY[plan.phase]
  const days = Math.abs(plan.daysRemaining)

  return (
    <div className={`exam-countdown ${copy.tone}`}>
      <div className="exam-countdown-count">
        <strong>{plan.phase === 'past' ? '—' : days}</strong>
        <span>
          {plan.phase === 'past'
            ? 'terminado'
            : plan.daysRemaining === 0
              ? '¡es hoy!'
              : days === 1
                ? 'día'
                : 'días'}
        </span>
      </div>

      <div className="exam-countdown-body">
        <p className="exam-countdown-title">{copy.kicker}</p>
        {plan.phase === 'past' ? (
          <p className="exam-countdown-sub">Actualiza la fecha si vas a presentarlo de nuevo.</p>
        ) : (
          <p className="exam-countdown-sub">
            {plan.weeksRemaining} {plan.weeksRemaining === 1 ? 'semana' : 'semanas'} · a tu ritmo
            te alcanzan unas <strong>{plan.projectedSessions}</strong> sesiones más.
          </p>
        )}
      </div>

      {isEditing ? (
        <form
          className="exam-countdown-form"
          onSubmit={(event) => {
            event.preventDefault()
            const parsed = fromDateInputValue(draft)
            if (parsed != null) saveMutation.mutate(parsed)
          }}
        >
          <input
            type="date"
            className="exam-countdown-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Fecha del examen"
          />
          <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="exam-countdown-edit"
          onClick={() => {
            setDraft(toDateInputValue(examDate))
            setIsEditing(true)
          }}
          aria-label="Cambiar la fecha del examen"
          title="Cambiar fecha"
        >
          <Pencil size={14} />
        </button>
      )}
    </div>
  )
}
