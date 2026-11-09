// ponytail: /cuenta is shared by every role but students are nearly all its
// visitors, so it takes their look rather than asking who is signed in.
const STUDENT_PREFIXES = [
  '/today', '/path', '/syllabus', '/practice', '/lesson', '/progress',
  '/history', '/diagnostic', '/duelo', '/join', '/cuenta',
]

/** The `data-look` for a route; it lives on <html> so Radix portals inherit it. */
export function lookForPath(pathname: string): 'student' | undefined {
  const isStudent = STUDENT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  return isStudent ? 'student' : undefined
}
