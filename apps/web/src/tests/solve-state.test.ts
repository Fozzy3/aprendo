import { describe, expect, it } from 'vitest'
import { COMPLETION_GRACE_MS } from '@aprendo/convex/sessionIntegrity'
import {
  checkWorkSummary,
  firstUnansweredIndex,
  isClosedOnLoad,
  navigatorRuns,
  parseTextScale,
  stepTextScale,
  toggleLabel,
} from '../lib/solve-state'

describe('navigatorRuns', () => {
  it('keeps the questions of one shared text together', () => {
    expect(navigatorRuns([null, 'g1', 'g1', 'g1', null, null, 'g2', 'g2'])).toEqual([
      { groupId: null, indexes: [0] },
      { groupId: 'g1', indexes: [1, 2, 3] },
      { groupId: null, indexes: [4, 5] },
      { groupId: 'g2', indexes: [6, 7] },
    ])
  })

  it('splits two groups that touch', () => {
    expect(navigatorRuns(['g1', 'g2'])).toEqual([
      { groupId: 'g1', indexes: [0] },
      { groupId: 'g2', indexes: [1] },
    ])
    expect(navigatorRuns([])).toEqual([])
  })
})

describe('checkWorkSummary', () => {
  it('lists blank and flagged questions by index', () => {
    expect(
      checkWorkSummary([
        { answered: true, flagged: false },
        { answered: false, flagged: true },
        { answered: false, flagged: false },
        { answered: true, flagged: true },
      ]),
    ).toEqual({ answeredCount: 2, blank: [1, 2], flagged: [1, 3] })
  })
})

describe('firstUnansweredIndex', () => {
  it('resumes at the first question still blank', () => {
    expect(firstUnansweredIndex([true, true, false, false])).toBe(2)
  })

  it('starts at the top when nothing or everything is answered', () => {
    expect(firstUnansweredIndex([false, false])).toBe(0)
    expect(firstUnansweredIndex([true, true])).toBe(0)
    expect(firstUnansweredIndex([])).toBe(0)
  })
})

describe('isClosedOnLoad', () => {
  const expiresAt = 1_000_000

  it('is closed when the session was abandoned', () => {
    expect(isClosedOnLoad({ status: 'abandoned' }, 0)).toBe(true)
  })

  it('is closed when the page loaded past the deadline plus the completion grace', () => {
    const session = { status: 'in_progress', expiresAt }
    expect(isClosedOnLoad(session, expiresAt + COMPLETION_GRACE_MS + 1)).toBe(true)
  })

  it('still lets a time-out inside the grace be scored', () => {
    const session = { status: 'in_progress', expiresAt }
    expect(isClosedOnLoad(session, expiresAt + COMPLETION_GRACE_MS)).toBe(false)
    expect(isClosedOnLoad(session, expiresAt - 1)).toBe(false)
  })

  it('never closes untimed or completed sessions', () => {
    expect(isClosedOnLoad({ status: 'in_progress' }, Number.MAX_SAFE_INTEGER)).toBe(false)
    expect(isClosedOnLoad({ status: 'completed', expiresAt }, expiresAt * 2)).toBe(false)
  })
})

describe('text scale', () => {
  it('steps through the fixed sizes and stops at either end', () => {
    expect(stepTextScale(1, 1)).toBe(1.15)
    expect(stepTextScale(1, -1)).toBe(0.9)
    expect(stepTextScale(0.9, -1)).toBe(0.9)
    expect(stepTextScale(1.5, 1)).toBe(1.5)
  })

  it('reads a stored size back, falling back to normal', () => {
    expect(parseTextScale('1.3')).toBe(1.3)
    expect(parseTextScale('7')).toBe(1)
    expect(parseTextScale(null)).toBe(1)
    expect(parseTextScale('abc')).toBe(1)
  })
})

describe('toggleLabel', () => {
  it('adds or removes an option, keeping the others', () => {
    expect(toggleLabel(['A'], 'C')).toEqual(['A', 'C'])
    expect(toggleLabel(['A', 'C'], 'A')).toEqual(['C'])
  })
})
