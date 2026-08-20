/**
 * Shared lifecycle policy for AI-generated, cached content (concept lessons,
 * weekly coach summaries, …).
 *
 * Each surface owns its own table, indexes and generation action — those need
 * the generated Convex types and can't be shared. What they *do* share, and what
 * is easy to get subtly wrong, is the policy of *when* a cached row should be
 * (re)generated. That policy lives here as a pure function so the rule is stated
 * once and is directly testable: the interface (`decideClaim`) is the test
 * surface, where the inline `isStale`/`isStuck`/`shouldRegenerate` booleans
 * scattered across each mutation never were.
 */

export type AiCacheStatus = 'generating' | 'ready' | 'failed'

/**
 * A row claims its generation by going `generating`; if the scheduled action
 * dies without finalizing (actions run at-most-once and aren't auto-retried),
 * the row would be stuck forever. After this long a `generating` row is treated
 * as abandoned and re-claimed.
 *
 * This MUST exceed Convex's hard action timeout (10 minutes). If it were
 * shorter, a slow-but-still-running generation (e.g. the two sequential LLM
 * calls behind a lesson) could be re-claimed while alive, scheduling a second
 * action and duplicating the work. At 10+ minutes a `generating` row is
 * guaranteed dead, so re-claiming is safe.
 */
export const AI_GENERATION_TIMEOUT_MS = 12 * 60 * 1000

/** The minimal shape `decideClaim` needs from an existing cached row. */
export interface ClaimableRow {
  status: AiCacheStatus
  promptVersion: string
  updatedAt: number
}

/**
 * - `create`  — no row yet: insert a `generating` row and schedule generation.
 * - `reclaim` — stale/failed/abandoned row: reset it to `generating` and reschedule.
 * - `skip`    — a current `generating`/`ready` row exists: nothing to do.
 */
export type ClaimDecision = 'create' | 'reclaim' | 'skip'

/**
 * Decide whether a cache row needs (re)generation. Regenerates when the row
 * `failed`, when a `ready` row was produced by an older prompt/model version
 * (`promptVersion` mismatch), or when a `generating` row's action appears to
 * have died (stuck past `timeoutMs`). Deterministic and side-effect free — the
 * caller performs the insert/patch + scheduling with its own typed table and
 * internal action.
 */
export function decideClaim(params: {
  existing: ClaimableRow | null
  promptVersion: string
  now: number
  timeoutMs?: number
}): ClaimDecision {
  const { existing, promptVersion, now, timeoutMs = AI_GENERATION_TIMEOUT_MS } = params
  if (existing == null) return 'create'

  const isStale = existing.promptVersion !== promptVersion
  const isStuck =
    existing.status === 'generating' && now - existing.updatedAt > timeoutMs

  if (existing.status === 'failed' || (existing.status === 'ready' && isStale) || isStuck) {
    return 'reclaim'
  }
  return 'skip'
}
