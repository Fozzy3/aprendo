import { describe, expect, it } from 'vitest'
import { findResumableSession } from '../lib/resume-session'

const NOW = 1_000_000

const mathNivelacion = {
  _id: 'math',
  kind: 'nivelacion',
  status: 'in_progress',
  subjectId: 'matematicas',
  expiresAt: NOW + 4 * 60_000,
}

describe('findResumableSession', () => {
  it('finds the unfinished sitting createSession would hand back', () => {
    expect(
      findResumableSession([mathNivelacion], { kind: 'nivelacion', subjectId: 'matematicas' }, NOW),
    ).toBe(mathNivelacion)
  })

  it('does not resume another area of the same kind', () => {
    expect(
      findResumableSession([mathNivelacion], { kind: 'nivelacion', subjectId: 'lectura_critica' }, NOW),
    ).toBeNull()
  })

  it('ignores a session whose clock already ran out: createSession starts a fresh one', () => {
    const expired = { ...mathNivelacion, expiresAt: NOW - 1 }
    expect(
      findResumableSession([expired], { kind: 'nivelacion', subjectId: 'matematicas' }, NOW),
    ).toBeNull()
  })

  it('ignores completed and abandoned sessions', () => {
    const completed = { ...mathNivelacion, status: 'completed' }
    const abandoned = { ...mathNivelacion, status: 'abandoned' }
    expect(
      findResumableSession([completed, abandoned], { kind: 'nivelacion', subjectId: 'matematicas' }, NOW),
    ).toBeNull()
  })

  it('tells the simulacro sittings and the per-area simulacro apart', () => {
    const sittingOne = { _id: 's1', kind: 'simulacro', status: 'in_progress', simulacroSessionNumber: 1, expiresAt: NOW + 60_000 }
    const mathArea = { _id: 'area', kind: 'simulacro', status: 'in_progress', subjectId: 'matematicas', expiresAt: NOW + 60_000 }
    const sessions = [sittingOne, mathArea]

    expect(findResumableSession(sessions, { kind: 'simulacro', simulacroSessionNumber: 1 }, NOW)).toBe(sittingOne)
    expect(findResumableSession(sessions, { kind: 'simulacro', simulacroSessionNumber: 2 }, NOW)).toBeNull()
    expect(findResumableSession(sessions, { kind: 'simulacro', subjectId: 'matematicas' }, NOW)).toBe(mathArea)
  })
})
