/**
 * Every deploy renames the code-split files, and the old names stop existing.
 * A tab opened before a deploy then fails to load the next section, and the
 * click does nothing. Vite reports that as `vite:preloadError`; reloading once
 * picks up the new deploy. The guard keeps a file that is really missing from
 * reloading in a loop.
 */
const LAST_RELOAD_KEY = 'aprendo:reloaded-for-deploy-at'
const MIN_RELOAD_GAP_MS = 30_000

export function shouldReloadForNewDeploy(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt == null || now - lastReloadAt > MIN_RELOAD_GAP_MS
}

let isListening = false

export function reloadOnNewDeploy() {
  if (isListening) return
  isListening = true
  window.addEventListener('vite:preloadError', () => {
    let lastReloadAt: number | null = null
    try {
      const stored = Number(window.sessionStorage.getItem(LAST_RELOAD_KEY))
      lastReloadAt = stored > 0 ? stored : null
    } catch {
      // Storage blocked: still reload; the gap check is only a loop guard.
    }
    const now = Date.now()
    if (!shouldReloadForNewDeploy(lastReloadAt, now)) return
    try {
      window.sessionStorage.setItem(LAST_RELOAD_KEY, String(now))
    } catch {
      // Same as above.
    }
    window.location.reload()
  })
}
