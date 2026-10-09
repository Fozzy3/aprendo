import { describe, expect, test } from 'bun:test'
import {
  LLM_DAILY_LIMITS,
  MAX_TUTOR_PROMPT_CHARS,
  canUseTutor,
  hasLlmBudget,
  isLiveTimedExam,
} from '../src/llmBudget'
import { ANSWER_GRACE_MS } from '../src/sessionIntegrity'
import { SESSION_KINDS, SESSION_KIND_CONFIG } from '../src/sessionKinds'

describe('hasLlmBudget', () => {
  test('the tutor gets 80 messages a day', () => {
    expect(LLM_DAILY_LIMITS.tutor).toBe(80)
  })

  test('allows while the student is under the daily limit', () => {
    expect(hasLlmBudget('tutor', 0)).toBe(true)
    expect(hasLlmBudget('tutor', LLM_DAILY_LIMITS.tutor - 1)).toBe(true)
  })

  test('denies once the daily limit is spent', () => {
    expect(hasLlmBudget('tutor', LLM_DAILY_LIMITS.tutor)).toBe(false)
    expect(hasLlmBudget('tutor', LLM_DAILY_LIMITS.tutor + 5)).toBe(false)
  })
})

describe('MAX_TUTOR_PROMPT_CHARS', () => {
  test('leaves room for a real question but not a pasted book', () => {
    expect(MAX_TUTOR_PROMPT_CHARS).toBeGreaterThanOrEqual(1000)
    expect(MAX_TUTOR_PROMPT_CHARS).toBeLessThanOrEqual(8000)
  })
})

describe('canUseTutor', () => {
  test('every kind gets the tutor once the session is completed', () => {
    for (const kind of SESSION_KINDS) {
      expect(canUseTutor(kind, 'completed')).toBe(true)
    }
  })

  test('exam kinds never get the tutor while being solved', () => {
    for (const kind of ['diagnostic', 'nivelacion', 'simulacro'] as const) {
      for (const status of ['created', 'in_progress', 'abandoned'] as const) {
        expect(canUseTutor(kind, status)).toBe(false)
      }
    }
  })

  test('exam kinds stay closed even if their config enables the tutor in solve', () => {
    const config = SESSION_KIND_CONFIG.simulacro
    const original = config.tutorInSolve
    config.tutorInSolve = true
    try {
      expect(canUseTutor('simulacro', 'in_progress')).toBe(false)
    } finally {
      config.tutorInSolve = original
    }
  })

  test('practice kinds follow their tutorInSolve flag while being solved', () => {
    const config = SESSION_KIND_CONFIG.topic
    const original = config.tutorInSolve
    try {
      config.tutorInSolve = false
      expect(canUseTutor('topic', 'in_progress')).toBe(false)
      config.tutorInSolve = true
      expect(canUseTutor('topic', 'in_progress')).toBe(true)
    } finally {
      config.tutorInSolve = original
    }
  })
})

describe('isLiveTimedExam', () => {
  const expiresAt = 1_000_000

  test('a timed exam still running shuts the tutor, grace window included', () => {
    for (const kind of ['nivelacion', 'simulacro'] as const) {
      expect(isLiveTimedExam({ kind, status: 'in_progress', expiresAt }, expiresAt - 1)).toBe(true)
      expect(isLiveTimedExam({ kind, status: 'in_progress', expiresAt }, expiresAt + ANSWER_GRACE_MS)).toBe(true)
    }
  })

  test('an exam whose clock ran out no longer counts, even if never closed', () => {
    expect(isLiveTimedExam({ kind: 'simulacro', status: 'in_progress', expiresAt }, expiresAt + ANSWER_GRACE_MS + 1)).toBe(false)
  })

  test('a finished or abandoned exam does not count', () => {
    for (const status of ['completed', 'abandoned'] as const) {
      expect(isLiveTimedExam({ kind: 'simulacro', status, expiresAt }, expiresAt - 1)).toBe(false)
    }
  })

  test('an untimed session never counts: it could stay open forever', () => {
    expect(isLiveTimedExam({ kind: 'diagnostic', status: 'in_progress', expiresAt: undefined }, expiresAt)).toBe(false)
  })

  test('practice kinds never count, even with a deadline', () => {
    for (const kind of ['recommended', 'topic', 'repaso'] as const) {
      expect(isLiveTimedExam({ kind, status: 'in_progress', expiresAt }, expiresAt - 1)).toBe(false)
    }
  })
})
