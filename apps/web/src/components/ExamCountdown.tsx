import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CalendarDays, Pencil, Target } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import type { ExamPhase } from '@aprendo/convex/examPlan'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { targetGapLines } from '../lib/today-display.ts'

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

type TodayGlobalScore = Parameters<typeof targetGapLines>[0] & {
  estimate: { score: number; low: number; high: number } | null
  areaGaps: Array<{
    subjectId: string
    levelLabel: string | null
    nextLevelLabel: string | null
    pointsToNextLevel: number | null
  }> | null
}

/**
 * The gap to the target global score, under the countdown (G03). The verdict
 * "vas a tiempo" shows only when the backend has the student's own weekly
 * trend; without a global estimate the gap is the next ICFES level per area.
 * `daysRemaining` is the exam plan's, null without a date.
 */
export function TargetGap({ data, daysRemaining }: { data: TodayGlobalScore; daysRemaining: number | null }) {
  const lines = targetGapLines(data, daysRemaining)

  if (data.estimate == null || lines == null) {
    if (data.areaGaps == null) return null
    return (
      <section className="card px-5 py-4" aria-labelledby="target-gap-title">
        <h2 id="target-gap-title" className="text-sm font-semibold text-[var(--text-primary)]">
          Aún no hay puntaje global
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Se calcula con las cinco áreas. Mientras tanto, esto te falta en cada una:
        </p>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {data.areaGaps.map((area) => {
            const theme = getSubjectTheme(area.subjectId)
            return (
              <li key={area.subjectId} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-[var(--text-primary)]">
                  <span
                    aria-hidden
                    className="subject-dot"
                    style={{ '--subject-color': theme.color } as CSSProperties}
                  />
                  <span className="truncate">{theme.label}</span>
                </span>
                <span className="shrink-0 text-right text-xs tabular-nums text-[var(--text-secondary)]">
                  {area.levelLabel == null
                    ? 'Sin nivel aún'
                    : area.nextLevelLabel != null && area.pointsToNextLevel != null
                      ? `${area.levelLabel} · ${area.pointsToNextLevel} pts para ${area.nextLevelLabel}`
                      : `${area.levelLabel} · nivel más alto`}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <section className="card flex items-start gap-3.5 px-5 py-4" aria-labelledby="target-gap-title">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--gold-soft)] text-[var(--text-primary)]" aria-hidden>
        <Target size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="target-gap-title" className="text-sm font-semibold text-[var(--text-primary)]">
          {lines.headline}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Tu global estimado: <strong className="tabular-nums">{data.estimate.score}</strong> (entre{' '}
          {data.estimate.low} y {data.estimate.high}). {lines.detail}
        </p>
        {lines.verdict != null ? (
          <p
            className={`mt-2 inline-block rounded-[var(--radius-md)] px-2.5 py-1 text-xs font-semibold ${
              lines.verdict.onTrack
                ? 'bg-[var(--success-soft)] text-[var(--success-text)]'
                : 'bg-[var(--gold-soft)] text-[var(--text-primary)]'
            }`}
          >
            {lines.verdict.text}
          </p>
        ) : null}
        {data.target == null ? (
          <Link to="/progress" className="mt-2 inline-block text-xs font-semibold no-underline">
            Ponerme una meta
          </Link>
        ) : null}
      </div>
    </section>
  )
}
