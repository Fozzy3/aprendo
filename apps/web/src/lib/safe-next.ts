/**
 * Where to go after signing in. Only a path inside this site: `//host` and
 * `/\host` are other sites to a browser, so they fall back to `/app`.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/app'
  }
  return value
}

/**
 * Where a placed student goes after the short welcome: back where they were,
 * Hoy by default, and never the diagnostic they are already on (the guard can
 * record `/diagnostic` as the origin while the route is still changing).
 */
export function welcomeReturn(volver: unknown): string {
  if (typeof volver !== 'string' || volver.startsWith('/diagnostic')) return '/today'
  return safeNext(volver)
}
