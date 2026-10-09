import { MASTERY_LEVELS, MASTERY_LEVEL_LABELS, type MasteryLevel } from '@aprendo/convex/mastery'

/**
 * One colour ramp for the five levels, shared by the badge meter and the
 * Progreso bars: brand violet that deepens with evidence, and success green
 * only for Dominado (colour means state).
 */
export const MASTERY_LEVEL_COLOR: Record<MasteryLevel, string> = {
  sin_empezar: 'var(--bg-inset)',
  intentado: 'color-mix(in srgb, var(--accent) 30%, var(--bg-card))',
  familiar: 'color-mix(in srgb, var(--accent) 60%, var(--bg-card))',
  competente: 'var(--accent)',
  dominado: 'var(--success)',
}

const BAR_HEIGHTS = [4, 6, 8, 10]

/** Signal-style bars: how many are filled is the level, so it reads without colour. */
function LevelMeter({ level }: { level: MasteryLevel }) {
  const filled = MASTERY_LEVELS.indexOf(level)
  return (
    <span aria-hidden className="inline-flex items-end gap-[2px]">
      {BAR_HEIGHTS.map((height, index) => (
        <span
          key={height}
          className="w-[3px] rounded-[1px]"
          style={{
            height,
            background: index < filled ? MASTERY_LEVEL_COLOR[level] : 'var(--border-strong)',
          }}
        />
      ))}
    </span>
  )
}

export function MasteryBadge({ level }: { level: MasteryLevel }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--text-secondary)]">
      <LevelMeter level={level} />
      {MASTERY_LEVEL_LABELS[level]}
    </span>
  )
}

/** The five levels in order, with the one rule a student needs to know. */
export function MasteryLegend() {
  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Niveles de dominio">
        {MASTERY_LEVELS.map((level) => (
          <li key={level}>
            <MasteryBadge level={level} />
          </li>
        ))}
      </ul>
      <p className="text-[0.6875rem] text-[var(--text-tertiary)]">
        Practicando un tema llegas hasta Competente. Dominado se gana en sesiones que
        mezclan temas (reto, nivelación, simulacro, práctica recomendada), y fallar ahí
        puede bajarte un nivel.
      </p>
    </div>
  )
}
