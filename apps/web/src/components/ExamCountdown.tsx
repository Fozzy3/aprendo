import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
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
const PHASE_COPY: Record<ExamPhase, string> = {
  far: 'Tienes tiempo. Úsalo.',
  approaching: 'Ya se ve en el calendario.',
  final_stretch: 'Recta final.',
  imminent: 'Es esta semana.',
  past: 'Tu examen ya pasó.',
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

  const dateForm = (
    <form
      className="flex flex-wrap items-center gap-2"
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
      <button type="submit" className="btn-primary" disabled={draft === '' || saveMutation.isPending}>
        {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
      </button>
      {examDate != null ? (
        <button type="button" className="btn-ghost" onClick={() => setIsEditing(false)}>
          Cancelar
        </button>
      ) : null}
    </form>
  )

  // The prompt, shown until a date exists. Deliberately a section and not a
  // modal: it is an invitation, not a gate.
  if (examDate == null || plan == null) {
    return (
      <section className="ruled-section" aria-labelledby="exam-countdown-title">
        <h2 id="exam-countdown-title" className="section-title">¿Cuándo presentas el ICFES?</h2>
        <p className="mb-3 text-sm text-[var(--text-secondary)]">
          Con la fecha, tu plan deja de ser una sugerencia y pasa a tener rumbo.
        </p>
        {dateForm}
      </section>
    )
  }

  const days = Math.abs(plan.daysRemaining)
  const dateLabel = new Date(examDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <section className="ruled-section" aria-labelledby="exam-countdown-title">
      <div className="section-head">
        <h2 id="exam-countdown-title" className="section-title">Tu examen</h2>
        <span className="section-meta">{dateLabel}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="m-0 tabular-nums">
          <span className="figure">{plan.phase === 'past' ? '—' : days}</span>{' '}
          <span className="text-sm text-[var(--text-secondary)]">
            {plan.phase === 'past'
              ? 'terminado'
              : plan.daysRemaining === 0
                ? 'es hoy'
                : days === 1
                  ? 'día'
                  : 'días'}
          </span>
        </p>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-semibold text-[var(--text-primary)]">{PHASE_COPY[plan.phase]}</p>
          {plan.phase === 'past' ? (
            <p className="m-0 text-sm text-[var(--text-secondary)]">Actualiza la fecha si vas a presentarlo de nuevo.</p>
          ) : (
            <p className="m-0 text-sm text-[var(--text-secondary)]">
              {plan.weeksRemaining} {plan.weeksRemaining === 1 ? 'semana' : 'semanas'} · a tu ritmo
              te alcanzan unas <strong className="tabular-nums">{plan.projectedSessions}</strong> sesiones más.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        {isEditing ? (
          dateForm
        ) : (
          <button
            type="button"
            className="btn-ghost -ml-3"
            onClick={() => {
              setDraft(toDateInputValue(examDate))
              setIsEditing(true)
            }}
          >
            <Pencil size={14} aria-hidden /> Cambiar la fecha
          </button>
        )}
      </div>
    </section>
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
      <section className="ruled-section" aria-labelledby="target-gap-title">
        <h2 id="target-gap-title" className="section-title">
          Aún no hay puntaje global
        </h2>
        <p className="mb-3 text-sm text-[var(--text-secondary)]">
          Se calcula con las cinco áreas. Mientras tanto, esto te falta en cada una:
        </p>
        <ul className="ruled-list">
          {data.areaGaps.map((area) => {
            const theme = getSubjectTheme(area.subjectId)
            return (
              <li key={area.subjectId} className="ruled-row justify-between text-sm">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-[var(--text-primary)]">
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
    <section className="ruled-section" aria-labelledby="target-gap-title">
      <div className="min-w-0">
        <h2 id="target-gap-title" className="section-title">
          {lines.headline}
        </h2>
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          Tu global estimado: <strong className="tabular-nums">{data.estimate.score}</strong> (entre{' '}
          {data.estimate.low} y {data.estimate.high}). {lines.detail}
        </p>
        {lines.verdict != null ? (
          <p
            className={`mt-2 text-sm font-semibold ${
              lines.verdict.onTrack ? 'text-[var(--success-text)]' : 'text-[var(--warn)]'
            }`}
          >
            {lines.verdict.text}
          </p>
        ) : null}
        {data.target == null ? (
          <Link to="/progress" className="mt-2 inline-block text-sm font-semibold">
            Ponerme una meta
          </Link>
        ) : null}
      </div>
    </section>
  )
}
