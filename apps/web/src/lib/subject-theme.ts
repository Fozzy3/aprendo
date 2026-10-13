import { getSubjectLabel, SUBJECT_IDS } from '@aprendo/convex/taxonomy'

/**
 * The one place that decides how an ICFES area looks.
 *
 * The colours themselves live in `styles.css` as `--subject-<id>` tokens (so
 * they follow the light/dark theme); this module only resolves the token name
 * Labels come from the taxonomy contract via `getSubjectLabel`,
 * never redeclared here.
 */
export interface SubjectTheme {
  id: string
  label: string
  /** `var(--subject-…)` — safe to drop straight into a style prop. */
  color: string
  /** Same hue at low alpha, for fills behind text. */
  softColor: string
}

export function getSubjectTheme(subjectId: string): SubjectTheme {
  const isKnown = SUBJECT_IDS.includes(subjectId)
  const color = isKnown ? `var(--subject-${subjectId})` : 'var(--brand)'

  return {
    id: subjectId,
    label: getSubjectLabel(subjectId),
    color,
    softColor: `color-mix(in srgb, ${color} 14%, transparent)`,
  }
}

export function getAllSubjectThemes(): SubjectTheme[] {
  return SUBJECT_IDS.map(getSubjectTheme)
}
