/**
 * Voice for the tutor, phase 0 (plans/tutor-voz.md): the browser's own speech
 * recognition and synthesis. No audio reaches our servers and none is kept (the
 * browser's own provider may process it, e.g. Google in Chrome: see /privacidad);
 * where the browser lacks recognition (Firefox) the mic simply does not show.
 */

type Recognition = {
  lang: string
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

export function createRecognition(): Recognition | null {
  if (typeof window === 'undefined') return null
  const ctor = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
  const Speech = ctor.SpeechRecognition ?? ctor.webkitSpeechRecognition
  if (Speech == null) return null
  const recognition = new Speech()
  recognition.lang = 'es-CO'
  recognition.interimResults = false
  return recognition
}

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Reads the reply aloud in Spanish; a new one cuts the previous. */
export function speak(markdown: string) {
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(speakableText(markdown))
  utterance.lang = 'es-CO'
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}

// ponytail: covers the LaTeX the tutor writes in short replies; a formula it
// cannot read stays on screen in the chat, which the voice never replaces.
const MATH_WORDS: [RegExp, string][] = [
  [/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1 sobre $2'],
  [/\\sqrt\{([^{}]*)\}/g, 'raíz de $1'],
  [/\^\{?2\}?/g, ' al cuadrado'],
  [/\^\{?3\}?/g, ' al cubo'],
  [/\^\{?([^{}\s]+)\}?/g, ' a la $1'],
  [/\\(cdot|times)/g, ' por '],
  [/\\div/g, ' entre '],
  [/\\(leq|le)\b/g, ' menor o igual que '],
  [/\\(geq|ge)\b/g, ' mayor o igual que '],
  [/\\neq/g, ' distinto de '],
  [/\\pi/g, ' pi '],
  [/\+/g, ' más '],
  [/(?<=\s)-(?=\s)/g, ' menos '],
  [/=/g, ' igual a '],
  [/</g, ' menor que '],
  [/>/g, ' mayor que '],
  [/\\[a-zA-Z]+/g, ' '],
  [/[{}]/g, ''],
]

/** Markdown and LaTeX turned into something a voice can say. */
export function speakableText(markdown: string): string {
  const withMath = markdown.replace(/\$\$?([^$]+)\$\$?/g, (_, math: string) =>
    MATH_WORDS.reduce((text, [pattern, words]) => text.replace(pattern, words), math))
  return withMath
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
