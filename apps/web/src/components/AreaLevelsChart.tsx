import type { CSSProperties, ReactNode } from 'react'
import type { AreaChartRow } from '../lib/progress-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'

/**
 * Every area on one 0-100 scale: the bar is today's score in the area's ink,
 * the thin lines are the ICFES cut points between levels, and the mark is
 * where the student started. One glance answers "where am I, and how far is
 * the next level".
 */
export function AreaLevelsChart({
  rows,
  emptyAction,
}: {
  rows: AreaChartRow[]
  /** What a row without a level offers instead (the student's "Nivelarme"). */
  emptyAction?: (subjectId: string) => ReactNode
}) {
  return (
    <div className="area-chart">
      <ul className="area-chart-rows">
        {rows.map((row) => {
          const theme = getSubjectTheme(row.subjectId)
          return (
            <li
              key={row.subjectId}
              className="area-chart-row"
              style={{ '--subject-color': theme.color } as CSSProperties}
            >
              <span className="area-chart-label">
                <span aria-hidden className="subject-dot" />
                {theme.label}
              </span>
              {row.score == null ? (
                <span className="area-chart-empty">
                  Sin nivel aún · {row.attemptCount} {row.attemptCount === 1 ? 'respuesta' : 'respuestas'}
                  {emptyAction?.(row.subjectId)}
                </span>
              ) : (
                <span
                  className="area-chart-track"
                  role="img"
                  aria-label={`${theme.label}: ${row.score} de 100, ${row.levelLabel}${
                    row.baseline != null ? `; empezaste en ${row.baseline}` : ''
                  }`}
                >
                  <span className="area-chart-fill" style={{ width: `${row.score}%` }} />
                  {row.cuts.map((cut) => (
                    <span key={cut} className="area-chart-cut" style={{ left: `${cut}%` }} />
                  ))}
                  {row.baseline != null ? (
                    <span className="area-chart-start" style={{ left: `${row.baseline}%` }} />
                  ) : null}
                </span>
              )}
              <span className={`area-chart-level${row.levelIndex === 1 ? ' is-low' : ''}`}>
                {row.levelLabel != null ? (
                  <>
                    <strong>{row.levelLabel}</strong>
                    <span className="area-chart-score">{row.score}/100</span>
                  </>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
      <p className="area-chart-legend">
        <span className="area-chart-legend-fill" aria-hidden /> hoy
        <span className="area-chart-legend-start" aria-hidden /> al nivelarte
        <span className="area-chart-legend-cut" aria-hidden /> cortes de nivel del ICFES
      </p>
      {rows.some((row) => row.nationalNote != null) ? (
        <ul className="area-chart-national">
          {rows.flatMap((row) =>
            row.nationalNote == null ? [] : [
              <li key={row.subjectId}>
                <strong>{getSubjectTheme(row.subjectId).label}:</strong> {row.nationalNote}
              </li>,
            ])}
        </ul>
      ) : null}
    </div>
  )
}
