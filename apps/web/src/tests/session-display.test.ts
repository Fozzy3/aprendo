import { describe, expect, it } from 'vitest'
import { SESSION_KINDS } from '@aprendo/convex/sessionKinds'
import { formatTimeLimit, getKindIcon } from '../lib/session-display'

const MINUTE = 60_000

describe('formatTimeLimit', () => {
  it('keeps short limits in minutes', () => {
    expect(formatTimeLimit(30 * MINUTE)).toBe('30 min')
  })

  it('reads a simulacro sitting as hours and minutes, not "270 min"', () => {
    expect(formatTimeLimit(270 * MINUTE)).toBe('4 h 30 min')
  })

  it('drops the minutes on a whole hour', () => {
    expect(formatTimeLimit(120 * MINUTE)).toBe('2 h')
  })

  it('rounds to the nearest minute before splitting into hours', () => {
    // Inglés area simulacro: 55 questions at 135 s each = 123.75 min.
    expect(formatTimeLimit(55 * 135_000)).toBe('2 h 4 min')
    expect(formatTimeLimit(59.6 * MINUTE)).toBe('1 h')
  })

  it('says there is no limit when there is none', () => {
    expect(formatTimeLimit(null)).toBe('Sin límite')
    expect(formatTimeLimit(undefined)).toBe('Sin límite')
  })
})

describe('getKindIcon', () => {
  it('has an icon for every session kind, the builder and the reto included', () => {
    for (const kind of SESSION_KINDS) expect(getKindIcon(kind)).toBeDefined()
  })
})
