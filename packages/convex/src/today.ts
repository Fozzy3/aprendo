import { query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { assertIsStudent } from './auth'
import { colombiaDayNumber, colombiaDayStartMs, colombiaWeekIndex } from './colombiaTime'
import { buildExamPlan, observedSessionsPerWeek, targetPace } from './examPlan'
import { estimateGlobalScore, weeklyGlobalEstimates } from './globalScore'
import { LEVELLED_SUBJECT_IDS, MIN_ATTEMPTS_FOR_LEVEL, getLevelForScore } from './levels'
import { areaScore } from './progress'
import { collectUsableQuestionsBySubject, hasUsableMetadata, isInEligibilityPool } from './questionPool'
import { settledAttempts } from './sessionIntegrity'
import { SESSION_KIND_CONFIG } from './sessionKinds'
import { buildStudyPlan } from './studyPlan'
import { DEFAULT_WEEKLY_GOAL_MINUTES, weeklyStudyMinutes } from './studyTime'

/**
 * "Hoy" dashboard signals derived from raw attempts. The streak and weekly
 * activity are read-only derivations — no new stored state. Days are bucketed in
 * Colombia time (see `colombiaTime.ts`).
 *
 * Every count built from grades (study minutes, review queue, the weekly global
 * trend) reads `settledAttempts` only: an open simulacro must not leak its key.
 */
const WEEKLY_GOAL = 5

export const getTodayDashboard = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)

    const [student, attempts, sessions, subjectAggregates, subtopicAggregates] = await Promise.all([
      ctx.db.get('students', args.studentId),
      ctx.db
        .query('questionAttempts')
        .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
        .collect(),
      ctx.db
        .query('sessions')
        .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
        .collect(),
      ctx.db
        .query('learnerSubjectAggregates')
        .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
        .collect(),
      ctx.db
        .query('learnerSubtopicAggregates')
        .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
        .collect(),
    ])

    const activeDays = new Set<number>()
    let firstActivityAt: number | null = null
    for (const attempt of attempts) {
      if (attempt.answeredAt == null || attempt.isCorrect == null) continue
      activeDays.add(colombiaDayNumber(attempt.answeredAt))
      if (firstActivityAt == null || attempt.answeredAt < firstActivityAt) {
        firstActivityAt = attempt.answeredAt
      }
    }

    const now = Date.now()
    const today = colombiaDayNumber(now)

    // A streak is unbroken if today or yesterday has activity; count back from
    // whichever the most recent active anchor is.
    let streakDays = 0
    const anchor = activeDays.has(today)
      ? today
      : activeDays.has(today - 1)
        ? today - 1
        : null
    if (anchor != null) {
      let cursor = anchor
      while (activeDays.has(cursor)) {
        streakDays += 1
        cursor -= 1
      }
    }

    // The calendar week (Monday to Sunday), not the last seven days: it is the
    // week the coach summarizes, so "esta semana" means the same thing in both.
    const thisWeek = colombiaWeekIndex(now)
    const activeDaysThisWeek = [...activeDays].filter(
      (day) => colombiaWeekIndex(colombiaDayStartMs(day)) === thisWeek,
    ).length

    // Null until the student sets a date — the countdown is opt-in, and the
    // UI prompts for it rather than assuming one.
    const examPlan =
      student?.examDate == null
        ? null
        : buildExamPlan({
            examDateMs: student.examDate,
            nowMs: now,
            sessionsPerWeek: observedSessionsPerWeek({
              activeDayCount: activeDays.size,
              firstActivityMs: firstActivityAt,
              nowMs: now,
            }),
          })

    const settled = settledAttempts(attempts, sessions)
    const graded = settled.filter(
      (attempt): attempt is typeof attempt & { answeredAt: number; isCorrect: boolean } =>
        attempt.answeredAt != null && attempt.isCorrect != null,
    )
    const questionCache = new Map<Id<'questions'>, Promise<Doc<'questions'> | null>>()
    const getQuestion = (questionId: Id<'questions'>) => {
      let question = questionCache.get(questionId)
      if (question == null) {
        question = ctx.db.get('questions', questionId)
        questionCache.set(questionId, question)
      }
      return question
    }

    // Areas scored exactly as Progreso scores them (`areaScore`).
    const placedSubjectIds = new Set(
      sessions
        .filter((session) => session.kind === 'nivelacion' && session.status === 'completed')
        .map((session) => session.subjectId),
    )
    const areas = LEVELLED_SUBJECT_IDS.map((subjectId) => {
      const aggregate = subjectAggregates.find((item) => item.subjectId === subjectId)
      const attemptCount = aggregate?.attemptCount ?? 0
      return {
        subjectId,
        score: aggregate == null ? null : areaScore(subjectId, aggregate.accuracy, student).score,
        attemptCount,
        hasEnoughEvidence: attemptCount >= MIN_ATTEMPTS_FOR_LEVEL,
        isPlaced: placedSubjectIds.has(subjectId),
      }
    })
    const estimate = estimateGlobalScore(
      areas.flatMap((area) =>
        area.score == null || !area.hasEnoughEvidence
          ? []
          : [{ subjectId: area.subjectId, score: area.score, attemptCount: area.attemptCount }],
      ),
    )
    const target = student?.targetGlobalScore ?? null
    const weeksRemaining =
      examPlan == null || examPlan.daysRemaining < 0 ? null : examPlan.weeksRemaining

    // The weekly trend costs a read per answered question, so it is built only
    // when a verdict could come out of it.
    let weeklyEstimates: { weekIndex: number; score: number }[] = []
    if (estimate != null && target != null && weeksRemaining != null) {
      const questions = await Promise.all(graded.map((attempt) => getQuestion(attempt.questionId)))
      weeklyEstimates = weeklyGlobalEstimates(
        graded.flatMap((attempt, index) => {
          const subjectId = questions[index]?.subjectId
          return subjectId == null
            ? []
            : [{ subjectId, isCorrect: attempt.isCorrect, weekIndex: colombiaWeekIndex(attempt.answeredAt) }]
        }),
      )
    }
    const pace = targetPace({
      estimate: estimate?.score ?? null,
      target,
      weeksRemaining,
      weeklyEstimates,
    })

    // Questions whose latest settled answer was wrong and that a repaso can
    // still serve — the same rule `getReviewQueue` counts with.
    const latestByQuestion = new Map<Id<'questions'>, { answeredAt: number; isCorrect: boolean }>()
    for (const attempt of graded) {
      const previous = latestByQuestion.get(attempt.questionId)
      if (previous == null || attempt.answeredAt > previous.answeredAt) {
        latestByQuestion.set(attempt.questionId, attempt)
      }
    }
    const missed = await Promise.all(
      [...latestByQuestion.entries()]
        .filter(([, latest]) => !latest.isCorrect)
        .map(([questionId]) => getQuestion(questionId)),
    )
    const reviewDueCount = missed.filter(
      (question) =>
        question != null
        && hasUsableMetadata(question)
        && isInEligibilityPool(question, SESSION_KIND_CONFIG.repaso.eligibilityPools),
    ).length

    const weeklyGoalMinutes = student?.weeklyGoalMinutes ?? DEFAULT_WEEKLY_GOAL_MINUTES
    const studyWeeks = weeklyStudyMinutes(
      settled.map((attempt) => ({
        at: attempt.answeredAt ?? attempt._creationTime,
        timeSpentMs: attempt.timeSpentMs,
        responseTimeMs: attempt.responseTimeMs,
      })),
      now,
    )

    // Every subtopic a topic session can serve, asked or not (one indexed scan
    // per area and pool, as the Temario counts them).
    const launchableSubtopics = new Map<string, string>()
    await Promise.all(
      LEVELLED_SUBJECT_IDS.map(async (subjectId) => {
        const usable = await collectUsableQuestionsBySubject(ctx, subjectId, SESSION_KIND_CONFIG.topic.eligibilityPools)
        for (const question of usable) {
          if (question.primarySubtopicId != null) launchableSubtopics.set(question.primarySubtopicId, subjectId)
        }
      }),
    )

    const plan = buildStudyPlan({
      today,
      examDay: student?.examDate == null ? null : colombiaDayNumber(student.examDate),
      areas,
      subtopics: subtopicAggregates.flatMap((aggregate) =>
        aggregate.subtopicId == null
          ? []
          : [{
              subtopicId: aggregate.subtopicId,
              subjectId: aggregate.subjectId,
              masteryScore: aggregate.masteryScore,
              attemptCount: aggregate.attemptCount,
              correctCount: aggregate.correctCount,
              masteryLevel: aggregate.masteryLevel,
            }],
      ),
      launchableSubtopics: [...launchableSubtopics].map(([subtopicId, subjectId]) => ({ subtopicId, subjectId })),
      reviewDueCount,
      simulacroSittings: sessions.flatMap((session) =>
        session.kind === 'simulacro' && session.status === 'completed' && session.simulacroSessionNumber != null
          ? [{
              day: colombiaDayNumber(session.completedAt ?? session.startedAt),
              sessionNumber: session.simulacroSessionNumber,
            }]
          : [],
      ),
      weeklyGoalMinutes,
    })

    return {
      streakDays,
      practicedToday: activeDays.has(today),
      activeDaysThisWeek,
      weeklyGoal: WEEKLY_GOAL,
      examDate: student?.examDate ?? null,
      examPlan,
      globalScore: {
        estimate,
        target,
        gap: pace.gap,
        weeksRemaining,
        pointsPerWeek: pace.pointsPerWeek,
        // "Vas a tiempo" — null until three weekly estimates exist.
        onTrack: pace.onTrack,
        // Without a global estimate, the next ICFES level per area is the gap.
        areaGaps:
          estimate != null
            ? null
            : areas.map((area) => {
                const placement =
                  area.score == null || !area.hasEnoughEvidence
                    ? null
                    : getLevelForScore(area.subjectId, area.score)
                return {
                  subjectId: area.subjectId,
                  score: placement == null ? null : area.score,
                  levelLabel: placement?.band.labelEs ?? null,
                  nextLevelLabel: placement?.nextBand?.labelEs ?? null,
                  pointsToNextLevel: placement?.pointsToNextBand ?? null,
                }
              }),
      },
      studyTime: {
        minutesThisWeek: studyWeeks.at(-1)?.minutes ?? 0,
        goalMinutes: weeklyGoalMinutes,
        weeks: studyWeeks,
      },
      plan,
    }
  },
})
