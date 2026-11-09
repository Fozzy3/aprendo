import { describe, expect, test } from 'bun:test'
import { assertAnswerIsAnOption, buildFileParts } from '../src/question-enrichment-core'

describe('assertAnswerIsAnOption', () => {
  const options = [
    { label: 'A', bodyMarkdown: 'uno' },
    { label: 'B', bodyMarkdown: 'dos' },
  ]

  test('accepts a label the question has', () => {
    expect(() => assertAnswerIsAnOption('B', options)).not.toThrow()
  })

  // The model picks from A-H whatever the question offers. A key of F on a
  // four-option question can never be answered correctly.
  test('refuses a label the question does not have', () => {
    expect(() => assertAnswerIsAnOption('F', options)).toThrow()
  })
})

describe('buildFileParts', () => {
  const question = (bodyMarkdown: string) => ({ bodyMarkdown, options: [{ label: 'A', bodyMarkdown: 'uno' }] })

  // The URLs Convex hands out have no extension, so guessing the type from the
  // URL dropped every image of an OCR-ingested question without a trace.
  test('keeps an image whose URL has no extension', () => {
    const parts = buildFileParts(question('Mira ![](https://convex.cloud/api/storage/abc-123)'))
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ type: 'image' })
  })

  test('a known extension is kept as an image too', () => {
    expect(buildFileParts(question('![](https://x.co/fig.png)'))).toHaveLength(1)
  })

  test('a relative path the OCR never rewrote is left out, not thrown on', () => {
    expect(buildFileParts(question('![](img-0.jpeg)'))).toEqual([])
  })

  test('reads the crops passed alongside', () => {
    const parts = buildFileParts({ ...question('x'), images: [{ url: 'https://x.co/crop', mediaType: 'image/png' }] })
    expect(parts).toHaveLength(1)
  })
})
