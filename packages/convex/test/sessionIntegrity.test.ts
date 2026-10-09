import { describe, expect, test } from 'bun:test'
import {
  ANSWER_GRACE_MS,
  COMPLETION_GRACE_MS,
  canRevealAnswers,
  canCheckAnswers,
  canRevealQuestion,
  canRevealSessionQuestion,
  canSettleSession,
  isOutsideLiveExam,
  isPastDeadline,
  sealAttempt,
  sealQuestion,
  sealsItsQuestions,
  settledAttempts,
} from '../src/sessionIntegrity'

const question = {
  _id: 'q1',
  bodyMarkdown: '¿Cuál es el valor de x?',
  options: [
    { label: 'A', bodyMarkdown: '1' },
    { label: 'B', bodyMarkdown: '2' },
    { label: 'C', bodyMarkdown: '3' },
    { label: 'D', bodyMarkdown: '4' },
  ],
  subjectId: 'matematicas',
  groupId: 'g1',
  groupPosition: 0,
  answerCorrectOption: 'C',
  answerSolutionMarkdown: 'Despejando, x = 3.',
  // One rationale per WRONG option: the missing label is the key.
  answerDistractorRationales: [
    { label: 'A', rationaleMarkdown: 'Olvida sumar.' },
    { label: 'B', rationaleMarkdown: 'Confunde el signo.' },
    { label: 'D', rationaleMarkdown: 'Multiplica de más.' },
  ],
  answerErrorMessage: 'Respuesta del modelo: {"correctOption":"C"}',
  difficultyRating: 1340,
  difficultyAttemptCount: 12,
  difficultyUpdatedAt: 1_700_000_000_000,
}

const attempt = {
  _id: 'a1',
  selectedOption: 'B',
  confidence: 'sure',
  isCorrect: false,
  answeredAt: 1_700_000_000_000,
}

describe('canRevealAnswers', () => {
  test('only a completed session discloses answers', () => {
    expect(canRevealAnswers({ status: 'completed' })).toBe(true)
  })

  test('an open or abandoned session stays sealed', () => {
    for (const status of ['created', 'in_progress', 'abandoned']) {
      expect(canRevealAnswers({ status })).toBe(false)
    }
  })
})

describe('sealQuestion', () => {
  test('drops the key and every field the key can be inferred from', () => {
    const sealed = sealQuestion(question)
    expect(sealed.answerCorrectOption).toBeUndefined()
    expect(sealed.answerSolutionMarkdown).toBeUndefined()
    expect(sealed.answerDistractorRationales).toBeUndefined()
    expect(sealed.answerErrorMessage).toBeUndefined()
    expect(sealed.difficultyRating).toBeUndefined()
    expect(sealed.difficultyAttemptCount).toBeUndefined()
    expect(sealed.difficultyUpdatedAt).toBeUndefined()
  })

  test('nothing in the serialized question names the key', () => {
    const wire = JSON.parse(JSON.stringify(sealQuestion(question)))
    expect(Object.keys(wire).sort()).toEqual(
      ['_id', 'bodyMarkdown', 'groupId', 'groupPosition', 'options', 'subjectId'],
    )
  })

  test('keeps what the solve screen renders', () => {
    const sealed = sealQuestion(question)
    expect(sealed.bodyMarkdown).toBe(question.bodyMarkdown)
    expect(sealed.options).toEqual(question.options)
    expect(sealed.subjectId).toBe('matematicas')
    expect(sealed.groupId).toBe('g1')
  })

  test('does not mutate the stored document', () => {
    sealQuestion(question)
    expect(question.answerCorrectOption).toBe('C')
    expect(question.answerDistractorRationales).toHaveLength(3)
  })
})

describe('sealAttempt', () => {
  test('hides whether the answer was right, keeps what the student chose', () => {
    const sealed = sealAttempt(attempt)
    expect(sealed.isCorrect).toBeUndefined()
    expect(sealed.selectedOption).toBe('B')
    expect(sealed.confidence).toBe('sure')
    expect(attempt.isCorrect).toBe(false)
  })
})

describe('isPastDeadline', () => {
  const expiresAt = 1_700_000_000_000

  test('an untimed session never expires', () => {
    expect(isPastDeadline({}, Number.MAX_SAFE_INTEGER)).toBe(false)
  })

  test('the grace minute absorbs latency and small clock skew', () => {
    expect(ANSWER_GRACE_MS).toBe(60_000)
    expect(isPastDeadline({ expiresAt }, expiresAt)).toBe(false)
    expect(isPastDeadline({ expiresAt }, expiresAt + ANSWER_GRACE_MS)).toBe(false)
  })

  test('past the grace minute the sitting is over', () => {
    expect(isPastDeadline({ expiresAt }, expiresAt + ANSWER_GRACE_MS + 1)).toBe(true)
    expect(isPastDeadline({ expiresAt }, expiresAt + 24 * 60 * 60_000)).toBe(true)
  })
})

describe('isPastDeadline for completion', () => {
  const expiresAt = 1_700_000_000_000

  test('a time-out queued by a phone that reconnects minutes later is still scored', () => {
    expect(COMPLETION_GRACE_MS).toBeGreaterThan(ANSWER_GRACE_MS)
    expect(isPastDeadline({ expiresAt }, expiresAt + 2 * 60_000, COMPLETION_GRACE_MS)).toBe(false)
    expect(isPastDeadline({ expiresAt }, expiresAt + COMPLETION_GRACE_MS, COMPLETION_GRACE_MS)).toBe(false)
  })

  test('a completion hours after the clock ran out is a student who left', () => {
    expect(isPastDeadline({ expiresAt }, expiresAt + COMPLETION_GRACE_MS + 1, COMPLETION_GRACE_MS)).toBe(true)
    expect(isPastDeadline({ expiresAt }, expiresAt + 24 * 60 * 60_000, COMPLETION_GRACE_MS)).toBe(true)
  })

  test('an untimed session can always be completed', () => {
    expect(isPastDeadline({}, Number.MAX_SAFE_INTEGER, COMPLETION_GRACE_MS)).toBe(false)
  })
})

describe('settledAttempts', () => {
  const sessions = [
    { _id: 's-completed', status: 'completed' },
    { _id: 's-open', status: 'in_progress' },
    { _id: 's-created', status: 'created' },
    { _id: 's-abandoned', status: 'abandoned' },
  ]
  const attemptIn = (sessionId: string) => ({ _id: `a-${sessionId}`, sessionId, isCorrect: false })

  test('keeps the attempts of completed sessions', () => {
    const attempts = [attemptIn('s-completed'), attemptIn('s-completed')]
    expect(settledAttempts(attempts, sessions)).toEqual(attempts)
  })

  test('an open sitting counts nowhere: its grades are still sealed', () => {
    const attempts = [attemptIn('s-open'), attemptIn('s-created'), attemptIn('s-completed')]
    expect(settledAttempts(attempts, sessions).map((a) => a.sessionId)).toEqual(['s-completed'])
  })

  test('an abandoned session never finished, so its attempts are not evidence', () => {
    expect(settledAttempts([attemptIn('s-abandoned')], sessions)).toEqual([])
  })

  test('an attempt whose session is unknown is not counted', () => {
    expect(settledAttempts([attemptIn('s-missing')], sessions)).toEqual([])
  })
})

describe('canRevealQuestion', () => {
  const live = new Set(['q-live'])

  test('a completed session discloses a question no live exam is asking', () => {
    expect(canRevealQuestion({ status: 'completed' }, 'q-other', live)).toBe(true)
  })

  test('a question the student is answering in a live timed exam stays sealed everywhere', () => {
    // A practice completed mid-exam must not hand over the key of a shared item.
    expect(canRevealQuestion({ status: 'completed' }, 'q-live', live)).toBe(false)
  })

  test('an open session stays sealed whatever the live exam asks', () => {
    expect(canRevealQuestion({ status: 'in_progress' }, 'q-other', new Set())).toBe(false)
  })
})

describe('canCheckAnswers', () => {
  test('only practice kinds in immediate-feedback mode check answers one by one', () => {
    for (const kind of ['topic', 'recommended', 'repaso', 'personalizada'] as const) {
      expect(canCheckAnswers({ kind, feedbackMode: 'inmediata' })).toBe(true)
      expect(canCheckAnswers({ kind, feedbackMode: 'al_final' })).toBe(false)
      expect(canCheckAnswers({ kind })).toBe(false)
    }
  })

  test('exams and the mastery challenge never do, whatever the stored mode says', () => {
    for (const kind of ['diagnostic', 'nivelacion', 'simulacro', 'reto'] as const) {
      expect(canCheckAnswers({ kind, feedbackMode: 'inmediata' })).toBe(false)
    }
  })
})

describe('canRevealSessionQuestion', () => {
  const live = new Set(['q-live'])
  const practice = { status: 'in_progress', kind: 'topic', feedbackMode: 'inmediata' } as const
  const checked = { checkedAt: 1 }

  test('a completed session follows canRevealQuestion', () => {
    expect(canRevealSessionQuestion({ ...practice, status: 'completed' }, null, 'q-other', live)).toBe(true)
    expect(canRevealSessionQuestion({ ...practice, status: 'completed' }, null, 'q-live', live)).toBe(false)
  })

  test('an open immediate-feedback practice discloses the questions already checked', () => {
    expect(canRevealSessionQuestion(practice, checked, 'q-other', live)).toBe(true)
  })

  test('…and nothing else of that session', () => {
    expect(canRevealSessionQuestion(practice, null, 'q-other', live)).toBe(false)
    expect(canRevealSessionQuestion(practice, {}, 'q-other', live)).toBe(false)
  })

  test('a checked question a live exam is asking stays sealed', () => {
    expect(canRevealSessionQuestion(practice, checked, 'q-live', live)).toBe(false)
  })

  test('an open exam never discloses, even with a forged check', () => {
    const exam = { status: 'in_progress', kind: 'simulacro', feedbackMode: 'inmediata' } as const
    expect(canRevealSessionQuestion(exam, checked, 'q-other', new Set())).toBe(false)
  })

  test('an end-of-session practice stays sealed until completed', () => {
    expect(
      canRevealSessionQuestion({ ...practice, feedbackMode: 'al_final' }, checked, 'q-other', new Set()),
    ).toBe(false)
  })
})

describe('isOutsideLiveExam', () => {
  const live = { questionIds: new Set(['q-live']), groupIds: new Set(['g-live']) }

  test('another session may not take a question a live exam asks', () => {
    expect(isOutsideLiveExam({ _id: 'q-live' }, live)).toBe(false)
  })

  test('nor a sibling on its text: the group leaves whole', () => {
    expect(isOutsideLiveExam({ _id: 'q-sibling', groupId: 'g-live' }, live)).toBe(false)
  })

  test('every other question is free', () => {
    expect(isOutsideLiveExam({ _id: 'q-other' }, live)).toBe(true)
    expect(isOutsideLiveExam({ _id: 'q-other', groupId: 'g-other' }, live)).toBe(true)
  })
})

describe('canSettleSession', () => {
  test('a completed practice never settles a question another live exam asks', () => {
    expect(canSettleSession(['q1', 'q-live'], new Set(['q-live']))).toBe(false)
  })

  test('with no overlap it may be scored', () => {
    expect(canSettleSession(['q1', 'q2'], new Set(['q-live']))).toBe(true)
    expect(canSettleSession(['q1'], new Set())).toBe(true)
  })
})

describe('sealsItsQuestions', () => {
  const now = 1_000_000

  test('an open session that discloses nothing before the end seals its questions, timed or not', () => {
    for (const kind of ['diagnostic', 'nivelacion', 'simulacro', 'reto'] as const) {
      expect(sealsItsQuestions({ kind, status: 'in_progress' }, now)).toBe(true)
      expect(sealsItsQuestions({ kind, status: 'in_progress', expiresAt: now + 1 }, now)).toBe(true)
    }
  })

  test('a practice that may check answers one by one does not', () => {
    for (const kind of ['topic', 'recommended', 'repaso', 'personalizada'] as const) {
      expect(sealsItsQuestions({ kind, status: 'in_progress' }, now)).toBe(false)
    }
  })

  test('a finished session, or one past its deadline, no longer seals', () => {
    expect(sealsItsQuestions({ kind: 'reto', status: 'completed' }, now)).toBe(false)
    expect(sealsItsQuestions({ kind: 'reto', status: 'abandoned' }, now)).toBe(false)
    expect(sealsItsQuestions({ kind: 'simulacro', status: 'in_progress', expiresAt: now - ANSWER_GRACE_MS - 1 }, now))
      .toBe(false)
  })

  test("an open reto's question is not revealed in a completed practice", () => {
    const reto = { _id: 's-reto', kind: 'reto', status: 'in_progress', questionIds: ['q-reto'] } as const
    const sealed = new Set([reto].filter((session) => sealsItsQuestions(session, now)).flatMap((s) => s.questionIds))
    expect(canRevealQuestion({ status: 'completed' }, 'q-reto', sealed)).toBe(false)
    expect(canRevealSessionQuestion(
      { status: 'in_progress', kind: 'personalizada', feedbackMode: 'inmediata' },
      { checkedAt: 1 },
      'q-reto',
      sealed,
    )).toBe(false)
  })
})
