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
  emoji: string
  help: string
}> = [
  {
    value: 'sure',
    label: 'Seguro',
    emoji: '💪',
    help: 'Sé por qué esta es la respuesta.',
  },
  {
    value: 'unsure',
    label: 'Dudé',
    emoji: '🤔',
    help: 'Descarté algunas, pero no estoy seguro.',
  },
  {
    value: 'guess',
    label: 'Adiviné',
    emoji: '🎲',
    help: 'No sabía. Marcar esto no baja tu puntaje.',
  },
]

/** How each diagnosed state is named and explained to the student. */
export const LEARNING_STATE_DISPLAY: Record<
  LearningState,
  { label: string; description: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }
> = {
  mastered: {
    label: 'Dominado',
    description: 'Respondiste bien y sabías por qué.',
    tone: 'good',
  },
  fragile: {
    label: 'Frágil',
    description: 'Acertaste, pero sin estar seguro. En el examen puede no repetirse.',
    tone: 'warn',
  },
  misconception: {
    label: 'Error de concepto',
    description: 'Estabas seguro y fallaste. Esto es lo más urgente de revisar.',
    tone: 'danger',
  },
  gap: {
    label: 'Por aprender',
    description: 'Fallaste y ya sabías que no lo dominabas.',
    tone: 'neutral',
  },
}
