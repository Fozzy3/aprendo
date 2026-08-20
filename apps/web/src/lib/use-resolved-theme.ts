import { useEffect, useState } from 'react'

export type ResolvedTheme = 'light' | 'dark'

/**
 * The theme actually in effect right now. `ThemeToggle` resolves `auto`/light/dark
 * down to a `light`/`dark` class on `<html>`; we read that class so non-CSS
 * consumers (e.g. a sandboxed iframe that can't inherit the app's stylesheet)
 * can match the app's theme.
 */
function readResolvedTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(readResolvedTheme)

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setTheme(readResolvedTheme()))
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    setTheme(readResolvedTheme())
    return () => observer.disconnect()
  }, [])

  return theme
}
