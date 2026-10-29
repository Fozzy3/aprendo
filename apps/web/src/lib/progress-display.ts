import { getSubjectLevels } from '@aprendo/convex/levels'

/**
 * One area as a bar on the 0-100 ICFES scale: today's score, where the student
 * started (the nivelación) and the official cut points between levels. No
 * evidence, no score: the row says so instead of drawing a guess.
 */
export function areaChartRow(level: {
  subjectId: string
  hasEnoughEvidence: boolean
  currentScore: number | null
  baselineScore: number | null
  attemptCount: number
  current: { band: { labelEs: string }; index: number } | null
  national?: { shareAtThisLevel: number | null; year: number | null } | null
}) {
  const hasScore = level.hasEnoughEvidence && level.currentScore != null && level.current != null
  const share = level.national?.shareAtThisLevel ?? null
  return {
    // Only figures the ICFES national report states (docs/national-results.v1.json).
    nationalNote: hasScore && share != null
      ? `El ${share}% del país está en ${level.current!.band.labelEs} (ICFES ${level.national?.year}).`
      : null,
    subjectId: level.subjectId,
    score: hasScore ? level.currentScore : null,
    baseline: level.baselineScore,
    levelLabel: hasScore ? level.current!.band.labelEs : null,
    levelIndex: hasScore ? level.current!.index : null,
    attemptCount: level.attemptCount,
    cuts: (getSubjectLevels(level.subjectId)?.bands ?? []).map((band) => band.minScore).filter((score) => score > 0),
  }
}

export type AreaChartRow = ReturnType<typeof areaChartRow>

/**
 * How far the areas moved since their nivelación, averaged, as a 0-1 fraction.
 *
 * Not raw accuracy: practice is adaptive and aims at ~70% right, so accuracy
 * drifts there whether the student improves or not. The area score is the
 * Elo-calibrated estimate, on the same 0-100 scale as the nivelación's.
 */
export function changeSincePlacement(
  levels: { hasEnoughEvidence: boolean; currentScore: number | null; baselineScore: number | null }[],
): number | null {
  const deltas = levels.flatMap((level) =>
    level.hasEnoughEvidence && level.currentScore != null && level.baselineScore != null
      ? [level.currentScore - level.baselineScore]
      : [],
  )
  if (deltas.length === 0) return null
  return deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length / 100
}

/**
 * The week's focus area: the area of the plan's first pick (`studyPlan.nextSubtopics`,
 * weighted by ICFES points), so Hoy, Ruta and Progreso agree. Lowest mastery
 * stands in only while the plan has nothing to pick.
 */
export function focusSubjectId(
  nextSubtopics: { subjectId: string }[],
  subjects: { subjectId: string; masteryScore: number }[],
): string | null {
  return nextSubtopics[0]?.subjectId
    ?? [...subjects].sort((a, b) => a.masteryScore - b.masteryScore)[0]?.subjectId
    ?? null
}

/** How a class spreads over the four levels of one area; `none` is not levelled yet. */
export function levelDistribution(
  students: { subjects: { subjectId: string; levelIndex: number | null }[] }[],
  subjectId: string,
) {
  const byLevel = [0, 0, 0, 0]
  let none = 0
  for (const student of students) {
    const index = student.subjects.find((subject) => subject.subjectId === subjectId)?.levelIndex ?? null
    if (index == null || index < 1 || index > byLevel.length) none += 1
    else byLevel[index - 1]! += 1
  }
  return { none, byLevel, total: students.length }
}

/** The competencies a class misses most: the five worth a teacher's next class. */
export function weakestCompetencies<T extends { accuracy: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5)
}
