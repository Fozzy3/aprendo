import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { MAX_GLOBAL_SCORE } from '@aprendo/convex/globalScore'
import { getSubjectTheme } from '../lib/subject-theme.ts'

type GlobalScoreData = {
  estimate: {
    score: number
    margin: number
    low: number
    high: number
    attemptCount: number
  } | null
  provisional?: { low: number; high: number; missingCount: number } | null
  missingSubjectIds: string[]
  target: number | null
  pointsToTarget: number | null
  leverage: { subjectId: string; pointsPerAreaPoint: number; availablePoints: number } | null
}

const percentOf = (value: number) => `${(value / MAX_GLOBAL_SCORE) * 100}%`

/**
 * The 0-500 global score — the number the student's family and university
 * actually speak in.
 *
 * Always shown with its uncertainty band. The band is not decoration: an
 * estimate built on 30 questions and one built on 600 are different claims, and
 * a bare integer would present them as the same.
 */
export function GlobalScoreCard({
  studentId,
  data,
}: {
  studentId: string
  data: GlobalScoreData
}) {
  const titleId = useId()
  const queryClient = useQueryClient()
  const [isEditingTarget, setIsEditingTarget] = useState(false)
  const [draft, setDraft] = useState(data.target == null ? '' : String(data.target))

  const setTarget = useConvexMutation(api.students.setTargetGlobalScore)
  const saveMutation = useMutation({
    mutationFn: async (value: number | null) =>
      setTarget({ studentId: studentId as never, targetGlobalScore: value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      setIsEditingTarget(false)
    },
  })

  // A global score is defined over all five areas. Naming the missing ones is
  // more useful than a partial number would be, and it is the honest move.
  if (data.estimate == null) {
    const missing = data.missingSubjectIds.length
    return (
      <section className="ruled-section" aria-labelledby={titleId}>
        <h2 id={titleId} className="section-title">Tu puntaje global estimado</h2>
        {data.provisional != null ? (
          <p className="m-0 mb-2 text-sm text-[var(--text-secondary)]">
            Con lo que sabemos hoy estarías entre{' '}
            <strong className="text-[var(--text-primary)] tabular-nums">{data.provisional.low}</strong> y{' '}
            <strong className="text-[var(--text-primary)] tabular-nums">{data.provisional.high}</strong> de {MAX_GLOBAL_SCORE}.
            El rango se afina con cada área que nivelas.
          </p>
        ) : null}
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          Te {missing === 1 ? 'falta' : 'faltan'} <strong className="text-[var(--text-primary)]">{missing}</strong>{' '}
          {missing === 1 ? 'área' : 'áreas'} por medir:
        </p>
        <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm text-[var(--text-primary)]">
          {data.missingSubjectIds.map((subjectId) => {
            const theme = getSubjectTheme(subjectId)
            return (
              <li key={subjectId} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="subject-dot" style={{ '--subject-color': theme.color } as CSSProperties} />
                {theme.label}
              </li>
            )
          })}
        </ul>
        <p className="mt-3 mb-0 text-xs text-[var(--text-tertiary)]">
          El puntaje global va de 0 a {MAX_GLOBAL_SCORE} y solo tiene sentido con las cinco áreas.
        </p>
      </section>
    )
  }

  const { score, margin, low, high, attemptCount } = data.estimate
  const leverageTheme = data.leverage == null ? null : getSubjectTheme(data.leverage.subjectId)

  return (
    <section className="ruled-section" aria-labelledby={titleId}>
      <div className="section-head">
        <h2 id={titleId} className="section-title">Tu puntaje global estimado</h2>
        <span className="section-meta">{attemptCount} preguntas</span>
      </div>

      <p className="m-0">
        <span className="figure">{score}</span>
        <span className="text-sm text-[var(--text-tertiary)]"> /{MAX_GLOBAL_SCORE}</span>
      </p>
      <p className="mt-1 mb-0 text-sm text-[var(--text-secondary)]">
        Rango probable: <strong className="text-[var(--text-primary)]">{low}–{high}</strong> (± {margin})
      </p>

      {/* The band, drawn to scale against the full 0-500 range; the meta is a
          pencil tick. */}
      <div
        className="relative mt-4 h-2 max-w-xl bg-[var(--bg-inset)]"
        role="img"
        aria-label={`Entre ${low} y ${high} de ${MAX_GLOBAL_SCORE}${data.target != null ? `; tu meta es ${data.target}` : ''}`}
      >
        <span
          className="absolute inset-y-0"
          style={{
            left: percentOf(low),
            width: percentOf(high - low),
            background: 'color-mix(in srgb, var(--text-primary) 25%, transparent)',
          }}
        />
        <span
          className="absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 bg-[var(--text-primary)]"
          style={{ left: percentOf(score) }}
        />
        {data.target != null ? (
          <span
            className="absolute -top-1.5 -bottom-1.5 w-px -translate-x-1/2 bg-[var(--warn)]"
            style={{ left: percentOf(data.target) }}
            title={`Tu meta: ${data.target}`}
          />
        ) : null}
      </div>

      <div className="mt-4">
        {isEditingTarget ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = Number(draft)
              if (Number.isFinite(parsed)) saveMutation.mutate(parsed)
            }}
          >
            <label className="field">
              <span>Tu meta de puntaje global</span>
              <input
                type="number"
                min={0}
                max={MAX_GLOBAL_SCORE}
                className="input w-28"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="350"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
              Guardar
            </button>
            <button type="button" className="btn-ghost" onClick={() => setIsEditingTarget(false)}>
              Cancelar
            </button>
          </form>
        ) : data.target == null ? (
          <button type="button" className="btn-secondary" onClick={() => setIsEditingTarget(true)}>
            Ponerme una meta
          </button>
        ) : (
          <p className="m-0 flex flex-wrap items-baseline gap-x-3 text-sm text-[var(--text-secondary)]">
            <span>
              Tu meta: <strong className="text-[var(--text-primary)]">{data.target}</strong>
              {data.pointsToTarget != null && data.pointsToTarget > 0
                ? ` · te faltan ${data.pointsToTarget} puntos`
                : ' · ya la alcanzaste'}
            </span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setIsEditingTarget(true)}>
              Cambiar
            </button>
          </p>
        )}
      </div>

      {data.leverage != null && leverageTheme != null ? (
        <p className="notice">
          <span aria-hidden="true" className="subject-dot" style={{ '--subject-color': leverageTheme.color } as CSSProperties} />{' '}
          Cada punto que subas en <strong className="text-[var(--text-primary)]">{leverageTheme.label}</strong> vale{' '}
          <strong className="text-[var(--text-primary)]">{data.leverage.pointsPerAreaPoint.toFixed(2)}</strong> puntos
          globales: es donde más rinde tu esfuerzo.
        </p>
      ) : null}

      <p className="mt-3 mb-0 text-xs text-[var(--text-tertiary)]">
        Estimado con tus respuestas en Aprendo, no es un puntaje oficial del ICFES.
      </p>
    </section>
  )
}
