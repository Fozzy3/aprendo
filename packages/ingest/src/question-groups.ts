import type { QuestionExtraction } from './question-schema'

/**
 * Turns the flat extraction output into groups.
 *
 * The model repeats the shared stimulus (and a `contextKey`) on every question
 * of a group; this collapses those repetitions into one group per key, so the
 * stimulus is stored once instead of duplicated on every row — and, crucially,
 * so the questions that share it stay linked.
 *
 * Pure and dependency-free on purpose: this is the part of the grouping fix that
 * can actually be tested without calling an LLM.
 */

export interface QuestionGroup {
  contextKey: string
  contextMarkdown: string
  contextImages: string[]
  firstNumber: number
  lastNumber: number
  /** Question numbers in this group, in document order. */
  memberNumbers: number[]
}

export interface GroupedExtraction {
  groups: QuestionGroup[]
  /** Group key per question, by index into the input array. */
  groupKeyByIndex: Array<string | null>
  /** 0-based position of the question within its group, by input index. */
  groupPositionByIndex: Array<number | null>
}

/**
 * A group needs a key AND a stimulus. A `contextKey` with no `context` anywhere
 * in the group is meaningless, and a lone question carrying a key is not a group
 * — in both cases we fall back to "no group", and the question keeps its own
 * context inline so nothing is lost.
 */
export function groupExtractedQuestions(
  questions: QuestionExtraction[],
): GroupedExtraction {
  const indexesByKey = new Map<string, number[]>()

  questions.forEach((question, index) => {
    const key = normalizeKey(question.contextKey)
    if (key == null) return
    const existing = indexesByKey.get(key)
    if (existing == null) indexesByKey.set(key, [index])
    else existing.push(index)
  })

  const groups: QuestionGroup[] = []
  const groupKeyByIndex: Array<string | null> = questions.map(() => null)
  const groupPositionByIndex: Array<number | null> = questions.map(() => null)

  for (const [key, indexes] of indexesByKey) {
    if (indexes.length < 2) continue

    const members = indexes.map((index) => questions[index]!)
    const contextMarkdown = members
      .map((member) => member.context?.trim() ?? '')
      .find((context) => context.length > 0)
    if (contextMarkdown == null) continue

    const numbers = members.map((member) => member.questionNumber)
    const stated = members.find((member) => member.contextRange != null)?.contextRange

    // Trust the stated range only when it actually covers the members we found;
    // a hallucinated "4 a 7" on a two-question group would otherwise be shown to
    // the student as "Pregunta 1 de 4".
    const derivedFirst = Math.min(...numbers)
    const derivedLast = Math.max(...numbers)
    const useStated =
      stated != null && stated.from <= derivedFirst && stated.to >= derivedLast

    groups.push({
      contextKey: key,
      contextMarkdown,
      contextImages: [...new Set(members.flatMap((member) => member.contextImages ?? []))],
      firstNumber: useStated ? stated.from : derivedFirst,
      lastNumber: useStated ? stated.to : derivedLast,
      memberNumbers: numbers,
    })

    indexes.forEach((questionIndex, position) => {
      groupKeyByIndex[questionIndex] = key
      groupPositionByIndex[questionIndex] = position
    })
  }

  return { groups, groupKeyByIndex, groupPositionByIndex }
}

function normalizeKey(contextKey: string | null | undefined): string | null {
  if (contextKey == null) return null
  const trimmed = contextKey.trim()
  return trimmed.length === 0 ? null : trimmed
}
