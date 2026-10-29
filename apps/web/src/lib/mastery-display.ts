import { MASTERY_LEVELS, MASTERY_LEVEL_LABELS, summarizeMastery, type MasteryLevel } from '@aprendo/convex/mastery'

/**
 * Khan's five mastery levels as Temario, Ruta and Progreso read them. The
 * levels themselves move on the backend (`mastery.ts`); this only decides how a
 * scope adds them up and which Ruta nodes are open.
 */

const rank = (level: MasteryLevel) => MASTERY_LEVELS.indexOf(level)

export function masteryLevelMap(entries: { subtopicId: string; masteryLevel: MasteryLevel }[]) {
  return new Map(entries.map((entry) => [entry.subtopicId, entry.masteryLevel]))
}

/** `getStudentProgress` lists practised subtopics only: the rest are sin_empezar. */
export function levelFor(map: Map<string, MasteryLevel>, subtopicId: string): MasteryLevel {
  return map.get(subtopicId) ?? 'sin_empezar'
}

/** A syllabus subject's subtopics, each with the student's level. */
export function subjectSubtopics<S extends { id: string }>(
  subject: { categories: { subtopics: S[] }[] },
  levels: Map<string, MasteryLevel>,
): (S & { level: MasteryLevel })[] {
  return subject.categories.flatMap((category) =>
    category.subtopics.map((subtopic) => ({ ...subtopic, level: levelFor(levels, subtopic.id) })),
  )
}

/**
 * The subtopics a scope counts — the one denominator Temario, Ruta and
 * Progreso share. A subtopic with no questions cannot be practised, so it only
 * counts once the student has a level in it.
 */
export function countedSubtopics<T extends { questionCount: number; level: MasteryLevel }>(subtopics: T[]): T[] {
  return subtopics.filter((subtopic) => subtopic.questionCount > 0 || subtopic.level !== 'sin_empezar')
}

/** A subject's or course's mastery, over `countedSubtopics`. */
export function scopeMastery(subtopics: { questionCount: number; level: MasteryLevel }[]) {
  const counted = countedSubtopics(subtopics)
  return summarizeMastery(counted.map((subtopic) => subtopic.level), counted.length)
}

/** Subtopics per level; whatever is not listed is sin_empezar. */
export function countByLevel(levels: MasteryLevel[], total: number): Record<MasteryLevel, number> {
  const counts = Object.fromEntries(MASTERY_LEVELS.map((level) => [level, 0])) as Record<MasteryLevel, number>
  for (const level of levels) counts[level] += 1
  counts.sin_empezar = Math.max(0, total - (levels.length - counts.sin_empezar))
  return counts
}

export type PathState = 'mastered' | 'current' | 'available' | 'empty'

/**
 * Ruta: the taxonomy order, nothing locked (the ICFES areas have no strict
 * prerequisites, and a lock only slowed students down). "Estás aquí" goes on
 * the plan's pick for this area (`studyPlan.nextSubtopics`), or on the first
 * open subtopic when the plan picks none here. Competente and Dominado are done.
 */
export function resolvePathStates(
  nodes: { subtopicId: string; questionCount: number; level: MasteryLevel }[],
  recommendedIds: string[],
): PathState[] {
  const isOpen = (node: (typeof nodes)[number]) =>
    rank(node.level) < rank('competente') && !(node.questionCount === 0 && node.level === 'sin_empezar')
  const current =
    nodes.find((node) => isOpen(node) && recommendedIds.includes(node.subtopicId)) ?? nodes.find(isOpen)
  return nodes.map((node) => {
    if (rank(node.level) >= rank('competente')) return 'mastered'
    if (node.questionCount === 0 && node.level === 'sin_empezar') return 'empty'
    return node === current ? 'current' : 'available'
  })
}

// What each level needs to climb, in the rules of `mastery.ts`.
const NEXT_STEP: Record<MasteryLevel, string> = {
  sin_empezar: 'Para Familiar: acierta 7 de cada 10 en una práctica del tema.',
  intentado: 'Para Familiar: acierta 7 de cada 10 en una práctica del tema.',
  familiar: 'Para Competente: una práctica perfecta de 4 o más preguntas, sin pedir ayuda al tutor.',
  competente: 'Para Dominado: acierta todo el tema en un reto, una nivelación o un simulacro.',
  dominado: 'Es el nivel más alto: el repaso y los retos lo mantienen.',
}

/** One line of a session's close: the step it took, or what the next one needs. */
export function closingLine(change: { from: MasteryLevel; to: MasteryLevel }): { moved: 'up' | 'down' | 'same'; text: string } {
  if (change.from === change.to) {
    return { moved: 'same', text: `Sigue en ${MASTERY_LEVEL_LABELS[change.to]}. ${NEXT_STEP[change.to]}` }
  }
  return {
    moved: rank(change.to) > rank(change.from) ? 'up' : 'down',
    text: `${MASTERY_LEVEL_LABELS[change.from]} → ${MASTERY_LEVEL_LABELS[change.to]}`,
  }
}
