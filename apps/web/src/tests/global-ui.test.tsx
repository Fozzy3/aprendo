// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialogHost, confirmDialog } from '../components/ConfirmDialog.tsx'
import { Toaster, toast } from '../components/Toast.tsx'
import { NotFoundPage, RouteErrorPage } from '../components/RouteStates.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'

// Radix loaded outside Vite brings its own React (see staff-routes.test.tsx).
vi.mock('../components/ui/dialog.tsx', () => ({
  Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) =>
    open ? (
      <div role="dialog">
        <button type="button" data-testid="dismiss" onClick={() => onOpenChange(false)} />
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function button(name: string) {
  const found = [...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === name)
  if (found == null) throw new Error(`no button "${name}" in: ${container.textContent}`)
  return found
}

describe('confirmDialog', () => {
  const options = { title: '¿Borrar la conversación?', body: 'No se puede deshacer.', confirmLabel: 'Borrar' }

  async function open() {
    await act(async () => root.render(<ConfirmDialogHost />))
    let answer: Promise<boolean>
    await act(async () => {
      answer = confirmDialog(options)
    })
    return answer!
  }

  it('asks, and resolves true on the confirming button', async () => {
    const answer = open()
    await vi.waitFor(() => expect(container.textContent).toContain('¿Borrar la conversación?'))
    expect(container.textContent).toContain('No se puede deshacer.')
    act(() => button('Borrar').click())
    await expect(await answer).toBe(true)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('resolves false on Cancelar', async () => {
    const answer = open()
    await vi.waitFor(() => expect(container.textContent).toContain('Cancelar'))
    act(() => button('Cancelar').click())
    await expect(await answer).toBe(false)
  })

  it('resolves false when dismissed with Escape or the overlay', async () => {
    const answer = open()
    await vi.waitFor(() => expect(container.querySelector('[data-testid="dismiss"]')).not.toBeNull())
    act(() => (container.querySelector('[data-testid="dismiss"]') as HTMLButtonElement).click())
    await expect(await answer).toBe(false)
  })

  it('marks a destructive confirmation', async () => {
    await act(async () => root.render(<ConfirmDialogHost />))
    await act(async () => {
      void confirmDialog({ ...options, destructive: true })
    })
    expect(button('Borrar').classList.contains('btn-danger')).toBe(true)
    act(() => button('Cancelar').click())
  })
})

describe('toast', () => {
  it('shows one message at a time and clears itself', async () => {
    vi.useFakeTimers()
    await act(async () => root.render(<Toaster />))
    expect(container.querySelector('[role="status"]')).toBeNull()

    act(() => toast('Guardamos tu nombre.'))
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Guardamos tu nombre.')

    act(() => toast('Listo.'))
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Listo.')

    act(() => vi.advanceTimersByTime(5000))
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('does not let an earlier timer cut a later toast short', async () => {
    vi.useFakeTimers()
    await act(async () => root.render(<Toaster />))
    act(() => toast('Primero.'))
    act(() => vi.advanceTimersByTime(3000))
    act(() => toast('Segundo.'))
    act(() => vi.advanceTimersByTime(2000))
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Segundo.')
  })
})

describe('branded dead ends', () => {
  it('404 explains and offers a way back', async () => {
    await act(async () => root.render(<NotFoundPage />))
    expect(container.querySelector('h1')?.textContent).toBe('No encontramos esta página')
    expect(container.querySelector('a[href="/app"]')).not.toBeNull()
  })

  it('error page offers a retry and a way back', async () => {
    await act(async () => root.render(<RouteErrorPage />))
    expect(container.querySelector('h1')?.textContent).toBe('Algo se rompió de nuestro lado')
    expect(button('Reintentar')).toBeDefined()
    expect(container.querySelector('a[href="/app"]')).not.toBeNull()
  })
})

describe('ThemeToggle', () => {
  it('speaks Spanish', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }))
    window.localStorage.setItem('theme', 'dark')
    await act(async () => root.render(<ThemeToggle />))
    const label = container.querySelector('button')?.getAttribute('aria-label') ?? ''
    expect(label).toBe('Tema: oscuro. Toca para cambiar.')
    act(() => container.querySelector('button')!.click())
    expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Tema: automático. Toca para cambiar a claro.')
    window.localStorage.removeItem('theme')
    vi.unstubAllGlobals()
  })
})
