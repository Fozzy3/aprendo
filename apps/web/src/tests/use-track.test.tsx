// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  location: { pathname: '/today', searchStr: '' },
  track: vi.fn(),
}))

vi.mock('lucide-react', () =>
  new Proxy({}, { has: () => true, get: (_, name) => (name === 'then' ? undefined : () => null) }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useLocation: () => state.location,
}))
vi.mock('@convex-dev/react-query', () => ({ useConvexMutation: () => state.track }))
vi.mock('../components/RoleSwitcher.tsx', () => ({ RoleSwitcher: () => null }))
vi.mock('../components/SchoolLabel.tsx', () => ({ SchoolLabel: () => null }))
vi.mock('../components/ThemeToggle.tsx', () => ({ ThemeToggle: () => null }))
vi.mock('../lib/use-sign-out.ts', () => ({ useSignOut: () => ({ signOut: vi.fn(), isSigningOut: false }) }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const session = { studentId: 's1' as never, email: 'ana@x.co', name: 'Ana' }

let container: HTMLElement
let root: Root

beforeEach(() => {
  vi.resetModules()
  state.location = { pathname: '/today', searchStr: '' }
  state.track = vi.fn(async () => null)
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function renderShell() {
  const { StudentAppShell } = await import('../components/StudentAppShell.tsx')
  await act(async () => {
    root.render(<StudentAppShell session={session} activeSection="today"><p>hoy</p></StudentAppShell>)
  })
}

const calls = () => state.track.mock.calls.map(([args]) => args)

describe('screen views from the student shell', () => {
  it('records each screen once, however often it renders', async () => {
    await renderShell()
    await renderShell()
    state.location = { pathname: '/path', searchStr: '' }
    await renderShell()
    expect(calls()).toEqual([
      { studentId: 's1', name: 'screen_view', props: { path: '/today' } },
      { studentId: 's1', name: 'screen_view', props: { path: '/path' } },
    ])
  })

  it('a visit from a reminder email is also an email click, once', async () => {
    state.location = { pathname: '/today', searchStr: '?ref=recordatorio' }
    await renderShell()
    await renderShell()
    expect(calls()).toEqual([
      { studentId: 's1', name: 'screen_view', props: { path: '/today', ref: 'recordatorio' } },
      { studentId: 's1', name: 'email_click', props: { path: '/today' } },
    ])
  })

  it('a failed send never reaches the screen', async () => {
    state.track = vi.fn(() => Promise.reject(new Error('sin red')))
    await renderShell()
    expect(container.textContent).toContain('hoy')
  })
})

describe('useTrack', () => {
  it('does nothing without a student', async () => {
    const { useTrack } = await import('../lib/use-track.ts')
    function Probe() {
      useTrack(undefined)('screen_view', { path: '/x' })
      return null
    }
    await act(async () => {
      root.render(<Probe />)
    })
    expect(state.track).not.toHaveBeenCalled()
  })
})
