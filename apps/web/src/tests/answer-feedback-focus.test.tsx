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
vi.mock('../components/MarkdownBlock.tsx', () => ({ default: () => null }))
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

function render(scrollIntoView: boolean) {
  act(() =>
    root.render(
      <AnswerFeedback
        feedback={{ isCorrect: false, correctOption: 'C', picked: null, solutionMarkdown: null, others: [] }}
        explanationSource={null}
        isLast={false}
        scrollIntoView={scrollIntoView}
        onNext={() => {}}
      />,
    ),
  )
}

describe('AnswerFeedback focus', () => {
  it('moves focus to the verdict right after "Comprobar", so it is read aloud', () => {
    render(true)
    expect(document.activeElement).toBe(container.querySelector('.answer-verdict'))
    expect(document.activeElement?.textContent).toContain('Incorrecta')
    expect(document.activeElement?.textContent).toContain('La respuesta es la C.')
  })

  it('leaves focus alone on a revisit', () => {
    render(false)
    expect(document.activeElement).toBe(document.body)
  })
})
