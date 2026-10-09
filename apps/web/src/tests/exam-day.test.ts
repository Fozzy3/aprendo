import { describe, expect, it } from 'vitest'
import { findPendingSecondSitting, isFullSittingOne } from '../lib/exam-day'

const sittingOne = {
  _id: 's1',
  kind: 'simulacro',
  status: 'completed',
  simulacroSessionNumber: 1,
  startedAt: 100,
}

describe('isFullSittingOne', () => {
  it('is the full-exam Sesión 1, including one stored without a number', () => {
    expect(isFullSittingOne(sittingOne)).toBe(true)
    expect(isFullSittingOne({ kind: 'simulacro' })).toBe(true)
  })

  it('is not Sesión 2, a per-area simulacro or another kind', () => {
    expect(isFullSittingOne({ kind: 'simulacro', simulacroSessionNumber: 2 })).toBe(false)
    expect(isFullSittingOne({ kind: 'simulacro', subjectId: 'matematicas' })).toBe(false)
    expect(isFullSittingOne({ kind: 'nivelacion', subjectId: 'matematicas' })).toBe(false)
  })
})

describe('findPendingSecondSitting', () => {
  it('offers Sesión 2 after a completed Sesión 1 with nothing after it', () => {
    expect(findPendingSecondSitting([sittingOne])).toBe(sittingOne)
  })

  it('is satisfied once a Sesión 2 was started after it', () => {
    const second = { _id: 's2', kind: 'simulacro', status: 'in_progress', simulacroSessionNumber: 2, startedAt: 200 }
    expect(findPendingSecondSitting([second, sittingOne])).toBeNull()
  })

  it('ignores an abandoned Sesión 2 and one from an earlier exam', () => {
    const abandoned = { _id: 's2', kind: 'simulacro', status: 'abandoned', simulacroSessionNumber: 2, startedAt: 200 }
    const older = { _id: 's0', kind: 'simulacro', status: 'completed', simulacroSessionNumber: 2, startedAt: 50 }
    expect(findPendingSecondSitting([abandoned, sittingOne, older])).toBe(sittingOne)
  })

  it('only looks at the latest Sesión 1, and only once it is completed', () => {
    const newer = { ...sittingOne, _id: 's1b', status: 'in_progress', startedAt: 300 }
    expect(findPendingSecondSitting([sittingOne, newer])).toBeNull()
    expect(findPendingSecondSitting([])).toBeNull()
  })
})
