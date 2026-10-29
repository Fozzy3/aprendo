// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Welcome } from '../components/Welcome'

// See timed-session-intro.test.tsx: icons are stubbed so a single React runs.
vi.mock('lucide-react', () => {
  const Icon = () => null
  return Object.fromEntries(
    ['ArrowRight', 'Gauge', 'MessageCircleQuestion', 'Sun', 'Target', 'Timer', 'TrendingUp']
      .map((name) => [name, Icon]),
  )
})
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root
let onDone: ReturnType<typeof vi.fn>

beforeEach(() => {
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
  onDone = vi.fn()
  act(() => root.render(<Welcome onDone={onDone} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const heading = () => container.querySelector('h1')?.textContent
const click = (name: string) => {
  const target = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(name))
  if (target == null) throw new Error(`no button "${name}"`)
  act(() => target.click())
}

describe('Welcome', () => {
  it('walks the steps and hands off to the nivelación on the last one', () => {
    expect(heading()).toContain('Bienvenido a Aprendo')
    click('Siguiente')
    expect(heading()).toContain('Así funciona')
    click('Siguiente')
    expect(heading()).toContain('Lo que vas a lograr')
    expect(onDone).not.toHaveBeenCalled()
    click('Empezar mi nivelación')
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('can be skipped from the first step', () => {
    click('Saltar')
    expect(onDone).toHaveBeenCalledOnce()
  })
})
