/**
 * Desirable difficulty: practice questions the student should get right about
 * 70% of the time. Much easier teaches nothing new, much harder discourages;
 * the Elo model (`elo.ts`) predicts that probability for every question.
 *
 * Practice only (recommended, topic). Never nivelación or simulacros: those
 * measure, and choosing items by the student's ability would bend the result
 * toward 70% for everyone.
 */
import { DEFAULT_RATING, expectedScore } from './elo'

export const TARGET_SUCCESS = 0.7

/**
 * `questions` reordered so the best fit comes first; ties keep their incoming
 * order (unseen-first, stable bank order), so with nothing rated the order is
 * unchanged. Missing ratings — an unmeasured area or a new question — start at
 * `DEFAULT_RATING`, as Elo itself does.
 */
export function orderByDesirableDifficulty<T extends { subjectId?: string; difficultyRating?: number }>(
  questions: T[],
  abilityBySubject: Record<string, number> | undefined,
): T[] {
  const distance = (question: T) => {
    const ability = (question.subjectId == null ? undefined : abilityBySubject?.[question.subjectId]) ?? DEFAULT_RATING
    return Math.abs(expectedScore(ability, question.difficultyRating ?? DEFAULT_RATING) - TARGET_SUCCESS)
  }
  return questions
    .map((question, index) => ({ question, index, distance: distance(question) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map((item) => item.question)
}
