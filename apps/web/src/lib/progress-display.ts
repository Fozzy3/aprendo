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
}) {
  const hasScore = level.hasEnoughEvidence && level.currentScore != null && level.current != null
  return {
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
