import { describe, expect, it } from 'vitest'
import {
  beadStates,
  canRevealNow,
  guideEyebrow,
  guideQueryArgs,
  optionMark,
  isSettled,
  reviewIsSealed,
  reviewShowsAnswer,
  solveMoment,
  type GuideView,
} from '../lib/solve-view.ts'

const step: GuideView = { phase: 'step', stepIndex: 0, stepCount: 2, prompt: '¿Qué hiciste?', choices: ['Sumé', 'Adiviné'], canReveal: false }
const secondStep: GuideView = { ...step, stepIndex: 1, canReveal: true }
const why: GuideView = { phase: 'why', prompt: '¿Por qué?', choices: ['Porque sí'] }
const retry: GuideView = { phase: 'retry', canReveal: true }
const ended: GuideView = {
  phase: 'ended',
  outcome: 'self_corrected',
  correctOption: 'B',
  solutionMarkdown: null,
  distractorRationales: [],
  explanationSource: null,
  reveal: 'Porque tres de cada cinco.',
}

describe('solveMoment', () => {
  it('stays on answering until the answer is checked', () => {
    expect(solveMoment({ immediate: true, isChecked: false, hasKey: false, guide: null })).toBe('answering')
  })

  // The seal on the client: exams and the reto can never leave "answering",
  // whatever a stale cache or a forged attempt says.
  it('never leaves answering in a sealed session', () => {
    for (const guide of [step, why, retry, ended, null]) {
      expect(solveMoment({ immediate: false, isChecked: true, hasKey: true, guide })).toBe('answering')
    }
  })

  it('waits for the guide query rather than showing a verdict that may change', () => {
    expect(solveMoment({ immediate: true, isChecked: true, hasKey: true, guide: undefined })).toBe('waiting')
    expect(solveMoment({ immediate: true, isChecked: true, hasKey: false, guide: undefined })).toBe('waiting')
  })

  it('walks a wrong answer through its path', () => {
    const at = (guide: GuideView) => solveMoment({ immediate: true, isChecked: true, hasKey: false, guide })
    expect(at(step)).toBe('guiding')
    expect(at(retry)).toBe('retry')
    expect(solveMoment({ immediate: true, isChecked: true, hasKey: true, guide: why })).toBe('why')
  })

  it('closes when the path has ended and the key has arrived', () => {
    expect(solveMoment({ immediate: true, isChecked: true, hasKey: true, guide: ended })).toBe('closed')
    // The reactive session can lag one tick behind the step.
    expect(solveMoment({ immediate: true, isChecked: true, hasKey: false, guide: ended })).toBe('waiting')
  })

  it('closes a right answer given with confidence, without friction', () => {
    expect(solveMoment({ immediate: true, isChecked: true, hasKey: true, guide: null })).toBe('closed')
  })

  it('never closes without a key', () => {
    expect(solveMoment({ immediate: true, isChecked: true, hasKey: false, guide: null })).toBe('waiting')
  })
})

describe('optionMark', () => {
  const base = { selectedOption: 'C', correctOption: null, isEliminated: false }

  it('marks only the selection while answering', () => {
    expect(optionMark({ ...base, moment: 'answering', label: 'C' })).toBe('selected')
    expect(optionMark({ ...base, moment: 'answering', label: 'A' })).toBe('none')
  })

  it('shows no correct option while the path is open', () => {
    for (const moment of ['guiding', 'retry', 'waiting'] as const) {
      expect(optionMark({ ...base, moment, label: 'C' })).toBe('wrong')
      expect(optionMark({ ...base, moment, label: 'B' })).toBe('none')
      // Even if a key slipped through, an open path does not paint it.
      expect(optionMark({ ...base, correctOption: 'B', moment, label: 'B' })).toBe('none')
    }
  })

  it('does not call a right answer wrong on the why question', () => {
    expect(optionMark({ ...base, selectedOption: 'B', correctOption: 'B', moment: 'why', label: 'B' })).toBe('correct')
  })

  it('shows the key once closed', () => {
    const closed = { ...base, correctOption: 'B', moment: 'closed' as const }
    expect(optionMark({ ...closed, label: 'B' })).toBe('correct')
    expect(optionMark({ ...closed, label: 'C' })).toBe('wrong')
    expect(optionMark({ ...closed, label: 'A' })).toBe('none')
  })

  it('keeps a struck-out option struck while answering', () => {
    expect(optionMark({ ...base, moment: 'answering', label: 'D', isEliminated: true })).toBe('eliminated')
  })
})

describe('guideQueryArgs', () => {
  const ids = { sessionId: 's', sessionQuestionId: 'q' }

  it('asks nothing for a sealed session, checked or not', () => {
    expect(guideQueryArgs({ immediate: false, isChecked: true, ...ids })).toBe('skip')
    expect(guideQueryArgs({ immediate: false, isChecked: false, ...ids })).toBe('skip')
  })

  it('asks nothing before the answer is checked', () => {
    expect(guideQueryArgs({ immediate: true, isChecked: false, ...ids })).toBe('skip')
  })

  it('asks for the step of a checked practice answer', () => {
    expect(guideQueryArgs({ immediate: true, isChecked: true, ...ids })).toEqual(ids)
  })
})

describe('canRevealNow', () => {
  it('offers "Muéstrame" only after the first step', () => {
    expect(canRevealNow(step)).toBe(false)
    expect(canRevealNow(secondStep)).toBe(true)
  })

  it('offers it at the retry only when there was a ladder to walk', () => {
    expect(canRevealNow(retry)).toBe(true)
    expect(canRevealNow({ phase: 'retry', canReveal: false })).toBe(false)
  })

  it('has nothing to reveal on a why question or a finished path', () => {
    expect(canRevealNow(why)).toBe(false)
    expect(canRevealNow(ended)).toBe(false)
    expect(canRevealNow(null)).toBe(false)
  })
})

describe('guideEyebrow', () => {
  it('opens the path with "Todavía no"', () => {
    expect(guideEyebrow(step, null)).toBe('Todavía no')
  })

  it('answers the last tap on later steps, never with a verdict of the student', () => {
    expect(guideEyebrow(secondStep, true)).toBe('Eso es')
    expect(guideEyebrow(secondStep, false)).toBe('Míralo otra vez')
    expect(guideEyebrow(secondStep, null)).toBe('Sigue pensando')
  })

  it('says what the retry and the why question are', () => {
    expect(guideEyebrow(retry, true)).toBe('Elige de nuevo')
    expect(guideEyebrow(why, null)).toBe('Correcta')
  })
})

describe('beadStates', () => {
  it('marks answered, current and pending beads', () => {
    expect(beadStates([true, true, false, false], 2)).toEqual(['done', 'done', 'current', 'todo'])
  })

  it('shows the current bead over an answered one', () => {
    expect(beadStates([true, false], 0)).toEqual(['current', 'todo'])
  })

  it('gives up on beads for a long exam', () => {
    expect(beadStates(Array.from({ length: 16 }, () => false), 0)).toBeNull()
  })
})

describe('reviewShowsAnswer', () => {
  it('shows a right answer at once', () => {
    expect(reviewShowsAnswer({ isWrong: false, guide: undefined, revealed: false })).toBe(true)
  })

  it('never flashes the key while the guide is loading', () => {
    expect(reviewShowsAnswer({ isWrong: true, guide: undefined, revealed: false })).toBe(false)
  })

  it('shows the key when there is nothing to discover', () => {
    expect(reviewShowsAnswer({ isWrong: true, guide: null, revealed: false })).toBe(true)
  })

  it('offers "Descúbrelo" first, with the answer one tap away', () => {
    expect(reviewShowsAnswer({ isWrong: true, guide: {}, revealed: false })).toBe(false)
    expect(reviewShowsAnswer({ isWrong: true, guide: {}, revealed: true })).toBe(true)
  })
})

describe('reviewIsSealed', () => {
  const sealed = { question: {} }
  const open = { question: { answerCorrectOption: 'A' } }

  it('holds a school test until its round closes and its keys arrive', () => {
    expect(reviewIsSealed('prueba', [sealed, sealed])).toBe(true)
  })

  it('opens the review once the keys are out', () => {
    expect(reviewIsSealed('prueba', [open, open])).toBe(false)
  })

  it('never seals another kind, whatever its items hold', () => {
    expect(reviewIsSealed('simulacro', [sealed])).toBe(false)
  })

  it('has nothing to seal in an empty session', () => {
    expect(reviewIsSealed('prueba', [])).toBe(false)
  })
})

describe('isSettled', () => {
  const answered = { immediate: true, isAnswered: true, isChecked: true, hasKey: true }

  it('is not settled while blank', () => {
    expect(isSettled({ ...answered, isAnswered: false })).toBe(false)
  })

  // A reload must land back on the open path, not on the next question.
  it('is not settled while the guided path is open', () => {
    expect(isSettled({ ...answered, hasKey: false })).toBe(false)
  })

  it('is not settled in practice until it is checked', () => {
    expect(isSettled({ ...answered, isChecked: false, hasKey: false })).toBe(false)
  })

  it('is settled once checked with its key out', () => {
    expect(isSettled(answered)).toBe(true)
  })

  it('needs only an answer in a sealed session, which never shows a key', () => {
    expect(isSettled({ immediate: false, isAnswered: true, isChecked: false, hasKey: false })).toBe(true)
  })
})
