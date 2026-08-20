import { query } from './_generated/server'
import { v } from 'convex/values'
import taxonomyContract from '../../../docs/taxonomy.v1.json'
import { assertOwnsStudent } from './auth'
import { collectUsableQuestionsBySubject } from './questionPool'
import type { QuestionEligibilityPool } from './sessionKinds'

/**
 * The eligibility tiers the syllabus counts as launchable for study. Matches the
 * `topic`/`recommended` pools in `sessionKinds.ts`.
 */
const ELIGIBILITY_POOLS: QuestionEligibilityPool[] = ['diagnostic', 'practice_only']

/**
 * The navigable ICFES syllabus: the static taxonomy (subjects → categories →
 * subtopics) joined with (a) how many launchable questions exist per node and
 * (b) the student's mastery per subject/subtopic.
 *
 * Question counts are computed with one indexed scan per (subject, eligibility)
 * — 5 subjects × 2 pools = 10 scans — bucketed by subtopic in memory.
 *
 * V1 counting strategy (researched against the Convex docs): `.collect().length`
 * over `by_subjectId_eligibility` is acceptable while each subject stays well
 * under ~1000 eligible questions and total scans stay far below the per-query
 * limits (32k documents / 16 MiB). When a subject approaches that volume —or the
 * frequent question ingest starts thrashing this reactive query— migrate to
 * denormalized per-subtopic counts or the `@convex-dev/aggregate` component.
 */
export const getSyllabus = query({
  args: {
    studentId: v.id('students'),
  },
  handler: async (ctx, args) => {
    await assertOwnsStudent(ctx, args.studentId)

    const subjectQuestionCounts = new Map<string, number>()
    const subtopicQuestionCounts = new Map<string, number>()
    await Promise.all(
      taxonomyContract.subjects.map(async (subject) => {
        const usable = await collectUsableQuestionsBySubject(ctx, subject.id, ELIGIBILITY_POOLS)
        subjectQuestionCounts.set(subject.id, usable.length)
        for (const question of usable) {
          if (question.primarySubtopicId == null) continue
          subtopicQuestionCounts.set(
            question.primarySubtopicId,
            (subtopicQuestionCounts.get(question.primarySubtopicId) ?? 0) + 1,
          )
        }
      }),
    )

    // Subtopics that already have a ready concept lesson (small indexed scan).
    const readyLessons = await ctx.db
      .query('conceptLessons')
      .withIndex('by_status', (q) => q.eq('status', 'ready'))
      .collect()
    const subtopicsWithLesson = new Set(readyLessons.map((lesson) => lesson.subtopicId))

    const subjectAggregates = await ctx.db
      .query('learnerSubjectAggregates')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    const subtopicAggregates = await ctx.db
      .query('learnerSubtopicAggregates')
      .withIndex('by_studentId', (q) => q.eq('studentId', args.studentId))
      .collect()
    const subjectAggById = new Map(subjectAggregates.map((agg) => [agg.subjectId, agg]))
    const subtopicAggById = new Map(
      subtopicAggregates
        .filter((agg) => agg.subtopicId != null)
        .map((agg) => [agg.subtopicId as string, agg]),
    )

    const subjects = taxonomyContract.subjects.map((subject) => {
      const subjectAgg = subjectAggById.get(subject.id)
      const categories = subject.categories.map((category) => ({
        id: category.id,
        label: category.label_es,
        subtopics: category.subtopics.map((subtopic) => {
          const agg = subtopicAggById.get(subtopic.id)
          return {
            id: subtopic.id,
            label: subtopic.label_es,
            questionCount: subtopicQuestionCounts.get(subtopic.id) ?? 0,
            attemptCount: agg?.attemptCount ?? 0,
            mastery: agg?.masteryScore ?? null,
            accuracy: agg?.accuracy ?? null,
            evidenceLevel: agg?.evidenceLevel ?? null,
            hasLesson: subtopicsWithLesson.has(subtopic.id),
          }
        }),
      }))
      return {
        id: subject.id,
        label: subject.label_es,
        questionCount: subjectQuestionCounts.get(subject.id) ?? 0,
        attemptCount: subjectAgg?.attemptCount ?? 0,
        mastery: subjectAgg?.masteryScore ?? null,
        evidenceLevel: subjectAgg?.evidenceLevel ?? null,
        categories,
      }
    })

    // Overall mastery averages only the subjects that have evidence, matching
    // how the progress page reads readiness (an unstarted subject shouldn't drag
    // the headline number to zero).
    const evidencedSubjects = subjects.filter((subject) => subject.mastery != null)
    const overallMastery = evidencedSubjects.length > 0
      ? evidencedSubjects.reduce((sum, subject) => sum + (subject.mastery ?? 0), 0)
        / evidencedSubjects.length
      : null

    return { overallMastery, subjects }
  },
})
