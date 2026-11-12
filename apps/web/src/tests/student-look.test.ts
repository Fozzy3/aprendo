import { describe, expect, it } from 'vitest'
import { lookForPath } from '../lib/student-look'

describe('lookForPath', () => {
  it('gives every student screen the album look', () => {
    for (const path of ['/today', '/path', '/practice', '/practice/abc/review', '/lesson/x', '/progress', '/diagnostic', '/duelo/1', '/join', '/cuenta', '/encuesta']) {
      expect(lookForPath(path)).toBe('student')
    }
  })

  // A rector buys these screens, and a printed report must stay sober.
  it('leaves teacher, school, staff and public pages alone', () => {
    for (const path of ['/', '/login', '/teacher', '/teacher/duelo/1', '/school', '/admin', '/privacidad']) {
      expect(lookForPath(path)).toBeUndefined()
    }
  })

  it('does not match a route that only starts with the same letters', () => {
    expect(lookForPath('/pathological')).toBeUndefined()
  })
})
