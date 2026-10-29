// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CareerPicker } from '../components/CareerPicker'

// See timed-session-intro.test.tsx: a single React under this config.
vi.mock('lucide-react', () => ({ ArrowLeft: () => null }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root
let onChoose: ReturnType<typeof vi.fn>

beforeEach(() => {
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
  onChoose = vi.fn()
  act(() => root.render(<CareerPicker onChoose={onChoose} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const click = (name: string) => {
  const target = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(name))
  if (target == null) throw new Error(`no button "${name}"`)
  act(() => target.click())
}

describe('CareerPicker', () => {
  it('chooses a family directly', () => {
    click('Derecho y ciencia política')
    expect(onChoose).toHaveBeenCalledWith('derecho')
  })

  it('"Todavía no sé" asks the 12 activities and suggests families from the answers', () => {
    click('Todavía no sé')
    const likes = [...container.querySelectorAll('fieldset')]
    expect(likes).toHaveLength(12)
    // Likes the investigative and social activities, nothing else.
    for (const fieldset of likes) {
      const legend = fieldset.querySelector('legend')?.textContent ?? ''
      const choice = /fenómeno|lógica|compañero|problema/.test(legend) ? 'Me gusta' : 'No me gusta'
      const input = [...fieldset.querySelectorAll('label')].find((label) => label.textContent?.includes(choice))!.querySelector('input')!
      act(() => input.click())
    }
    click('Ver mis familias')
    expect(container.textContent).toContain('Salud')
    expect(container.textContent).toContain('orientador')
    click('Elegir Salud')
    expect(onChoose).toHaveBeenCalledWith('salud')
  })
})
