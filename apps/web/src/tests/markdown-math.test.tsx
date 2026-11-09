// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GuidedPath } from '../components/GuidedPath.tsx'
import { MarkdownBlock } from '../components/MarkdownBlock.tsx'
import { SharedStimulus } from '../components/SharedStimulus.tsx'
import { escapeMoney } from '../lib/escape-money.ts'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const show = (node: ReactNode) => act(() => root.render(node))

describe('escapeMoney', () => {
  it.each([
    ['$ 5.670.000', '\\$ 5.670.000'],
    ['de $500 por cada una', 'de \\$500 por cada una'],
    ['$800.000 y luego $50 más', '\\$800.000 y luego \\$50 más'],
    ['$1.000-$2.000', '\\$1.000-\\$2.000'],
  ])('escapes the money in %s', (input, output) => {
    expect(escapeMoney(input)).toBe(output)
  })

  it.each([
    '$x^2$',
    '$6^2 = 36$ m²',
    '$4800 - 1800 = 3000$',
    '$800.000 + 5n$',
    '$$\\frac{1}{2}$$',
    '| \\$ 35.000 | $W$ |',
  ])('leaves math and escaped dollars alone: %s', (input) => {
    expect(escapeMoney(input)).toBe(input)
  })

  it('tells money from math in one string', () => {
    expect(escapeMoney('Cuesta $500 si $x$ es par')).toBe('Cuesta \\$500 si $x$ es par')
  })
})

describe('MarkdownBlock', () => {
  it('renders math, and money as plain text', async () => {
    await show(<MarkdownBlock markdown={'La razón es $\\frac{3}{5}$'} />)
    await vi.waitFor(() => expect(host.querySelector('.katex')).not.toBeNull())

    await show(<MarkdownBlock markdown={'Compró en $ 5.000 y vendió en $ 7.000'} />)
    await vi.waitFor(() => {
      expect(host.textContent).toContain('$ 5.000')
      expect(host.textContent).toContain('$ 7.000')
      expect(host.querySelector('.katex')).toBeNull()
    })
  })
})

describe('GuidedPath', () => {
  it('shows prompts and choices with math rendered', async () => {
    await show(
      <GuidedPath
        guide={{ phase: 'step', stepIndex: 1, stepCount: 2, prompt: '¿Cuánto es $\\frac{1}{2}$?', choices: ['$\\frac{3}{4}$', 'Cuatro'], canReveal: false }}
        lastCorrect={null}
        isBusy={false}
        error={null}
        onChoose={() => {}}
        onReveal={() => {}}
      />,
    )
    await vi.waitFor(() => {
      expect(host.querySelector('h2 .katex')).not.toBeNull()
      expect(host.querySelector('button .katex')).not.toBeNull()
    })
    expect(host.textContent).toContain('Cuatro')
  })
})

describe('SharedStimulus', () => {
  it('shows the passage image, with a text alternative when it has no text', async () => {
    await show(<SharedStimulus group={{ id: 'g', contextMarkdown: '', imageUrl: 'https://x/p.png', memberCount: 3, position: 2 }} />)
    const image = host.querySelector('img')!
    expect(image.getAttribute('src')).toBe('https://x/p.png')
    expect(image.getAttribute('alt')).not.toBe('')
  })
})
