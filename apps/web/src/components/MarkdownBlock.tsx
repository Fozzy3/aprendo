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

export default function MarkdownBlock({ markdown }: { markdown: string }) {
  return (
    <Streamdown className="markdown-body" plugins={{ math }} components={components}>
      {markdown}
    </Streamdown>
  )
}
