import type { ComponentProps } from 'react'
import { Streamdown, type ExtraProps } from 'streamdown'
import { createMathPlugin } from '@streamdown/math'
import 'katex/dist/katex.min.css'

const math = createMathPlugin({
  singleDollarTextMath: true,
})

const BLOCK_TAGS = new Set(['img', 'div', 'pre', 'figure', 'table', 'ul', 'ol', 'blockquote'])

function Paragraph({ node, children, ...props }: ComponentProps<'p'> & ExtraProps) {
  const hasBlockChild = node?.children?.some(
    (child) => child.type === 'element' && BLOCK_TAGS.has(child.tagName),
  )
  if (hasBlockChild) {
    return <div {...(props as ComponentProps<'div'>)}>{children}</div>
  }
  return <p {...props}>{children}</p>
}

const components = { p: Paragraph }

/**
 * `skipHtml` drops raw HTML tags (their text stays). For chat text, where a tag
 * is never meant; question bodies keep theirs (OCR `<img>`).
 */
export function MarkdownBlock({ markdown, skipHtml = false }: { markdown: string; skipHtml?: boolean }) {
  return (
    <Streamdown className="markdown-body" plugins={{ math }} components={components} skipHtml={skipHtml}>
      {markdown}
    </Streamdown>
  )
}
