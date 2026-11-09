// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnswerFeedback } from '../components/AnswerFeedback'

// Same setup as timed-session-intro.test.tsx: icons stubbed, react-dom directly.
vi.mock('lucide-react', () => {
  const Icon = () => null
  return { ChevronRight: Icon, CircleCheck: Icon, CircleX: Icon }
})
vi.mock('../components/MarkdownBlock.tsx', () => ({ MarkdownBlock: ({ markdown }: { markdown: string }) => <p>{markdown}</p> }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  Element.prototype.scrollIntoView = vi.fn()
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const WRONG = { isCorrect: false, correctOption: 'C', picked: null, solutionMarkdown: 'Porque sí', others: [] }

function render(justChecked: boolean, props: Partial<Parameters<typeof AnswerFeedback>[0]> = {}) {
  act(() =>
    root.render(
      <AnswerFeedback
        feedback={WRONG}
        explanationSource={null}
        isLast={false}
        justChecked={justChecked}
        outcome="revealed"
        reveal={null}
        onNext={() => {}}
        {...props}
      />,
    ),
  )
}

describe('AnswerFeedback focus', () => {
  it('moves focus to the verdict when the answer arrives, so it is read aloud', () => {
    render(true)
    expect(document.activeElement).toBe(container.querySelector('.answer-verdict'))
    expect(document.activeElement?.textContent).toContain('La respuesta es la C.')
  })

  it('leaves focus alone on a revisit', () => {
    render(false)
    expect(document.activeElement).toBe(document.body)
  })
})

describe('AnswerFeedback verdict', () => {
  const verdict = () => container.querySelector('.answer-verdict')?.textContent

  it('says "Correcta" for a right answer', () => {
    render(false, { feedback: { ...WRONG, isCorrect: true }, outcome: null })
    expect(verdict()).toContain('Correcta')
  })

  it('credits a student who found it on the guided path', () => {
    render(false, { outcome: 'self_corrected' })
    expect(verdict()).toContain('Lo descubriste')
  })

  it('never says "Incorrecta": the path already asked instead', () => {
    render(false)
    expect(verdict()).not.toContain('Incorrecta')
  })

  it('shows the short reveal when the answer was given', () => {
    render(false, { reveal: 'Tres de cada cinco.' })
    expect(container.textContent).toContain('Tres de cada cinco.')
  })

  it('keeps the explanation one tap away', () => {
    render(false)
    const details = container.querySelector('details')
    expect(details?.querySelector('summary')?.textContent).toContain('¿Por qué funciona?')
    expect(details?.open).toBe(false)
  })
})
