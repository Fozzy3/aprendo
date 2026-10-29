/**
 * The ICFES Saber 11 global score (0-500), estimated from area scores.
 *
 * This is the number students, families and universities actually speak in —
 * levels and mastery percentages are our vocabulary, not theirs. A scholarship
 * threshold is quoted as "350", never as "Nivel 3 en cuatro áreas".
 *
 * Because it is the number they will believe, it is reported with an explicit
 * uncertainty band. An estimate from 14 questions is not the same thing as an
 * estimate from 400, and collapsing both to a bare integer would be a lie of
 * precision.
 *
 * Deliberately free of any `convex/*` import so the web app can consume it
 * through the `@aprendo/convex/globalScore` package export.
 */
import { MIN_ATTEMPTS_FOR_LEVEL, estimatedScoreFromAccuracy } from './levels'

/**
 * Official weights: the four core areas count 3, English counts 1.
 *
 * Source: ICFES Saber 11 orientation guide — the global score is
 * `(3·LC + 3·MAT + 3·CN + 3·SOC + 1·ING) / 13 × 5`, rounded to the nearest
 * integer, over per-area scores on the 0-100 scale.
 */
export const SUBJECT_WEIGHTS: Record<string, number> = {
  lectura_critica: 3,
  matematicas: 3,
  ciencias_naturales: 3,
  sociales_ciudadanas: 3,
  ingles: 1,
}

export const WEIGHT_TOTAL = 13
export const GLOBAL_SCALE = 5
export const MAX_GLOBAL_SCORE = 500

/** Areas that must all be present before a global score can be computed. */
export const REQUIRED_SUBJECT_IDS = Object.keys(SUBJECT_WEIGHTS)

/**
 * 95% coverage under a normal approximation. Only used to widen the reported
 * band, never to claim the estimate is normally distributed.
 */
const Z_95 = 1.96

export interface SubjectScoreInput {
  subjectId: string
  /** Area score on the 0-100 scale. */
  score: number
  /** Graded attempts behind that score — drives the uncertainty band. */
  attemptCount: number
}

export interface GlobalScoreEstimate {
  /** Point estimate, 0-500, rounded as ICFES rounds it. */
  score: number
  /** Half-width of the 95% band, in global-score points. */
  margin: number
  /** `score - margin`, clamped to the scale. */
  low: number
  /** `score + margin`, clamped to the scale. */
  high: number
  /** Total graded attempts behind the estimate, across all five areas. */
  attemptCount: number
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, value))
}

/**
 * Standard error of an area score, on the 0-100 scale.
 *
 * The binomial standard error of the underlying proportion, scaled up. With no
 * attempts there is no estimate at all, so the caller gets the widest possible
 * band rather than a fake zero.
 */
export function areaStandardError(score: number, attemptCount: number): number {
  if (attemptCount <= 0) return 50
  const proportion = clampScore(score) / 100
  return 100 * Math.sqrt((proportion * (1 - proportion)) / attemptCount)
}

/**
 * Combine five area scores into the global score, with a band.
 *
 * Returns null unless every area is present: a global score computed from three
 * areas is not a global score, and quietly substituting zeros (or the mean) for
 * the missing ones would produce a confident, wrong number. The UI says
 * "faltan 2 áreas por nivelar" instead.
 */
export function estimateGlobalScore(
  subjectScores: SubjectScoreInput[],
): GlobalScoreEstimate | null {
  const byId = new Map(subjectScores.map((entry) => [entry.subjectId, entry]))

  let weightedTotal = 0
  let varianceTotal = 0
  let attemptCount = 0

  for (const [subjectId, weight] of Object.entries(SUBJECT_WEIGHTS)) {
    const entry = byId.get(subjectId)
    if (entry == null) return null

    const score = clampScore(entry.score)
    weightedTotal += weight * score
    // Independent areas, so variances add under the squared weights.
    varianceTotal += weight ** 2 * areaStandardError(score, entry.attemptCount) ** 2
    attemptCount += Math.max(0, entry.attemptCount)
  }

  const factor = GLOBAL_SCALE / WEIGHT_TOTAL
  const score = Math.round(weightedTotal * factor)
  const margin = Math.round(Z_95 * factor * Math.sqrt(varianceTotal))

  return {
    score,
    margin,
    low: Math.max(0, score - margin),
    high: Math.min(MAX_GLOBAL_SCORE, score + margin),
    attemptCount,
  }
}

/**
 * How far a student's areas typically sit from each other, on the 0-100 scale.
 * ponytail: a fixed spread; fit it from real students once there are enough
 * with all five areas levelled.
 */
export const BETWEEN_AREA_SD = 15

/**
 * A global range before all five areas are levelled (F35): "hoy estarías entre
 * 230 y 330". Each missing area is taken at the mean of the measured ones, and
 * its uncertainty is how much a student's areas differ (`BETWEEN_AREA_SD`), so
 * the band is wide on day one and narrows with every area. Null with nothing
 * measured, or with everything measured (then `estimateGlobalScore` answers).
 */
export function provisionalGlobalRange(subjectScores: SubjectScoreInput[]) {
  const byId = new Map(subjectScores.map((entry) => [entry.subjectId, entry]))
  const measured = REQUIRED_SUBJECT_IDS.filter((subjectId) => byId.has(subjectId))
  if (measured.length === 0 || measured.length === REQUIRED_SUBJECT_IDS.length) return null
  const mean = measured.reduce((sum, subjectId) => sum + clampScore(byId.get(subjectId)!.score), 0) / measured.length

  let weightedTotal = 0
  let varianceTotal = 0
  for (const [subjectId, weight] of Object.entries(SUBJECT_WEIGHTS)) {
    const entry = byId.get(subjectId)
    const score = entry == null ? mean : clampScore(entry.score)
    weightedTotal += weight * score
    varianceTotal += weight ** 2 * (entry == null ? BETWEEN_AREA_SD ** 2 : areaStandardError(score, entry.attemptCount) ** 2)
  }
  const factor = GLOBAL_SCALE / WEIGHT_TOTAL
  const score = weightedTotal * factor
  const margin = Z_95 * factor * Math.sqrt(varianceTotal)
  return {
    low: Math.max(0, Math.round(score - margin)),
    high: Math.min(MAX_GLOBAL_SCORE, Math.round(score + margin)),
    missingCount: REQUIRED_SUBJECT_IDS.length - measured.length,
  }
}

/**
 * Which area would move the global score most per point gained.
 *
 * With equal weights on four of five areas this is simply the weakest weighted
 * area, but stating it as leverage keeps the advice honest when English (weight
 * 1) is the lowest score: gaining 10 points there is worth a third of gaining
 * 10 in Matemáticas, and the student should be told to work on the latter.
 */
export function highestLeverageSubject(
  subjectScores: SubjectScoreInput[],
): { subjectId: string; pointsPerAreaPoint: number; availablePoints: number } | null {
  const candidates = subjectScores
    .map((entry) => {
      const weight = SUBJECT_WEIGHTS[entry.subjectId]
      if (weight == null) return null
      // Headroom matters as much as weight: a 98 in Matemáticas has nothing left.
      const headroom = 100 - clampScore(entry.score)
      if (headroom <= 0) return null

      const pointsPerAreaPoint = (weight * GLOBAL_SCALE) / WEIGHT_TOTAL
      return {
        subjectId: entry.subjectId,
        pointsPerAreaPoint,
        availablePoints: pointsPerAreaPoint * headroom,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)

  if (candidates.length === 0) return null
  return candidates.reduce((best, entry) =>
    entry.availablePoints > best.availablePoints ? entry : best,
  )
}

/**
 * The global estimate as it stood at the end of each active week, oldest first.
 *
 * Cumulative raw accuracy per area, so a point exists only from the week every
 * area has `MIN_ATTEMPTS_FOR_LEVEL` graded attempts — the same evidence rule the
 * current estimate follows. Weeks without activity add no point: a flat line
 * drawn through weeks the student was away would claim a stagnation nobody saw.
 *
 * Callers pass settled attempts only (see `settledAttempts`).
 */
export function weeklyGlobalEstimates(
  attempts: { subjectId: string; isCorrect: boolean; weekIndex: number }[],
): { weekIndex: number; score: number }[] {
  const sorted = [...attempts].sort((a, b) => a.weekIndex - b.weekIndex)
  const totals = new Map<string, { attempts: number; correct: number }>()
  const points: { weekIndex: number; score: number }[] = []

  for (const [index, attempt] of sorted.entries()) {
    const total = totals.get(attempt.subjectId) ?? { attempts: 0, correct: 0 }
    total.attempts += 1
    if (attempt.isCorrect) total.correct += 1
    totals.set(attempt.subjectId, total)

    const weekEnds = sorted[index + 1]?.weekIndex !== attempt.weekIndex
    if (!weekEnds) continue

    const areas = REQUIRED_SUBJECT_IDS.map((subjectId) => {
      const area = totals.get(subjectId)
      return area == null || area.attempts < MIN_ATTEMPTS_FOR_LEVEL
        ? null
        : {
            subjectId,
            score: estimatedScoreFromAccuracy(area.correct / area.attempts),
            attemptCount: area.attempts,
          }
    })
    const estimate = areas.every((area) => area != null)
      ? estimateGlobalScore(areas.filter((area) => area != null))
      : null
    if (estimate != null) points.push({ weekIndex: attempt.weekIndex, score: estimate.score })
  }

  return points
}

/** Weekly points a trend needs before it is a trend rather than noise. */
export const MIN_WEEKLY_POINTS_FOR_TREND = 3

/**
 * Global points gained per week: the least-squares slope through the weekly
 * estimates. Null below three points — two points are a line through anything.
 */
export function globalPointsPerWeek(points: { weekIndex: number; score: number }[]): number | null {
  if (points.length < MIN_WEEKLY_POINTS_FOR_TREND) return null
  const meanX = points.reduce((sum, point) => sum + point.weekIndex, 0) / points.length
  const meanY = points.reduce((sum, point) => sum + point.score, 0) / points.length
  let covariance = 0
  let variance = 0
  for (const point of points) {
    covariance += (point.weekIndex - meanX) * (point.score - meanY)
    variance += (point.weekIndex - meanX) ** 2
  }
  return variance === 0 ? null : covariance / variance
}
