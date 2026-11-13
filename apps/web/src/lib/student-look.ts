// ponytail: /cuenta is shared by every role but students are nearly all its
// visitors, so it takes their look rather than asking who is signed in.
// Sign-in and the teacher's panel wear it too (2026-11-13): one ink and red.
const STUDENT_PREFIXES = [
  '/today', '/path', '/syllabus', '/practice', '/lesson', '/progress',
  '/history', '/diagnostic', '/duelo', '/join', '/cuenta', '/encuesta',
  '/login', '/reset-password', '/teacher',
]

/** The printable class guide stays on paper; the projector carries its own tokens. */
const NOTEBOOK_PREFIXES = ['/teacher/guia', '/teacher/duelo']

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

/** The `data-look` for a route; it lives on <html> so Radix portals inherit it. */
export function lookForPath(pathname: string): 'student' | undefined {
  if (NOTEBOOK_PREFIXES.some((prefix) => matches(pathname, prefix))) return undefined
  return STUDENT_PREFIXES.some((prefix) => matches(pathname, prefix)) ? 'student' : undefined
}
