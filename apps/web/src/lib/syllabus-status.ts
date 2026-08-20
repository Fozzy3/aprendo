/**
 * Derives the study status of a syllabus node (subject or subtopic) from its
 * question inventory and the learner's mastery. Presentation logic only — the
 * backend returns raw counts and mastery; the UI decides the band.
 *
 * Thresholds mirror `getReadinessBand` in StudentProgressPage so the two
 * surfaces speak the same language.
 */
export type SyllabusStatus =
  | 'no_questions'
  | 'unpracticed'
  | 'reinforce'
  | 'developing'
  | 'mastered'

export interface SyllabusStatusBand {
  status: SyllabusStatus
  label: string
  /** Color token for the mastery ring / bar fill. */
  color: string
  /** Tailwind classes (over CSS tokens) for the status chip. */
  tone: string
}

const NEUTRAL_TONE = 'bg-[var(--bg-inset)] text-[var(--text-secondary)] border-[var(--border)]'
const ACCENT_TONE = 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-transparent'
const SUCCESS_TONE = 'bg-[var(--success-soft)] text-[var(--success-text)] border-transparent'

export function getSyllabusStatus(input: {
  questionCount: number
  attemptCount: number
  mastery: number | null
}): SyllabusStatusBand {
  if (input.questionCount === 0) {
    return {
      status: 'no_questions',
      label: 'Sin preguntas aún',
      color: 'var(--text-tertiary)',
      tone: 'bg-[var(--bg-inset)] text-[var(--text-tertiary)] border-[var(--border)]',
    }
  }
  if (input.attemptCount === 0 || input.mastery == null) {
    return {
      status: 'unpracticed',
      label: 'Sin practicar',
      color: 'var(--text-tertiary)',
      tone: NEUTRAL_TONE,
    }
  }
  if (input.mastery >= 0.72) {
    return { status: 'mastered', label: 'Dominado', color: 'var(--success)', tone: SUCCESS_TONE }
  }
  if (input.mastery >= 0.5) {
    return { status: 'developing', label: 'En progreso', color: 'var(--accent)', tone: ACCENT_TONE }
  }
  return {
    status: 'reinforce',
    label: 'A reforzar',
    color: 'var(--accent-text)',
    tone: ACCENT_TONE,
  }
}

export function formatMasteryPercent(mastery: number | null): string {
  if (mastery == null) return '—'
  return `${Math.round(mastery * 100)}%`
}
