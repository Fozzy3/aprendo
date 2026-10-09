// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimedSessionIntro } from '../components/TimedSessionIntro'

// Packages loaded outside Vite (lucide-react, @testing-library/react) bring
// their own copy of React under this config, so icons are stubbed and the
// tree is rendered with react-dom directly.
vi.mock('lucide-react', () => {
  const Icon = () => null
  return Object.fromEntries(
    ['Activity', 'BookOpen', 'BotOff', 'Flag', 'Gauge', 'Hourglass', 'ListChecks', 'Play', 'RotateCcw', 'SlidersHorizontal', 'Sparkles', 'Timer', 'Trophy']
      .map((name) => [name, Icon]),
  )
})
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Like the hub and the nivelación screen: the picker that opens the intro is
 * replaced by it, so the trigger unmounts and comes back as a new node.
 */
function Picker() {
  const [isOpen, setIsOpen] = useState(false)
  return isOpen ? (
    <TimedSessionIntro
      title="Simulacro · Sesión 1"
      questionCount={131}
      timeLimitMs={270 * 60_000}
      isStarting={false}
      cancelLabel="Elegir otra"
      onStart={() => {}}
      onCancel={() => setIsOpen(false)}
    />
  ) : (
    <div role="group">
      <button type="button">Sesión 2</button>
      <button type="button" onClick={() => setIsOpen(true)}>
        Sesión 1
      </button>
    </div>
  )
}

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
  act(() => root.render(<Picker />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function button(name: string) {
  const found = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)
  if (found == null) throw new Error(`No button "${name}"`)
  return found
}

function openIntro() {
  const trigger = button('Sesión 1')
  trigger.focus()
  act(() => trigger.click())
}

describe('TimedSessionIntro focus', () => {
  it('moves focus to the intro when it opens', () => {
    openIntro()
    expect(document.activeElement).toBe(container.querySelector('h2'))
    expect(document.activeElement?.textContent).toBe('Simulacro · Sesión 1')
  })

  it('gives focus back to the trigger when cancelled, even after it remounts', async () => {
    openIntro()
    act(() => button('Elegir otra').click())
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))

    expect(document.activeElement).toBe(button('Sesión 1'))
  })
})
