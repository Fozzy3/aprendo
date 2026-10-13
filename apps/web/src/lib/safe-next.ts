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
