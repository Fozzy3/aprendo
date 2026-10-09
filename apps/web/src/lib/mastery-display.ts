import { MASTERY_LEVELS, summarizeMastery, type MasteryLevel } from '@aprendo/convex/mastery'

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

export type PathState = 'mastered' | 'current' | 'available' | 'locked' | 'empty'

/**
 * Ruta: a node opens once the one before it reaches Familiar. Competente and
 * Dominado count as done. A subtopic with no questions is skipped instead of
 * blocking the rest, and one already practised from elsewhere is never locked.
 */
export function resolvePathStates(nodes: { questionCount: number; level: MasteryLevel }[]): PathState[] {
  let gateOpen = true
  let currentAssigned = false
  return nodes.map((node) => {
    if (rank(node.level) >= rank('competente')) {
      gateOpen = true
      return 'mastered'
    }
    if (node.questionCount === 0 && node.level === 'sin_empezar') return 'empty'

    const unlocked = gateOpen || node.level !== 'sin_empezar'
    gateOpen = rank(node.level) >= rank('familiar')
    if (!unlocked) return 'locked'
    if (!currentAssigned) {
      currentAssigned = true
      return 'current'
    }
    return 'available'
  })
}
