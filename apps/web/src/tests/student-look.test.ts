import { describe, expect, it } from 'vitest'
import { lookForPath } from '../lib/student-look'

describe('lookForPath', () => {
  it('gives every student screen the album look', () => {
    for (const path of ['/today', '/path', '/practice', '/practice/abc/review', '/lesson/x', '/progress', '/diagnostic', '/duelo/1', '/join', '/cuenta', '/encuesta']) {
      expect(lookForPath(path)).toBe('student')
    }
  })

  // The owner wanted sign-in and the teacher's panel in the same ink and red.
  it('gives sign-in and the teacher panel the same look', () => {
    for (const path of ['/login', '/reset-password', '/teacher', '/teacher/abc', '/teacher/student/abc']) {
      expect(lookForPath(path)).toBe('student')
    }
  })

  // A rector buys these screens, a printed guide stays on paper, and the
  // projector carries its own tokens.
  it('leaves school, staff, public pages, the printable guide and the projector alone', () => {
    for (const path of ['/', '/teacher/guia/x', '/teacher/duelo/1', '/school', '/admin', '/privacidad']) {
      expect(lookForPath(path)).toBeUndefined()
    }
  })

  it('does not match a route that only starts with the same letters', () => {
    expect(lookForPath('/pathological')).toBeUndefined()
    expect(lookForPath('/teachers')).toBeUndefined()
  })
})
