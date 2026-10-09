import { describe, expect, it } from 'vitest'
import { answerFeedback } from '../lib/answer-feedback'

const question = {
  options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
  answerCorrectOption: 'C',
  answerSolutionMarkdown: 'La C, porque…',
  answerDistractorRationales: [
    { label: 'D', rationaleMarkdown: 'D confunde…' },
    { label: 'A', rationaleMarkdown: 'A olvida…' },
    { label: 'B', rationaleMarkdown: 'B suma…' },
  ],
}

describe('answerFeedback', () => {
  it('stays silent while the key is sealed', () => {
    expect(answerFeedback({ ...question, answerCorrectOption: undefined }, 'B')).toBeNull()
  })

  it('leads a wrong answer with why the chosen option looked right', () => {
    const feedback = answerFeedback(question, 'B')
    expect(feedback?.isCorrect).toBe(false)
    expect(feedback?.correctOption).toBe('C')
    expect(feedback?.picked).toEqual({ label: 'B', rationaleMarkdown: 'B suma…' })
    expect(feedback?.solutionMarkdown).toBe('La C, porque…')
    // The rest, in the order the options are printed.
    expect(feedback?.others.map((item) => item.label)).toEqual(['A', 'D'])
  })

  it('has no picked rationale for a right answer and explains every wrong option', () => {
    const feedback = answerFeedback(question, 'C')
    expect(feedback?.isCorrect).toBe(true)
    expect(feedback?.picked).toBeNull()
    expect(feedback?.others.map((item) => item.label)).toEqual(['A', 'B', 'D'])
  })

  it('copes with a question that has no written explanation yet', () => {
    const feedback = answerFeedback(
      { ...question, answerSolutionMarkdown: undefined, answerDistractorRationales: undefined },
      'A',
    )
    expect(feedback).toEqual({
      isCorrect: false,
      correctOption: 'C',
      picked: null,
      solutionMarkdown: null,
      others: [],
    })
  })
})
