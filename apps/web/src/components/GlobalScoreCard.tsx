import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Target } from 'lucide-react'
import { useState } from 'react'
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
  missingSubjectIds: string[]
  target: number | null
  pointsToTarget: number | null
  leverage: { subjectId: string; pointsPerAreaPoint: number; availablePoints: number } | null
}

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
    return (
      <div className="card global-score is-incomplete">
        <p className="kicker mb-1">Tu puntaje global estimado</p>
        <p className="global-score-empty">
          Te {data.missingSubjectIds.length === 1 ? 'falta' : 'faltan'}{' '}
          <strong>{data.missingSubjectIds.length}</strong>{' '}
          {data.missingSubjectIds.length === 1 ? 'área' : 'áreas'} por medir.
        </p>
        <ul className="global-score-missing">
          {data.missingSubjectIds.map((subjectId) => {
            const theme = getSubjectTheme(subjectId)
            return (
              <li key={subjectId}>
                <span aria-hidden>{theme.emoji}</span> {theme.label}
              </li>
            )
          })}
        </ul>
        <p className="global-score-note">
          El puntaje global va de 0 a {MAX_GLOBAL_SCORE} y solo tiene sentido con las cinco áreas.
        </p>
      </div>
    )
  }

  const { score, margin, low, high, attemptCount } = data.estimate
  const leverageTheme = data.leverage == null ? null : getSubjectTheme(data.leverage.subjectId)

  return (
    <div className="card global-score">
      <div className="global-score-head">
        <p className="kicker">Tu puntaje global estimado</p>
        <span className="global-score-evidence">{attemptCount} preguntas</span>
      </div>

      <p className="global-score-value">
        <strong>{score}</strong>
        <span>/ {MAX_GLOBAL_SCORE}</span>
      </p>
      <p className="global-score-band">
        Rango probable: <strong>{low}–{high}</strong> (± {margin})
      </p>

      {/* The band, drawn to scale against the full 0-500 range. */}
      <div className="global-score-track" role="img" aria-label={`Entre ${low} y ${high} de ${MAX_GLOBAL_SCORE}`}>
        <span
          className="global-score-range"
          style={{
            left: `${(low / MAX_GLOBAL_SCORE) * 100}%`,
            width: `${((high - low) / MAX_GLOBAL_SCORE) * 100}%`,
          }}
        />
        <span className="global-score-marker" style={{ left: `${(score / MAX_GLOBAL_SCORE) * 100}%` }} />
        {data.target != null ? (
          <span
            className="global-score-target"
            style={{ left: `${(data.target / MAX_GLOBAL_SCORE) * 100}%` }}
            title={`Tu meta: ${data.target}`}
          />
        ) : null}
      </div>

      <div className="global-score-footer">
        {isEditingTarget ? (
          <form
            className="global-score-target-form"
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = Number(draft)
              if (Number.isFinite(parsed)) saveMutation.mutate(parsed)
            }}
          >
            <input
              type="number"
              min={0}
              max={MAX_GLOBAL_SCORE}
              className="global-score-target-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Tu meta de puntaje global"
              placeholder="350"
            />
            <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
              Guardar
            </button>
          </form>
        ) : data.target == null ? (
          <button type="button" className="btn-ghost global-score-target-cta" onClick={() => setIsEditingTarget(true)}>
            <Target size={14} /> Ponerme una meta
          </button>
        ) : (
          <button type="button" className="global-score-target-chip" onClick={() => setIsEditingTarget(true)}>
            <Target size={13} />
            Meta {data.target}
            {data.pointsToTarget != null && data.pointsToTarget > 0
              ? ` · te faltan ${data.pointsToTarget}`
              : ' · ¡ya la alcanzaste!'}
          </button>
        )}
      </div>

      {data.leverage != null && leverageTheme != null ? (
        <p className="global-score-leverage">
          <span aria-hidden>{leverageTheme.emoji}</span> Cada punto que subas en{' '}
          <strong>{leverageTheme.label}</strong> vale{' '}
          <strong>{data.leverage.pointsPerAreaPoint.toFixed(2)}</strong> puntos globales — es donde
          más rinde tu esfuerzo.
        </p>
      ) : null}

      <p className="global-score-note">
        Estimado con tus respuestas en Aprendo, no es un puntaje oficial del ICFES.
      </p>
    </div>
  )
}
