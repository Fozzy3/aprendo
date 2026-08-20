import type { QueryCtx } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import type { QuestionEligibilityPool } from './sessionKinds'

/**
 * The launchable-question pool: the single definition of which questions a
 * student-facing flow may draw from, and how to fetch them by subject or
 * subtopic across eligibility tiers.
 *
 * Both session assembly (`sessions.ts`) and the syllabus counts (`syllabus.ts`)
 * depend on the *same* answer here — if the "usable + eligible" invariant lived
 * in two places it could drift, making the Temario advertise more (or fewer)
 * questions than a session can actually select.
 */

/** A question is usable only if it has a scored answer key and full taxonomy. */
export function hasUsableMetadata(question: Doc<'questions'>) {
  return (
    question.answerCorrectOption != null
    && question.subjectId != null
    && question.categoryId != null
    && question.primarySubtopicId != null
  )
}

/** Whether a question's eligibility tier is one the caller is drawing from. */
export function isInEligibilityPool(
  question: Doc<'questions'>,
  pools: QuestionEligibilityPool[],
) {
  return question.eligibility != null && (pools as string[]).includes(question.eligibility)
}

/** Every usable question for a subject across the given eligibility pools. */
export async function collectUsableQuestionsBySubject(
  ctx: QueryCtx,
  subjectId: string,
  pools: QuestionEligibilityPool[],
): Promise<Doc<'questions'>[]> {
  const pooled: Doc<'questions'>[] = []
  for (const pool of pools) {
    const rows = await ctx.db
      .query('questions')
      .withIndex('by_subjectId_eligibility', (q) =>
        q.eq('subjectId', subjectId).eq('eligibility', pool),
      )
      .collect()
    pooled.push(...rows)
  }
  return pooled.filter(hasUsableMetadata)
}

/**
 * Pull whole shared-stimulus groups instead of isolated members.
 *
 * A question that belongs to a group ("Responda las preguntas 4 a 7…") makes no
 * sense on its own, so selecting one selects all its launchable siblings. A
 * group that doesn't fit the remaining slots is dropped entirely rather than
 * split — showing 2 of 4 questions about a text is worse than showing none.
 *
 * `limit` is the number of QUESTIONS still wanted, not groups. Returns questions
 * with group members kept adjacent and in `groupPosition` order, ready to be
 * written to consecutive `sessionQuestions.position` slots.
 */
export async function expandToGroups(
  ctx: QueryCtx,
  selected: Doc<'questions'>[],
  candidatePool: Doc<'questions'>[],
  limit: number,
): Promise<Doc<'questions'>[]> {
  const byId = new Map(candidatePool.map((question) => [question._id, question]))
  const taken = new Set<string>()
  const result: Doc<'questions'>[] = []

  for (const question of selected) {
    if (result.length >= limit) break
    if (taken.has(question._id)) continue

    if (question.groupId == null) {
      taken.add(question._id)
      result.push(question)
      continue
    }

    const siblings = await ctx.db
      .query('questions')
      .withIndex('by_groupId', (q) => q.eq('groupId', question.groupId))
      .collect()

    // Only siblings that are themselves launchable for this caller; a member
    // excluded by enrichment can't be shown.
    const members = siblings
      .filter((sibling) => sibling._id === question._id || byId.has(sibling._id))
      .filter((sibling) => !taken.has(sibling._id))
      .sort((a, b) => (a.groupPosition ?? 0) - (b.groupPosition ?? 0))

    if (members.length === 0) continue
    if (result.length + members.length > limit) continue

    for (const member of members) {
      taken.add(member._id)
      result.push(member)
    }
  }

  return result
}

/** Every usable question for a subtopic across the given eligibility pools. */
export async function collectUsableQuestionsBySubtopic(
  ctx: QueryCtx,
  subtopicId: string,
  pools: QuestionEligibilityPool[],
): Promise<Doc<'questions'>[]> {
  const pooled: Doc<'questions'>[] = []
  for (const pool of pools) {
    const rows = await ctx.db
      .query('questions')
      .withIndex('by_primarySubtopicId_eligibility', (q) =>
        q.eq('primarySubtopicId', subtopicId).eq('eligibility', pool),
      )
      .collect()
    pooled.push(...rows)
  }
  return pooled.filter(hasUsableMetadata)
}
