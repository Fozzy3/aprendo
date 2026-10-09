/**
 * Where `?pregunta=N` lands in the review. N is the 1-based session position,
 * not an array index: a question deleted on reprocess drops out of the list,
 * so the two drift apart. A position that is not there opens the first one.
 */
export function indexOfPosition(
  questions: ReadonlyArray<{ position: number }>,
  position: number | undefined,
): number {
  return Math.max(0, questions.findIndex((question) => question.position === position))
}
