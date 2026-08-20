import { getSubjectLabel, subjectIds } from './taxonomy'

/**
 * The one place that decides how an ICFES area looks.
 *
 * The colours themselves live in `styles.css` as `--subject-<id>` tokens (so
 * they follow the light/dark theme); this module only resolves the token name
 * and the icon. Labels come from the taxonomy contract via `getSubjectLabel`,
 * never redeclared here.
 */
export interface SubjectTheme {
  id: string
  label: string
  /** `var(--subject-…)` — safe to drop straight into a style prop. */
  color: string
  /** Same hue at low alpha, for fills behind text. */
  softColor: string
  emoji: string
}

const emojiBySubjectId: Record<string, string> = {
  lectura_critica: '📖',
  matematicas: '📐',
  ciencias_naturales: '🔬',
  sociales_ciudadanas: '🏛️',
  ingles: '🌍',
}

const FALLBACK_EMOJI = '✏️'

export function getSubjectTheme(subjectId: string): SubjectTheme {
  const isKnown = subjectIds.includes(subjectId)
  const color = isKnown ? `var(--subject-${subjectId})` : 'var(--brand)'

  return {
    id: subjectId,
    label: getSubjectLabel(subjectId),
    color,
    softColor: `color-mix(in srgb, ${color} 14%, transparent)`,
    emoji: emojiBySubjectId[subjectId] ?? FALLBACK_EMOJI,
  }
}

export function getAllSubjectThemes(): SubjectTheme[] {
  return subjectIds.map(getSubjectTheme)
}
