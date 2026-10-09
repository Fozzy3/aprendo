type Rationale = { label: string; rationaleMarkdown: string }

/**
 * What "Comprobar" shows for one checked answer: the verdict, why the option the
 * student chose looked right (when it is wrong — that is the part that teaches),
 * the solution, then the other wrong options in printed order. Null while the
 * key is still sealed.
 */
export function answerFeedback(
  question: {
    options: { label: string }[]
    answerCorrectOption?: string
    answerSolutionMarkdown?: string
    answerDistractorRationales?: Rationale[]
  },
  selectedOption: string,
) {
  const correctOption = question.answerCorrectOption
  if (correctOption == null) return null
  const isCorrect = selectedOption === correctOption
  const rationales = question.answerDistractorRationales ?? []
  const byLabel = new Map(rationales.map((item) => [item.label, item]))
  return {
    isCorrect,
    correctOption,
    picked: isCorrect ? null : byLabel.get(selectedOption) ?? null,
    solutionMarkdown: question.answerSolutionMarkdown ?? null,
    others: question.options
      .filter((option) => option.label !== selectedOption && option.label !== correctOption)
      .map((option) => byLabel.get(option.label))
      .filter((item): item is Rationale => item != null),
  }
}
