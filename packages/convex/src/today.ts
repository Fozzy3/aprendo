import { query } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { assertIsStudent } from './auth'
import { colombiaDayNumber, colombiaDayStartMs, colombiaWeekIndex } from './colombiaTime'
import { buildExamPlan, observedSessionsPerWeek, targetPace } from './examPlan'
import { estimateGlobalScore, weeklyGlobalEstimates } from './globalScore'
import { LEVELLED_SUBJECT_IDS, MIN_ATTEMPTS_FOR_LEVEL, getLevelForScore } from './levels'
import { careerWeights } from './careers'
import { isReviewDue } from './mastery'
import { areaScore, placedSubjectIds } from './progress'
import { bankTiersForStudent, collectUsableQuestionsBySubject } from './questionPool'
import { settledAttempts } from './sessionIntegrity'
import { loadLiveExamSeal } from './sessions'
import { SESSION_KIND_CONFIG } from './sessionKinds'
import { MEDAL_LABELS, type MedalId, buildStickerAlbum, earnedXp, firstWeekPath, streakFrom } from './rewards'
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

    // Shields replay deterministically; see `rewards.streakFrom`.
    const { streakDays, shields } = streakFrom(activeDays, today)

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
    const placed = placedSubjectIds(sessions)
    const areas = LEVELLED_SUBJECT_IDS.map((subjectId) => {
      const aggregate = subjectAggregates.find((item) => item.subjectId === subjectId)
      const attemptCount = aggregate?.attemptCount ?? 0
      return {
        subjectId,
        score: aggregate == null ? null : areaScore(subjectId, aggregate.accuracy, student).score,
        attemptCount,
        hasEnoughEvidence: attemptCount >= MIN_ATTEMPTS_FOR_LEVEL,
        isPlaced: placed.has(subjectId),
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

    // Subtopics due for spaced review: the same rule `getReviewQueue` counts with (F34).
    const reviewDueCount = subtopicAggregates.filter(
      (aggregate) => aggregate.subtopicId != null && isReviewDue(aggregate, now),
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
    const [tiers, isFree] = await Promise.all([bankTiersForStudent(ctx, args.studentId), loadLiveExamSeal(ctx, args.studentId)])
    await Promise.all(
      LEVELLED_SUBJECT_IDS.map(async (subjectId) => {
        const usable = await collectUsableQuestionsBySubject(ctx, subjectId, SESSION_KIND_CONFIG.topic.eligibilityPools, tiers)
        for (const question of usable.filter(isFree)) {
          if (question.primarySubtopicId != null) launchableSubtopics.set(question.primarySubtopicId, subjectId)
        }
      }),
    )

    const completedToday = sessions.filter((session) =>
      session.status === 'completed' && session.completedAt != null && colombiaDayNumber(session.completedAt) === today)

    const plan = buildStudyPlan({
      today,
      examDay: student?.examDate == null ? null : colombiaDayNumber(student.examDate),
      areas,
      // A topic the plan names has to launch: nothing it can no longer serve.
      subtopics: subtopicAggregates.flatMap((aggregate) =>
        aggregate.subtopicId == null || !launchableSubtopics.has(aggregate.subtopicId)
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
      answeredToday: completedToday.reduce((sum, session) => sum + (session.summary?.answeredCount ?? 0), 0),
      simulacroSittings: sessions.flatMap((session) =>
        session.kind === 'simulacro' && session.status === 'completed' && session.simulacroSessionNumber != null
          ? [{
              day: colombiaDayNumber(session.completedAt ?? session.startedAt),
              sessionNumber: session.simulacroSessionNumber,
            }]
          : [],
      ),
      weeklyGoalMinutes,
      subjectWeights: careerWeights(student?.careerFamily) ?? undefined,
    })

    return {
      streakDays,
      shields,
      xp: {
        today: earnedXp(sessions, (completedAt) => colombiaDayNumber(completedAt) === today),
        thisWeek: earnedXp(sessions, (completedAt) => colombiaWeekIndex(completedAt) === thisWeek),
      },
      firstWeek: firstWeekPath(
        sessions.flatMap((session) => (session.status === 'completed' && session.completedAt != null ? [colombiaDayNumber(session.completedAt)] : [])),
        today,
        student?.weeklyGoalMinutes != null,
      ),
      practicedToday: activeDays.has(today),
      activeDaysThisWeek,
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

/**
 * The sticker album of Yo: one sticker per subtopic, earned from the mastery
 * levels already on the aggregates, plus the special stickers (medals) kept in
 * `sessions.reward`. No new table (see `rewards.buildStickerAlbum`).
 */
export const getStickerAlbum = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertIsStudent(ctx, args.studentId)
    const [aggregates, sessions] = await Promise.all([
      ctx.db.query('learnerSubtopicAggregates').withIndex('by_studentId', (q) => q.eq('studentId', args.studentId)).collect(),
      ctx.db.query('sessions').withIndex('by_studentId', (q) => q.eq('studentId', args.studentId)).collect(),
    ])
    const medals = sessions
      .flatMap((session) => (session.reward?.medals ?? []).map((id) => ({
        id,
        label: MEDAL_LABELS[id as MedalId] ?? id,
        earnedAt: session.completedAt ?? session.startedAt,
      })))
      .sort((a, b) => a.earnedAt - b.earnedAt)
    return { ...buildStickerAlbum(aggregates), medals }
  },
})
