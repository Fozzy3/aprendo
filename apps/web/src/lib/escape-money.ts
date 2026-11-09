/**
 * The math plugin reads any pair of `$` as math, so "$500 y $300" came out
 * typeset. Pandoc's rule tells them apart: math opens on a non-space and closes
 * on a non-space not followed by a digit. Any other `$` is money, and is escaped.
 */
export function escapeMoney(markdown: string): string {
  const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char)
  const closingDollar = (from: number) => {
    for (let index = from; index < markdown.length; index += 1) {
      if (markdown[index] === '\\') index += 1
      else if (markdown[index] === '$') return index
    }
    return -1
  }

  let result = ''
  let index = 0
  while (index < markdown.length) {
    const char = markdown[index]!
    if (char === '\\') {
      result += markdown.slice(index, index + 2)
      index += 2
    } else if (char !== '$') {
      result += char
      index += 1
    } else if (markdown[index + 1] === '$') {
      // Display math: copied whole, as the renderer finds it.
      const end = markdown.indexOf('$$', index + 2)
      const stop = end === -1 ? markdown.length : end + 2
      result += markdown.slice(index, stop)
      index = stop
    } else {
      const close = closingDollar(index + 1)
      const isMath = close !== -1 && !isSpace(markdown[index + 1]) && !isSpace(markdown[close - 1]) && !/\d/.test(markdown[close + 1] ?? '')
      if (isMath) {
        result += markdown.slice(index, close + 1)
        index = close + 1
      } else {
        result += '\\$'
        index += 1
      }
    }
  }
  return result
}
