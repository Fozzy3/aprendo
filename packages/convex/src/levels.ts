import levelsContract from '../../../docs/levels.v1.json'

/**
 * ICFES Saber 11 performance levels.
 *
 * Same shape as `taxonomy.ts`: a declarative JSON contract plus pure lookups.
 * Deliberately free of any `convex/*` import so it can also be consumed by the
 * web app through the `@aprendo/convex/levels` package export.
 *
 * The cut points themselves live in `docs/levels.v1.json` so they can be
 * corrected against the official ICFES guide without touching code.
 */

export interface LevelBand {
  id: string
  labelEs: string
  minScore: number
  descriptorEs: string
}

export interface SubjectLevels {
  subjectId: string
  scale: 'numeric_1_4' | 'cefr'
  bands: LevelBand[]
}

export interface LevelPlacement {
  /** The band the score falls in. */
  band: LevelBand
  /** 1-based position of the band within the subject's scale. */
  index: number
  /** Total bands for this subject (4 in every area: levels 1-4, or Pre A1-B1). */
  bandCount: number
  /** The next band up, or null when already at the top. */
  nextBand: LevelBand | null
  /** Points still needed to reach `nextBand`, or null at the top band. */
  pointsToNextBand: number | null
}

/** Graded attempts required in an area before a level is claimed at all. */
export const MIN_ATTEMPTS_FOR_LEVEL = levelsContract.evidence.minAttempts

const levelsBySubjectId = new Map<string, SubjectLevels>()
for (const subject of levelsContract.subjects) {
  levelsBySubjectId.set(subject.id, {
    subjectId: subject.id,
    scale: subject.scale as SubjectLevels['scale'],
    bands: subject.bands
      .map((band) => ({
        id: band.id,
        labelEs: band.label_es,
        minScore: band.minScore,
        descriptorEs: band.descriptor_es,
      }))
      // The contract documents ascending order; sorting makes the lookup below
      // correct even if an edit gets the order wrong.
      .sort((a, b) => a.minScore - b.minScore),
  })
}

export const LEVELLED_SUBJECT_IDS = [...levelsBySubjectId.keys()]

export function getSubjectLevels(subjectId: string): SubjectLevels | undefined {
  return levelsBySubjectId.get(subjectId)
}

/**
 * Place a 0-100 area score on that area's scale.
 *
 * Returns null for an unknown subject. Evidence is *not* considered here — the
 * caller decides whether it has enough attempts to claim a level (see
 * `MIN_ATTEMPTS_FOR_LEVEL`), because that is a product rule, not a scale rule.
 */
export function getLevelForScore(subjectId: string, score: number): LevelPlacement | null {
  const subject = levelsBySubjectId.get(subjectId)
  if (subject == null || subject.bands.length === 0) return null

  const clamped = Math.min(100, Math.max(0, score))

  let index = 0
  for (let position = 0; position < subject.bands.length; position += 1) {
    const band = subject.bands[position]
    if (band != null && clamped >= band.minScore) index = position
  }

  const band = subject.bands[index]
  if (band == null) return null

  const nextBand = subject.bands[index + 1] ?? null

  return {
    band,
    index: index + 1,
    bandCount: subject.bands.length,
    nextBand,
    pointsToNextBand: nextBand == null ? null : Math.ceil(nextBand.minScore - clamped),
  }
}

/**
 * Convert an accuracy (0-1) into the 0-100 area score the levels are defined
 * over.
 *
 * V1 is deliberately a direct mapping rather than an equated ICFES scale score:
 * it is honest about what it measures (share correct on Aprendo's own bank) and
 * has no calibration data behind it. If real equating arrives later, this is the
 * single function to change.
 */
export function estimatedScoreFromAccuracy(accuracy: number): number {
  return Math.round(Math.min(1, Math.max(0, accuracy)) * 100)
}
