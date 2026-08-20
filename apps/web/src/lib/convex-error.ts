import { ConvexError } from 'convex/values'

/**
 * The message a student should actually see when a Convex call fails.
 *
 * Convex serialises a plain `Error` with everything attached — the request id,
 * the module, the file path and line number. Rendering `error.message` put this
 * in front of a 16-year-old on the placement screen:
 *
 *   [CONVEX M(sessions:createSession)] [Request ID: 1898771916fb40cc] Server
 *   Error Uncaught Error: No hay preguntas disponibles para esta práctica.
 *   at handler (../src/sessions.ts:543:16) Called by client
 *
 * A `ConvexError` carries its payload in `.data`, which crosses the wire clean,
 * so every throw a student can trigger uses that type and this reads it back.
 *
 * The fallback deliberately does NOT surface `error.message`: if something threw
 * that was never meant for a student, showing a caller-supplied sentence is
 * better than leaking a stack trace.
 */
export function readConvexError(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data = error.data as unknown
    if (typeof data === 'string' && data.trim().length > 0) return data
    if (data != null && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message
      if (typeof message === 'string' && message.trim().length > 0) return message
    }
  }
  return fallback
}
