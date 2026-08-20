import { v } from 'convex/values'
import taxonomyContract from '../../../docs/taxonomy.v1.json'
import { query } from './_generated/server'
import { assertOwnsStudent } from './auth'
import {
  LEVELLED_SUBJECT_IDS,
  MIN_ATTEMPTS_FOR_LEVEL,
  estimatedScoreFromAccuracy,
  getLevelForScore,
} from './levels'
import { collectUsableQuestionsBySubject } from './questionPool'
import type { QuestionEligibilityPool } from './sessionKinds'

/**
 * The learning path for one area: the subtopics of that subject in taxonomy
 * order, annotated with everything the path screen needs to show where the
 * student is and what comes next.
 *
 * This is a read model, not a new source of truth — the same aggregates the
 * Temario and Progreso read, ordered and framed as a route toward the next
 * ICFES level.
 *
 * Node *state* (locked / available / mastered) is deliberately NOT computed
 * here: the mastery bands live in `apps/web/src/lib/syllabus-status.ts` and are
 * shared with the Temario and Progreso, so the client derives state from the raw
 * mastery this returns. Duplicating the thresholds server-side is exactly how
 * the two surfaces would drift apart.
 */

/** Same tiers the Temario counts and `topic` practice draws from. */
const ELIGIBILITY_POOLS: QuestionEligibilityPool[] = ['diagnostic', 'practice_only']

export const getLearningPath = query({
  args: {
    studentId: v.id('students'),
    subjectId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const subject = taxonomyContract.subjects.find((item) => item.id === args.subjectId)
    if (subject == null) return null

    // One indexed scan per eligibility pool for this subject, bucketed by
    // subtopic in memory — the same shape `syllabus.ts` uses, rather than a
    // third scan pattern over the same table.
    const usable = await collectUsableQuestionsBySubject(ctx, subject.id, ELIGIBILITY_POOLS)
    const questionCountBySubtopic = new Map<string, number>()
    for (const question of usable) {
      if (question.primarySubtopicId == null) continue
      questionCountBySubtopic.set(
        question.primarySubtopicId,
        (questionCountBySubtopic.get(question.primarySubtopicId) ?? 0) + 1,
      )
    }

    const readyLessons = await ctx.db
      .query('conceptLessons')
      .withIndex('by_status', (q) => q.eq('status', 'ready'))
      .collect()
    const subtopicsWithLesson = new Set(readyLessons.map((lesson) => lesson.subtopicId))

    const [subjectAggregates, subtopicAggregates] = await Promise.all([
      ctx.db
        .query('learnerSubjectAggregates')
        .withIndex('by_studentId_subjectId', (q) =>
          q.eq('studentId', args.studentId).eq('subjectId', subject.id),
        )
        .collect(),
      ctx.db
        .query('learnerSubtopicAggregates')
        .withIndex('by_studentId_subjectId', (q) =>
          q.eq('studentId', args.studentId).eq('subjectId', subject.id),
        )
        .collect(),
    ])

    const subjectAggregate = subjectAggregates[0] ?? null
    const subtopicAggById = new Map(
      subtopicAggregates
        .filter((agg) => agg.subtopicId != null)
        .map((agg) => [agg.subtopicId as string, agg]),
    )

    const nodes = subject.categories.flatMap((category) =>
      category.subtopics.map((subtopic) => {
        const aggregate = subtopicAggById.get(subtopic.id)
        return {
          subtopicId: subtopic.id,
          label: subtopic.label_es,
          categoryId: category.id,
          categoryLabel: category.label_es,
          questionCount: questionCountBySubtopic.get(subtopic.id) ?? 0,
          attemptCount: aggregate?.attemptCount ?? 0,
          mastery: aggregate?.masteryScore ?? null,
          accuracy: aggregate?.accuracy ?? null,
          evidenceLevel: aggregate?.evidenceLevel ?? null,
          hasLesson: subtopicsWithLesson.has(subtopic.id),
        }
      }),
    )

    return {
      subjectId: subject.id,
      subjectLabel: subject.label_es,
      nodes,
      level: buildSubjectLevel(subject.id, subjectAggregate),
    }
  },
})

/** Areas that can host a path, for the subject picker. */
export const listPathSubjects = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const aggregates = await ctx.db
      .query('learnerSubjectAggregates')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    const aggregateBySubjectId = new Map(aggregates.map((agg) => [agg.subjectId, agg]))

    return LEVELLED_SUBJECT_IDS.map((subjectId) => {
      const subject = taxonomyContract.subjects.find((item) => item.id === subjectId)
      const aggregate = aggregateBySubjectId.get(subjectId) ?? null
      return {
        subjectId,
        label: subject?.label_es ?? subjectId,
        mastery: aggregate?.masteryScore ?? null,
        level: buildSubjectLevel(subjectId, aggregate),
      }
    })
  },
})

/**
 * Current ICFES level for an area, or null while there isn't enough evidence to
 * claim one. Mirrors the rule in `progress.buildSubjectLevels`.
 */
function buildSubjectLevel(
  subjectId: string,
  aggregate: { accuracy: number; attemptCount: number } | null,
) {
  if (aggregate == null || aggregate.attemptCount < MIN_ATTEMPTS_FOR_LEVEL) {
    return {
      hasEnoughEvidence: false,
      attemptCount: aggregate?.attemptCount ?? 0,
      attemptsNeeded: MIN_ATTEMPTS_FOR_LEVEL - (aggregate?.attemptCount ?? 0),
      score: null,
      placement: null,
    }
  }

  const score = estimatedScoreFromAccuracy(aggregate.accuracy)
  return {
    hasEnoughEvidence: true,
    attemptCount: aggregate.attemptCount,
    attemptsNeeded: 0,
    score,
    placement: getLevelForScore(subjectId, score),
  }
}
