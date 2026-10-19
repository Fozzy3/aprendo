// A code block in a web language, closed or still streaming.
const WEB_CODE_BLOCK = /```(?:html|css|js|javascript|xml)\b[\s\S]*?(?:```|$)/gi
// A whole page written as text: from its first tag to its end, or to the end of the reply.
const HTML_DOCUMENT = /(?:<!DOCTYPE html|<html\b)[\s\S]*?(?:<\/html>|$)/gi

/**
 * The tutor's text without any demo it pasted as code. Demos reach the student
 * through `create_artifact`; when the model writes one into the chat instead,
 * the student would read a wall of HTML. The prompt forbids it, this makes sure.
 */
export function cleanTutorReply(text: string): string {
  return text
    .replace(WEB_CODE_BLOCK, '')
    .replace(HTML_DOCUMENT, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
