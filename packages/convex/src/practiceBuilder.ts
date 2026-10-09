/**
 * "Práctica a tu medida": the student picks area, subtopics, difficulty, which
 * questions (all, unseen, missed, flagged) and how many. This module validates
 * the choice and filters the bank; `sessions.ts` reads the data and keeps
 * shared-text groups whole. Pure, and free of `convex/*` imports so the web can
 * use the same constants.
 */
import { SUBJECT_IDS, getSubjectIdForSubtopic } from './taxonomy'

export const PRACTICE_DIFFICULTIES = ['basico', 'medio', 'avanzado'] as const
export type PracticeDifficulty = (typeof PRACTICE_DIFFICULTIES)[number]

export const PRACTICE_SOURCES = ['todas', 'no_vistas', 'falladas', 'marcadas'] as const
export type PracticeSource = (typeof PRACTICE_SOURCES)[number]

export const MIN_PRACTICE_QUESTIONS = 5
export const MAX_PRACTICE_QUESTIONS = 30

export interface PracticeFilters {
  subjectId?: string
  subtopicIds?: string[]
  difficulty?: PracticeDifficulty
  source: PracticeSource
}

/**
 * The student's history as the source filter reads it: questions shown to them
 * (`seen`), whose latest settled answer was wrong (`wrong`), and flagged.
 */
export interface PracticeHistory {
  seen: ReadonlySet<string>
  wrong: ReadonlySet<string>
  flagged: ReadonlySet<string>
}

type BankQuestion = {
  _id: string
  subjectId?: string
  primarySubtopicId?: string
  difficultyRating?: number
}

export function practiceCountError(count: number): string | null {
  return Number.isInteger(count) && count >= MIN_PRACTICE_QUESTIONS && count <= MAX_PRACTICE_QUESTIONS
    ? null
    : `Elige entre ${MIN_PRACTICE_QUESTIONS} y ${MAX_PRACTICE_QUESTIONS} preguntas.`
}

/**
 * Where to draw from. `subjectId` is the single area of the selection (given,
 * or the one its subtopics share), null for the whole bank or several areas;
 * `subtopicIds` null means every subtopic of that scope.
 */
export function resolvePracticeScope(filters: Pick<PracticeFilters, 'subjectId' | 'subtopicIds'>):
  | { subjectId: string | null; subtopicIds: string[] | null }
  | { error: string } {
  if (filters.subjectId != null && !SUBJECT_IDS.includes(filters.subjectId)) {
    return { error: 'Selecciona un área válida.' }
  }
  const subtopicIds = filters.subtopicIds?.length ? [...new Set(filters.subtopicIds)] : null
  if (subtopicIds == null) return { subjectId: filters.subjectId ?? null, subtopicIds: null }

  const parents = subtopicIds.map(getSubjectIdForSubtopic)
  if (parents.some((parent) => parent == null)) return { error: 'Selecciona subtemas válidos.' }
  if (filters.subjectId != null && parents.some((parent) => parent !== filters.subjectId)) {
    return { error: 'Los subtemas deben ser del área que elegiste.' }
  }
  const areas = new Set(parents)
  return { subjectId: areas.size === 1 ? (parents[0] ?? null) : null, subtopicIds }
}

/**
 * Básico / Medio / Avanzado as the easiest, middle and hardest third of the
 * rated questions in the pool (lower Elo rating = easier). Unrated questions
 * have no evidence either way: they count as medio.
 */
export function difficultyTiers(questions: BankQuestion[]): Map<string, PracticeDifficulty> {
  const tiers = new Map<string, PracticeDifficulty>()
  const rated = questions
    .filter((question) => question.difficultyRating != null)
    .sort((a, b) => (a.difficultyRating ?? 0) - (b.difficultyRating ?? 0))
  rated.forEach((question, index) => {
    // index / length against 1/3 and 2/3, in integers so no rounding moves a cut.
    const tier = index * 3 < rated.length ? 'basico' : index * 3 >= rated.length * 2 ? 'avanzado' : 'medio'
    tiers.set(question._id, tier)
  })
  for (const question of questions) {
    if (!tiers.has(question._id)) tiers.set(question._id, 'medio')
  }
  return tiers
}

function inScope(question: BankQuestion, filters: PracticeFilters) {
  if (filters.subjectId != null && question.subjectId !== filters.subjectId) return false
  if (filters.subtopicIds?.length) {
    return question.primarySubtopicId != null && filters.subtopicIds.includes(question.primarySubtopicId)
  }
  return true
}

function matchesSource(questionId: string, source: PracticeSource, history: PracticeHistory) {
  switch (source) {
    case 'todas':
      return true
    case 'no_vistas':
      return !history.seen.has(questionId)
    case 'falladas':
      return history.wrong.has(questionId)
    case 'marcadas':
      return history.flagged.has(questionId)
  }
}

/** The bank questions that match the filters, in their incoming order. */
export function filterPracticeQuestions<T extends BankQuestion>(
  questions: T[],
  filters: PracticeFilters,
  history: PracticeHistory,
): T[] {
  return practiceCandidates(questions, filters, history).filter(
    (item) => filters.difficulty == null || item.tier === filters.difficulty,
  ).map((item) => item.question)
}

/** "N preguntas disponibles", plus how the rest of the filters split by difficulty. */
export function practiceBuilderCounts(
  questions: BankQuestion[],
  filters: PracticeFilters,
  history: PracticeHistory,
) {
  const byDifficulty: Record<PracticeDifficulty, number> = { basico: 0, medio: 0, avanzado: 0 }
  for (const item of practiceCandidates(questions, filters, history)) byDifficulty[item.tier] += 1
  return {
    available: filters.difficulty == null
      ? byDifficulty.basico + byDifficulty.medio + byDifficulty.avanzado
      : byDifficulty[filters.difficulty],
    byDifficulty,
  }
}

/** Scope and source applied; tiers measured over the whole scope, before the source narrows it. */
function practiceCandidates<T extends BankQuestion>(
  questions: T[],
  filters: PracticeFilters,
  history: PracticeHistory,
) {
  const scoped = questions.filter((question) => inScope(question, filters))
  const tiers = difficultyTiers(scoped)
  return scoped
    .filter((question) => matchesSource(question._id, filters.source, history))
    .map((question) => ({ question, tier: tiers.get(question._id) ?? 'medio' }))
}
