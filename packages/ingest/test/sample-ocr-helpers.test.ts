import { describe, expect, test } from 'bun:test'
import {
  buildImageAssetFileName,
  buildPageMarkdownFileName,
  buildPageMarkdown,
} from '../src/mistral-ocr'

describe('buildImageAssetFileName', () => {
  test('uses stable page-based file names for extracted images', () => {
    expect(buildImageAssetFileName(8, 0, 'png')).toBe('page-08-image-01.png')
    expect(buildImageAssetFileName(14, 2, 'jpg')).toBe('page-14-image-03.jpg')
  })
})

describe('buildPageMarkdownFileName', () => {
  test('uses stable file names for per-page markdown notes', () => {
    expect(buildPageMarkdownFileName(1)).toBe('page-01.md')
    expect(buildPageMarkdownFileName(14)).toBe('page-14.md')
  })
})

describe('buildPageMarkdown', () => {
  test('renders page markdown with rewritten image links and appended tables', () => {
    const markdown = buildPageMarkdown({
      pageNumber: 2,
      markdown:
        '# OCR page content\n\nPregunta de ejemplo.\n\n![img-1](img-1)',
      tables: [
        { id: 'table-1', content: '| x | y |\n| - | - |\n| 1 | 2 |' },
      ],
      idToRelativePath: new Map([
        ['img-1', '../assets/page-02-image-01.jpg'],
      ]),
    })

    expect(markdown).toContain('# Page 2')
    expect(markdown).toContain('![img-1](../assets/page-02-image-01.jpg)')
    expect(markdown).toContain('## Tables')
    expect(markdown).toContain('<!-- table-1 -->')
    expect(markdown).toContain('| x | y |')
  })

  test('omits tables section when there are no tables', () => {
    const markdown = buildPageMarkdown({
      pageNumber: 1,
      markdown: 'Simple text content.',
      tables: [],
      idToRelativePath: new Map(),
    })

    expect(markdown).toContain('# Page 1')
    expect(markdown).toContain('Simple text content.')
    expect(markdown).not.toContain('## Tables')
  })
})
