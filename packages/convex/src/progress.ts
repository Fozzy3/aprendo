import { internalMutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { assertOwnsStudent } from './auth'
import { colombiaDayNumber, colombiaWeekIndex, colombiaWeekStartMs } from './colombiaTime'
import {
  LEVELLED_SUBJECT_IDS,
  MIN_ATTEMPTS_FOR_LEVEL,
  estimatedScoreFromAccuracy,
  getLevelForScore,
  getSubjectLevels,
} from './levels'
import { DEFAULT_RATING, expectedScore } from './elo'
import { estimateGlobalScore, highestLeverageSubject } from './globalScore'
import { getNationalPercentileAtOrBelow, getNationalShare } from './national'
import { summarizeConfidence, type ConfidenceLevel } from './confidence'
import { settledAttempts } from './sessionIntegrity'
import { RETO_SUBTOPIC_COUNT, masteryLevelOf, orderRetoCandidates } from './mastery'

const RECENT_WINDOW_SIZE = 5

type AttemptMetric = {
  isCorrect: boolean
  answeredAt: number
  responseTimeMs: number
  usedHint: boolean
  usedTutor: boolean
}

function calculateAccuracy(correctCount: number, attemptCount: number) {
  if (attemptCount === 0) return 0
  return correctCount / attemptCount
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function evidenceLevel(attemptCount: number) {
  if (attemptCount >= 6) return 'high'
  if (attemptCount >= 3) return 'medium'
  return 'low'
}

function masteryScore(metrics: {
  accuracy: number
  recentAccuracy: number
  hintRate: number
  tutorRate: number
  attemptCount: number
}) {
  const evidenceBoost = Math.min(metrics.attemptCount / 6, 1) * 0.05
  return Math.max(
    0,
    Math.min(
      1,
      metrics.recentAccuracy * 0.55
      + metrics.accuracy * 0.4
      + evidenceBoost
      - metrics.hintRate * 0.08
      - metrics.tutorRate * 0.04,
    ),
  )
}

function summarizeAttempts(attempts: AttemptMetric[]) {
  const sorted = [...attempts].sort((a, b) => a.answeredAt - b.answeredAt)
  const recent = sorted.slice(-RECENT_WINDOW_SIZE)
  const attemptCount = sorted.length
  const correctCount = sorted.filter((attempt) => attempt.isCorrect).length
  const recentAttemptCount = recent.length
  const recentCorrectCount = recent.filter((attempt) => attempt.isCorrect).length
  const avgResponseTimeMs = average(
    sorted
      .map((attempt) => attempt.responseTimeMs)
      .filter((value) => Number.isFinite(value) && value > 0),
  )
  const hintRate = calculateAccuracy(
    sorted.filter((attempt) => attempt.usedHint).length,
    attemptCount,
  )
  const tutorRate = calculateAccuracy(
    sorted.filter((attempt) => attempt.usedTutor).length,
    attemptCount,
  )
  const accuracy = calculateAccuracy(correctCount, attemptCount)
  const recentAccuracy = calculateAccuracy(recentCorrectCount, recentAttemptCount)
  const lastAttemptAt = sorted.at(-1)?.answeredAt

  return {
    attemptCount,
    correctCount,
    accuracy,
    recentAttemptCount,
    recentAccuracy,
    avgResponseTimeMs,
    hintRate,
    tutorRate,
    lastAttemptAt,
    masteryScore: masteryScore({
      accuracy,
      recentAccuracy,
      hintRate,
      tutorRate,
      attemptCount,
    }),
    evidenceLevel: evidenceLevel(attemptCount),
  }
}

export const rebuildStudentProgress = internalMutation({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    const attempts = await ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()

    // Only finished sittings: an open one would leak its grades through the
    // area accuracy, and an abandoned one was never evidence.
    const completedAttempts = settledAttempts(attempts, sessions).filter(
      (attempt) => attempt.isCorrect != null && attempt.answeredAt != null,
    )
    const questionIds = [...new Set(completedAttempts.map((attempt) => attempt.questionId))]
    const questions = await Promise.all(
      questionIds.map((questionId) => ctx.db.get('questions', questionId)),
    )
    const questionById = new Map(
      questions
        .filter((question): question is NonNullable<typeof question> => question != null)
        .map((question) => [question._id, question]),
    )

    const subjectBuckets = new Map<string, AttemptMetric[]>()
    const subtopicBuckets = new Map<
      string,
      {
        subjectId: string
        categoryId: string
        subtopicId: string
        attempts: AttemptMetric[]
      }
    >()
    const overallAttempts: AttemptMetric[] = []

    for (const attempt of completedAttempts) {
      const question = questionById.get(attempt.questionId)
      if (
        question == null
        || question.subjectId == null
        || question.primarySubtopicId == null
        || question.categoryId == null
        || attempt.answeredAt == null
        || attempt.isCorrect == null
      ) {
        continue
      }

      const metric: AttemptMetric = {
        isCorrect: attempt.isCorrect,
        answeredAt: attempt.answeredAt,
        responseTimeMs: attempt.responseTimeMs ?? 0,
        usedHint: attempt.usedHint,
        usedTutor: attempt.usedTutor,
      }
      overallAttempts.push(metric)

      const subjectAttempts = subjectBuckets.get(question.subjectId) ?? []
      subjectAttempts.push(metric)
      subjectBuckets.set(question.subjectId, subjectAttempts)

      const subtopicKey = `${question.subjectId}::${question.primarySubtopicId}`
      const subtopicEntry = subtopicBuckets.get(subtopicKey) ?? {
        subjectId: question.subjectId,
        categoryId: question.categoryId,
        subtopicId: question.primarySubtopicId,
        attempts: [],
      }
      subtopicEntry.attempts.push(metric)
      subtopicBuckets.set(subtopicKey, subtopicEntry)
    }

    const existingSubjectAggregates = await ctx.db
      .query('learnerSubjectAggregates')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    for (const aggregate of existingSubjectAggregates) {
      await ctx.db.delete('learnerSubjectAggregates', aggregate._id)
    }

    const existingSubtopicAggregates = await ctx.db
      .query('learnerSubtopicAggregates')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    // Mastery levels are not derived from the attempts here: each session moved
    // them once (`sessions.completeSession`), so they survive the rebuild.
    const masteryBySubtopicId = new Map(
      existingSubtopicAggregates.map((aggregate) => [
        aggregate.subtopicId,
        { masteryLevel: aggregate.masteryLevel, masteryUpdatedAt: aggregate.masteryUpdatedAt },
      ]),
    )
    for (const aggregate of existingSubtopicAggregates) {
      await ctx.db.delete('learnerSubtopicAggregates', aggregate._id)
    }

    const now = Date.now()
    const subjectSummaries = [...subjectBuckets.entries()].map(([subjectId, metrics]) => ({
      subjectId,
      ...summarizeAttempts(metrics),
    }))
    for (const summary of subjectSummaries) {
      await ctx.db.insert('learnerSubjectAggregates', {
        studentId: args.studentId,
        subjectId: summary.subjectId,
        attemptCount: summary.attemptCount,
        correctCount: summary.correctCount,
        accuracy: summary.accuracy,
        recentAttemptCount: summary.recentAttemptCount,
        recentAccuracy: summary.recentAccuracy,
        avgResponseTimeMs: summary.avgResponseTimeMs,
        hintRate: summary.hintRate,
        tutorRate: summary.tutorRate,
        lastAttemptAt: summary.lastAttemptAt,
        masteryScore: summary.masteryScore,
        evidenceLevel: summary.evidenceLevel,
        updatedAt: now,
      })
    }

    const subtopicSummaries = [...subtopicBuckets.values()].map((entry) => ({
      subjectId: entry.subjectId,
      categoryId: entry.categoryId,
      subtopicId: entry.subtopicId,
      ...summarizeAttempts(entry.attempts),
    }))
    for (const summary of subtopicSummaries) {
      await ctx.db.insert('learnerSubtopicAggregates', {
        studentId: args.studentId,
        subjectId: summary.subjectId,
        categoryId: summary.categoryId,
        subtopicId: summary.subtopicId,
        attemptCount: summary.attemptCount,
        correctCount: summary.correctCount,
        accuracy: summary.accuracy,
        recentAttemptCount: summary.recentAttemptCount,
        recentAccuracy: summary.recentAccuracy,
        avgResponseTimeMs: summary.avgResponseTimeMs,
        hintRate: summary.hintRate,
        tutorRate: summary.tutorRate,
        lastAttemptAt: summary.lastAttemptAt,
        masteryScore: summary.masteryScore,
        evidenceLevel: summary.evidenceLevel,
        updatedAt: now,
        ...masteryBySubtopicId.get(summary.subtopicId),
      })
    }

    const existingSnapshot = await ctx.db
      .query('learnerProfileSnapshots')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .unique()
    if (existingSnapshot) {
      await ctx.db.delete('learnerProfileSnapshots', existingSnapshot._id)
    }

    const overallSummary = summarizeAttempts(overallAttempts)
    const strongestSubjectIds = [...subjectSummaries]
      .sort((a, b) => b.masteryScore - a.masteryScore)
      .slice(0, 3)
      .map((summary) => summary.subjectId)
    const weakestSubjectIds = [...subjectSummaries]
      .sort((a, b) => a.masteryScore - b.masteryScore)
      .slice(0, 3)
      .map((summary) => summary.subjectId)
    const weakestSubtopicIds = [...subtopicSummaries]
      .sort((a, b) => a.masteryScore - b.masteryScore)
      .slice(0, 5)
      .map((summary) => summary.subtopicId)

    const completedDiagnosticSessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind', (q) =>
        q.eq('studentId', args.studentId).eq('kind', 'diagnostic'),
      )
      .collect()
    const latestDiagnostic = completedDiagnosticSessions
      .filter((session) => session.status === 'completed' && session.summary != null)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0]

    await ctx.db.insert('learnerProfileSnapshots', {
      studentId: args.studentId,
      updatedAt: now,
      strongestSubjectIds,
      weakestSubjectIds,
      weakestSubtopicIds,
      diagnosticBaseline: latestDiagnostic?.summary,
      overallSummary: {
        correctCount: overallSummary.correctCount,
        answeredCount: overallSummary.attemptCount,
        questionCount: overallSummary.attemptCount,
        accuracy: overallSummary.accuracy,
        durationMs: Math.round(overallSummary.avgResponseTimeMs * overallSummary.attemptCount),
      },
    })
  },
})

export const getStudentProgress = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const snapshot = await ctx.db
      .query('learnerProfileSnapshots')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .unique()
    const subjectAggregates = await ctx.db
      .query('learnerSubjectAggregates')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    const subtopicAggregates = await ctx.db
      .query('learnerSubtopicAggregates')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    const nivelacionSessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId_kind', (q) =>
        q.eq('studentId', args.studentId).eq('kind', 'nivelacion'),
      )
      .collect()
    const student = await ctx.db.get('students', args.studentId)

    const subjectLevels = buildSubjectLevels(
      subjectAggregates,
      nivelacionSessions,
      snapshot,
      student,
    )

    return {
      snapshot,
      subjectAggregates: subjectAggregates.sort((a, b) => a.subjectId.localeCompare(b.subjectId)),
      subjectLevels,
      globalScore: buildGlobalScore(subjectLevels, student),
      weakestSubtopics: [...subtopicAggregates]
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .slice(0, 8),
      /**
       * Every practiced subtopic's level (see `mastery.ts`); a subtopic not
       * listed is `sin_empezar`. Points and % via `summarizeMastery` on the web.
       */
      subtopicMastery: subtopicAggregates
        .filter((aggregate) => aggregate.subtopicId != null)
        .map((aggregate) => ({
          subtopicId: aggregate.subtopicId!,
          subjectId: aggregate.subjectId,
          masteryLevel: masteryLevelOf(aggregate),
          masteryUpdatedAt: aggregate.masteryUpdatedAt ?? null,
        })),
      /** Whether a reto can be assembled: three practiced subtopics (`orderRetoCandidates`). */
      retoReady: orderRetoCandidates(subtopicAggregates).length >= RETO_SUBTOPIC_COUNT,
    }
  },
})

/**
 * The 0-500 global score — the number students, families and universities
 * actually speak in.
 *
 * Reported with its uncertainty band and with the areas still missing, because
 * a global score is only defined over all five. `estimateGlobalScore` returns
 * null until every area has evidence, and this keeps that honest by naming the
 * gaps instead of quietly substituting zeros.
 */
function buildGlobalScore(
  subjectLevels: ReturnType<typeof buildSubjectLevels>,
  student: Doc<'students'> | null,
) {
  const scored = subjectLevels.filter(
    (level) => level.currentScore != null && level.hasEnoughEvidence,
  )
  const missingSubjectIds = subjectLevels
    .filter((level) => level.currentScore == null || !level.hasEnoughEvidence)
    .map((level) => level.subjectId)

  const estimate = estimateGlobalScore(
    scored.map((level) => ({
      subjectId: level.subjectId,
      score: level.currentScore!,
      attemptCount: level.attemptCount,
    })),
  )

  const target = student?.targetGlobalScore ?? null

  return {
    estimate,
    missingSubjectIds,
    target,
    pointsToTarget: estimate == null || target == null ? null : Math.max(0, target - estimate.score),
    // Where the next point of effort buys the most global score. Available even
    // before every area is measured, since it only needs the areas we do have.
    leverage: highestLeverageSubject(
      scored.map((level) => ({
        subjectId: level.subjectId,
        score: level.currentScore!,
        attemptCount: level.attemptCount,
      })),
    ),
  }
}

/**
 * The area score (0-100) to report, preferring calibrated evidence.
 *
 * Raw accuracy answers "what share did you get right", which depends as much on
 * which questions you happened to see as on you. Once Elo has enough attempts to
 * place the student, `expectedScore(ability, DEFAULT_RATING)` answers the
 * comparable question — "what share would you get right against an average
 * question" — and that is what an area score is supposed to mean.
 *
 * Falls back to raw accuracy while evidence is thin, so a new student still sees
 * a number instead of a blank.
 *
 * Every surface that shows an area level (Progreso, Hoy, Ruta) goes through
 * this, so the same area never lands in two different bands.
 */
export function areaScore(
  subjectId: string,
  accuracy: number,
  student: Pick<Doc<'students'>, 'abilityBySubject' | 'abilityAttemptsBySubject'> | null,
): { score: number; isCalibrated: boolean } {
  const abilityRating = student?.abilityBySubject?.[subjectId]
  if (
    abilityRating != null
    && (student?.abilityAttemptsBySubject?.[subjectId] ?? 0) >= MIN_ATTEMPTS_FOR_LEVEL
  ) {
    return {
      score: Math.round(expectedScore(abilityRating, DEFAULT_RATING) * 100),
      isCalibrated: true,
    }
  }
  return { score: estimatedScoreFromAccuracy(accuracy), isCalibrated: false }
}

/**
 * ICFES performance level per area, derived — no new table.
 *
 * "Now" comes from the subject aggregate's accuracy; "at placement" comes from
 * the most recent completed `nivelacion` for that area (a single-subject
 * session, so its overall accuracy *is* the area score), falling back to the
 * legacy diagnostic baseline on the profile snapshot for students placed before
 * per-area levelling existed.
 *
 * A level is only claimed once there is enough evidence — below that the student
 * is shown "sin nivel aún" rather than a number invented from three questions.
 */
function buildSubjectLevels(
  subjectAggregates: Doc<'learnerSubjectAggregates'>[],
  nivelacionSessions: Doc<'sessions'>[],
  snapshot: Doc<'learnerProfileSnapshots'> | null,
  student: Doc<'students'> | null,
) {
  const placementBySubjectId = new Map<string, number>()
  const latestPlacementAt = new Map<string, number>()
  for (const session of nivelacionSessions) {
    if (session.status !== 'completed' || session.subjectId == null) continue
    if (session.summary == null) continue
    const completedAt = session.completedAt ?? session.startedAt
    const existing = latestPlacementAt.get(session.subjectId)
    if (existing != null && existing >= completedAt) continue
    latestPlacementAt.set(session.subjectId, completedAt)
    placementBySubjectId.set(
      session.subjectId,
      estimatedScoreFromAccuracy(session.summary.accuracy),
    )
  }

  const diagnosticBySubjectId = new Map<string, number>()
  for (const subjectScore of snapshot?.diagnosticBaseline?.subjectScores ?? []) {
    // `subjectScores[].score` is already on the 0-100 scale (see the summary
    // built in `completeSession`). It used to be multiplied by 100 again here,
    // which pushed every legacy-diagnostic baseline past the clamp and reported
    // it as the top band for everyone.
    diagnosticBySubjectId.set(subjectScore.subjectId, Math.round(subjectScore.score))
  }

  return LEVELLED_SUBJECT_IDS.map((subjectId) => {
    const aggregate = subjectAggregates.find((item) => item.subjectId === subjectId) ?? null
    const attemptCount = aggregate?.attemptCount ?? 0
    const hasEnoughEvidence = attemptCount >= MIN_ATTEMPTS_FOR_LEVEL

    const scored = aggregate == null ? null : areaScore(subjectId, aggregate.accuracy, student)
    const currentScore = scored?.score ?? null
    const baselineScore =
      placementBySubjectId.get(subjectId) ?? diagnosticBySubjectId.get(subjectId) ?? null

    // Withheld until there is evidence; the UI shows "sin nivel aún".
    const current =
      hasEnoughEvidence && currentScore != null
        ? getLevelForScore(subjectId, currentScore)
        : null

    return {
      subjectId,
      attemptCount,
      hasEnoughEvidence,
      isPlaced: placementBySubjectId.has(subjectId),
      currentScore,
      isCalibrated: scored?.isCalibrated ?? false,
      baselineScore,
      current,
      baseline: baselineScore == null ? null : getLevelForScore(subjectId, baselineScore),
      national: current == null ? null : buildNationalComparison(subjectId, current.band.id),
    }
  })
}

/**
 * Where this level sits nationally — a public ICFES fact, not a leaderboard
 * among our own users.
 *
 * Both halves are null when the contract does not record them (see
 * `docs/national-results.v1.json`, which is deliberately incomplete). Callers
 * render nothing rather than an approximation.
 */
function buildNationalComparison(subjectId: string, bandId: string) {
  const orderedBandIds = getSubjectLevels(subjectId)?.bands.map((band) => band.id) ?? []
  const share = getNationalShare(subjectId, bandId)
  const percentileAtOrBelow = getNationalPercentileAtOrBelow({
    subjectId,
    bandId,
    orderedBandIds,
  })

  if (share == null && percentileAtOrBelow == null) return null
  return {
    shareAtThisLevel: share?.percent ?? null,
    percentileAtOrBelow,
    year: share?.year ?? null,
  }
}

/**
 * The improvement story over time, derived from raw attempts (no stored state):
 * a weekly accuracy series for the trend chart plus lifetime activity totals.
 * Kept separate from `getStudentProgress` (which reads only aggregates and is
 * also used by the "Hoy" page) so that page doesn't pay for this attempts scan.
 */
export const getProgressTrends = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const attempts = await ctx.db
      .query('questionAttempts')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()

    return summarizeTrends(attempts, sessions)
  },
})

/**
 * Every answer counts as activity; only answers of finished sittings feed the
 * accuracy trend, the correct count and the confidence breakdown. An open
 * simulacro grades each answer as it is saved, so any of those built from it
 * would leak the key one changed answer at a time (see `settledAttempts`).
 */
export function summarizeTrends(
  attempts: {
    sessionId: string
    answeredAt?: number
    isCorrect?: boolean
    confidence?: ConfidenceLevel
  }[],
  sessions: { _id: string; status: string }[],
) {
  const settled = settledAttempts(attempts, sessions)
  const weekBuckets = new Map<number, { attempts: number; correct: number }>()
  const activeDays = new Set<number>()
  let totalAttempts = 0
  let totalCorrect = 0
  let firstActivityAt: number | null = null

  for (const attempt of attempts) {
    if (attempt.answeredAt == null || attempt.isCorrect == null) continue
    totalAttempts += 1
    activeDays.add(colombiaDayNumber(attempt.answeredAt))
    if (firstActivityAt == null || attempt.answeredAt < firstActivityAt) {
      firstActivityAt = attempt.answeredAt
    }
  }

  for (const attempt of settled) {
    if (attempt.answeredAt == null || attempt.isCorrect == null) continue
    if (attempt.isCorrect) totalCorrect += 1

    const weekIndex = colombiaWeekIndex(attempt.answeredAt)
    const bucket = weekBuckets.get(weekIndex) ?? { attempts: 0, correct: 0 }
    bucket.attempts += 1
    if (attempt.isCorrect) bucket.correct += 1
    weekBuckets.set(weekIndex, bucket)
  }

  const weekly = [...weekBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekIndex, bucket]) => ({
      weekStartMs: colombiaWeekStartMs(weekIndex),
      attempts: bucket.attempts,
      accuracy: bucket.attempts === 0 ? 0 : bucket.correct / bucket.attempts,
    }))

  return {
    weekly,
    totalAttempts,
    totalCorrect,
    activeDays: activeDays.size,
    firstActivityAt,
    confidence: summarizeConfidence(settled),
  }
}
