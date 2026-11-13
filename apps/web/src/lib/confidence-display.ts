import type { LearningState } from '@aprendo/convex/confidence'

export type { ConfidenceLevel, LearningState } from '@aprendo/convex/confidence'
import type { ConfidenceLevel } from '@aprendo/convex/confidence'

/**
 * How the three confidence levels are asked for. Wording matters more than
 * usual here: the student must feel safe admitting they guessed, or the signal
 * is worse than none.
 */
export const CONFIDENCE_OPTIONS: Array<{
  value: ConfidenceLevel
  label: string
  help: string
}> = [
  {
    value: 'sure',
    label: 'Seguro',
    help: 'Sé por qué esta es la respuesta.',
  },
  {
    value: 'unsure',
    label: 'Dudé',
    help: 'Descarté algunas, pero no estoy seguro.',
  },
  {
    value: 'guess',
    label: 'Adiviné',
    help: 'No sabía. Marcar esto no baja tu puntaje.',
  },
]

/** How each diagnosed state is named to the student. */
export const LEARNING_STATE_DISPLAY: Record<
  LearningState,
  { label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }
> = {
  mastered: { label: 'Seguro y bien', tone: 'good' },
  fragile: { label: 'Acertaste dudando', tone: 'warn' },
  misconception: { label: 'Seguro y mal', tone: 'danger' },
  gap: { label: 'Por aprender', tone: 'neutral' },
}
