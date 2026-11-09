// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownBlock } from '../components/MarkdownBlock.tsx'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** A dev export folder (`BANK_EXPORT`): every student-visible string goes through the real renderer. */
const EXPORT = process.env.BANK_EXPORT
const load = (name: string) => readFileSync(join(EXPORT ?? '', `${name}.jsonl`), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Record<string, any>)

function collect() {
  const strings: string[] = []
  for (const q of load('questions')) {
    strings.push(q.bodyMarkdown, q.answerSolutionMarkdown ?? '')
    for (const option of q.options ?? []) strings.push(option.bodyMarkdown)
    for (const item of q.answerDistractorRationales ?? []) strings.push(item.rationaleMarkdown)
  }
  for (const g of load('questionGroups')) strings.push(g.contextMarkdown)
  for (const g of load('questionGuides')) {
    strings.push(g.hint, g.reveal)
    for (const path of Object.values(g.byOption ?? {}) as any[]) {
      for (const step of [path.diagnose, ...(path.steps ?? [])]) {
        strings.push(step.prompt, ...step.choices.map((choice: { text: string }) => choice.text))
      }
    }
  }
  return strings.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
}

describe.skipIf(EXPORT == null)('every string in the exported bank renders without an error', () => {
  it('has no KaTeX or console error', { timeout: 600_000 }, async () => {
    const strings = collect()
    const errors: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.map(String).join(' ').slice(0, 200)))
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const BATCH = 80
    const failed: string[] = []
    const raw: string[] = []
    let rendered = 0
    let mathNodes = 0
    for (let start = 0; start < strings.length; start += BATCH) {
      const batch = strings.slice(start, start + BATCH)
      await act(async () => root.render(<div>{batch.map((text, index) => <MarkdownBlock key={index} markdown={text} />)}</div>))
      await vi.waitFor(() => expect(host.querySelectorAll('.markdown-body').length).toBe(batch.length), { timeout: 30_000 })
      const bad = host.querySelectorAll('.katex-error')
      if (bad.length > 0) failed.push(...[...bad].slice(0, 5).map((node) => node.textContent ?? ''))
      mathNodes += host.querySelectorAll('.katex').length
      for (const block of host.querySelectorAll('.markdown-body')) {
        const copy = block.cloneNode(true) as HTMLElement
        copy.querySelectorAll('.katex').forEach((node) => node.remove())
        // TeX that was not typeset, on screen as source text.
        if (/\\(frac|dfrac|times|sqrt|mathrm|cdot|div|left|right|approx|pi)\b/.test(copy.textContent ?? '')) raw.push((copy.textContent ?? '').slice(0, 80))
      }
      rendered += batch.length
    }
    spy.mockRestore()
    act(() => root.unmount())
    host.remove()
    console.log(`bank render: ${rendered} strings, ${mathNodes} math nodes, ${failed.length} KaTeX errors, ${raw.length} raw TeX, ${errors.length} console errors`)
    expect(mathNodes).toBeGreaterThan(0)
    expect(failed).toEqual([])
    expect(raw).toEqual([])
    expect(errors).toEqual([])
  })
})
