// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  auth: { isPending: false, error: null as Error | null, data: null as object | null },
  student: { isPending: true, isError: false, data: undefined as object | undefined },
}))

vi.mock('@convex-dev/react-query', () => ({ convexQuery: () => ({}) }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state.student }))
vi.mock('../lib/auth-client.ts', () => ({ authClient: { useSession: () => state.auth } }))

const { useCurrentStudent } = await import('../lib/student-session.ts')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Not @testing-library's renderHook: it brings its own React, and the hook under
// test needs the same one (see staff-routes.test.tsx).
function renderHook<T>(hook: () => T) {
  const result = { current: undefined as T }
  const Probe = () => {
    result.current = hook()
    return null
  }
  const root = createRoot(document.createElement('div'))
  act(() => root.render(createElement(Probe)))
  return { result, rerender: () => act(() => root.render(createElement(Probe))) }
}

describe('useCurrentStudent', () => {
  beforeEach(() => {
    state.auth = { isPending: false, error: null, data: null }
    state.student = { isPending: true, isError: false, data: undefined }
  })

  it('settles as signed out while the paused Convex query never answers', () => {
    const { result } = renderHook(() => useCurrentStudent())
    expect(result.current).toMatchObject({ session: null, isReady: true, isLoading: false })
  })

  it('waits while the session is still being read', () => {
    state.auth = { isPending: true, error: null, data: null }
    expect(renderHook(() => useCurrentStudent()).result.current.isReady).toBe(false)
  })

  it('waits for the student once there is a session', () => {
    state.auth = { isPending: false, error: null, data: { user: {} } }
    expect(renderHook(() => useCurrentStudent()).result.current.isReady).toBe(false)
  })

  it('does not read a failed session check as signed out', () => {
    state.auth = { isPending: false, error: new Error('offline'), data: null }
    expect(renderHook(() => useCurrentStudent()).result.current.isReady).toBe(false)
  })

  it('never reports a stale student after signing out', () => {
    state.student = { isPending: false, isError: false, data: { _id: 'a', email: 'a@b.co' } }
    expect(renderHook(() => useCurrentStudent()).result.current.session).toBeNull()
  })

  // Effects list `session` as a dependency. A fresh object per render made the
  // student guard re-run `navigate` on every render, forever: a frozen tab.
  it('keeps the same session object between renders', () => {
    state.auth = { isPending: false, error: null, data: { user: {} } }
    state.student = { isPending: false, isError: false, data: { _id: 'a', email: 'a@b.co', name: null } }
    const { result, rerender } = renderHook(() => useCurrentStudent())
    const first = result.current.session
    rerender()
    expect(result.current.session).toBe(first)
  })

  it('returns the student when signed in', () => {
    state.auth = { isPending: false, error: null, data: { user: {} } }
    state.student = { isPending: false, isError: false, data: { _id: 'a', email: 'a@b.co', name: null } }
    expect(renderHook(() => useCurrentStudent()).result.current.session).toEqual({ studentId: 'a', email: 'a@b.co', name: null })
  })
})
