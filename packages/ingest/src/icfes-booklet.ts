/**
 * Deterministic extraction of ICFES practice booklets.
 *
 * These PDFs carry a real text layer and print their own answer key, so no OCR
 * and no model is involved: the questions, the options and the correct answers
 * are all read straight off the page. That matters for more than cost — the
 * answer is the one ICFES published, not one a model inferred, which removes
 * the single biggest correctness risk in the existing pipeline.
 *
 * Pure string work, no I/O: the caller supplies `pdftotext -layout` output.
 */

export interface ParsedOption {
  label: string
  text: string
}

export interface ParsedQuestion {
  number: number
  stem: string
  /**
   * The passage, table or excerpt the question depends on, when the booklet
   * prints one before it.
   *
   * Dropping this is not a cosmetic loss: a Lectura Crítica item without its
   * text is unanswerable, and the booklets carry twelve shared-stimulus blocks
   * plus untitled passages before individual questions. Shipping those stems
   * alone would reproduce exactly the bug this project already fixed once.
   */
  contextMarkdown?: string
  /** Stable key for the shared block, so members of a group can be linked. */
  contextKey?: string
  options: ParsedOption[]
  /** From the booklet's own answer key, when it lists this question. */
  correctOption?: string
  /** Performance level, when the key carries one (the Inglés booklet does). */
  level?: string
  /**
   * True when the wording leans on a figure, table or image. The text layer
   * cannot carry those, so these are unanswerable as plain text and must not be
   * shown to a student until the artwork is attached.
   */
  needsArtwork: boolean
}

/** Page furniture that survives `pdftotext` and would otherwise land in a stem. */
const NOISE = [
  // The running footer carries the page number on the same line, so anchoring
  // straight to end-of-line missed every one of them and left "Saber 11.º 7"
  // sitting inside the reading passages.
  /^Saber 11\.?[º°]?(\s+\d{1,3})?\s*$/i,
  /^\d{4}\s*$/,
  /^Cuadernillo de\s*$/i,
  /^preguntas\s*$/i,
  /^Módulo de\s*$/i,
  /^Prueba\s*$/i,
  /^\s*\d{1,3}\s*$/,
  /^www\.icfes\.gov\.co/i,
  /^Calle 26/i,
  /^Líneas de atención/i,
  /Icfes$/i,
]

function isNoise(line: string): boolean {
  const t = line.trim()
  if (t.length === 0) return false
  return NOISE.some((re) => re.test(t))
}

/**
 * Wording that gives away a dependency on artwork.
 *
 * Deliberately broad. A false positive costs one usable question; a false
 * negative puts an unanswerable question in front of a student, which is the
 * failure this whole check exists to prevent.
 */
const ARTWORK_HINTS =
  /\b(figura|gráfic[ao]|imagen|tabla|diagrama|mapa|esquema|ilustración|dibujo|plano|ecuación|fórmula|estructura\s+de\s+Lewis|siguiente\s+(figura|tabla|gráfica|imagen|ecuación|esquema)|se\s+muestra|según\s+la\s+(figura|tabla|gráfica)|de\s+acuerdo\s+con\s+la\s+(figura|tabla|gráfica))\b/i

export function referencesArtwork(text: string): boolean {
  return ARTWORK_HINTS.test(text)
}

/**
 * Read the answer key printed at the end of a booklet.
 *
 * The key is laid out in two or three columns, so a single line can hold
 * several `number letter` pairs — and, in the Inglés booklet, a performance
 * level after each. Only the tail of the document is scanned: `3 B` shaped
 * fragments occur inside question bodies too.
 */
/** Headings the booklets put above their answer key, in every format seen. */
const KEY_HEADING =
  /(Tabla de respuestas correctas|Respuestas? correctas?|Clave de respuestas|Posición\s+Afirmación)/gi

export function parseAnswerKey(text: string): Map<number, { option: string; level?: string }> {
  // Scan from the key's own heading rather than from a fixed tail.
  //
  // The 2026 booklets print the key as a three-column table with the assessed
  // statement in the middle, so one entry spans about five lines and a 50-entry
  // key runs well past any fixed window. A 6000-character tail saw the last
  // fourteen rows of Ciencias Naturales and silently dropped the other
  // thirty-two.
  const headings = [...text.matchAll(KEY_HEADING)]
  const from = headings.length > 0 ? headings[0]!.index! : Math.max(0, text.length - 6000)
  const tail = text.slice(from)
  const key = new Map<number, { option: string; level?: string }>()

  for (const line of tail.split('\n')) {
    const pairs = line.matchAll(
      /(?<![\d.,])(\d{1,3})\s+([A-H])(?![\w])(?:\s+(Pre\s?A1|A1|A2|B1|B\+|[1-4])(?![\d]))?/g,
    )
    for (const pair of pairs) {
      const number = Number(pair[1])
      // Booklets top out well under 200 questions; anything larger is a year,
      // a page number or a figure label that happens to sit beside a letter.
      if (number < 1 || number > 200) continue
      const option = pair[2]
      if (option == null) continue
      key.set(number, { option, level: pair[3]?.replace(/\s+/g, ' ') })
    }
  }

  return key
}

/** Split the option block off the end of a question and label each choice. */
function splitOptions(block: string): { stem: string; options: ParsedOption[] } {
  const lines = block.split('\n')
  const options: ParsedOption[] = []
  let firstOptionLine = -1
  // Column where the current option's own text begins. A wrapped line is
  // indented to sit under it; anything starting further left is new material.
  let continuationIndent = -1

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line == null) continue

    const match = line.match(/^(\s{2,})([A-H])\.\s+(.*)$/)
    if (match != null) {
      if (firstOptionLine === -1) firstOptionLine = index
      options.push({ label: match[2]!, text: (match[3] ?? '').trim() })
      continuationIndent = match[1]!.length + match[2]!.length + 2
      continue
    }

    if (options.length === 0) continue

    // A blank line closes the option. Without this the last option kept
    // swallowing whatever followed — in the Lectura booklet, option D of
    // question 1 absorbed the next group's heading and its whole 2000-character
    // passage.
    if (line.trim().length === 0) {
      continuationIndent = -1
      continue
    }
    if (continuationIndent === -1) continue

    // A shared-stimulus heading is never part of an option.
    if (/RESPONDA\s+(?:LAS\s+)?PREGUNTAS?/i.test(line)) {
      continuationIndent = -1
      continue
    }

    const indent = line.length - line.trimStart().length
    if (indent < continuationIndent - 2) {
      continuationIndent = -1
      continue
    }

    const last = options[options.length - 1]
    if (last != null) last.text = `${last.text} ${line.trim()}`.trim()
  }

  const stemLines = (firstOptionLine === -1 ? lines : lines.slice(0, firstOptionLine))
    .filter((line) => !isNoise(line))
    .map((line) => line.trim())

  // Collapse the blank runs `pdftotext` leaves where artwork used to be, but
  // keep paragraph breaks.
  const stem = stemLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { stem, options }
}

/** "RESPONDA LAS PREGUNTAS 4 A 7…" / "… 2 Y 3 …" — the shared-block headings. */
const GROUP_HEADING =
  /RESPONDA\s+(?:LAS\s+)?PREGUNTAS?\s+(\d{1,3})\s*(?:A|Y|-|–)\s*(\d{1,3})[^\n]*/gi

interface GroupRange {
  first: number
  last: number
  headingIndex: number
  headingLength: number
}

function findGroups(text: string): GroupRange[] {
  return [...text.matchAll(GROUP_HEADING)].map((m) => ({
    first: Number(m[1]),
    last: Number(m[2]),
    headingIndex: m.index!,
    headingLength: m[0].length,
  }))
}

/**
 * Front matter every booklet opens with: the licence, the cover blurb, the
 * "what's in this booklet" note.
 *
 * It sits before question 1 with nothing between, so a naive look-backwards
 * hands the first question three thousand characters of copyright notice as its
 * reading passage. That is exactly what happened to Sociales question 1.
 */
const BOILERPLATE =
  new RegExp(
    [
      'TÉRMINOS Y CONDICIONES',
      'pone a la disposición',
      'derechos de autor',
      'propiedad intelectual',
      '¿Qué contiene este cuadernillo\\?',
      'Queda prohibido el uso',
      'prensaicfes@icfes\\.gov\\.co',
      'marcas registradas',
      // The cover blurb, worded identically in every booklet.
      'fueron utilizadas en aplicaciones anteriores',
      'serán útiles para familiarizarte',
      'encontrarás las\\s*$',
      'respuestas correctas de todas las preguntas',
      '¡Recuerda!',
      'evalúa competencias',
      'elegir la respuesta',
    ].join('|'),
    'i',
  )

/**
 * Clean the prose sitting between one question's options and the next heading.
 *
 * Everything `pdftotext` leaves behind — page furniture, source credits, the
 * instruction line — is stripped; what remains is the passage itself.
 */
function cleanStimulus(raw: string): string {
  // Anything at or before the last piece of front matter is not a passage.
  let text = raw
  const lines0 = text.split('\n')
  let lastBoilerplate = -1
  for (let i = 0; i < lines0.length; i += 1) {
    if (BOILERPLATE.test(lines0[i] ?? '')) lastBoilerplate = i
  }
  if (lastBoilerplate !== -1) text = lines0.slice(lastBoilerplate + 1).join('\n')

  const lines = text
    .split('\n')
    .filter((line) => !isNoise(line))
    .filter((line) => !/^\s*(Tomado y adaptado de|Tomado de|Adaptado de|Fuente):/i.test(line))
    .filter((line) => !/^\s*[A-H]\.\s/.test(line))
    // The instruction heading is scaffolding, not part of the passage — and
    // leaving it in reproduces the original grouping bug, where the stem
    // carried "RESPONDA LAS PREGUNTAS 4 A 7" as if it were content.
    .filter((line) => !/RESPONDA\s+(?:LAS?\s+)?PREGUNTAS?/i.test(line))
    // A bare area name is the running head of the section divider.
    .filter(
      (line) =>
        !/^\s*(Lectura Crítica|Matemáticas|Sociales y Ciudadanas|Ciencias Naturales|Inglés)\s*$/i.test(
          line,
        ),
    )
    // A dangling fragment of the cover blurb's last sentence.
    .filter((line) => !/^\s*correcta\.\s*$/i.test(line))
    .map((line) => line.trim())

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseBooklet(text: string): ParsedQuestion[] {
  const key = parseAnswerKey(text)
  const groups = findGroups(text)

  // `Pregunta N` is the booklet's own heading for each item.
  const marks = [...text.matchAll(/^\s*Pregunta\s+(\d{1,3})\s*$/gm)]
  const questions: ParsedQuestion[] = []

  for (let index = 0; index < marks.length; index += 1) {
    const mark = marks[index]!
    const number = Number(mark[1])
    const start = mark.index! + mark[0].length
    const end = index + 1 < marks.length ? marks[index + 1]!.index! : text.length
    const block = text.slice(start, end)

    const { stem, options } = splitOptions(block)
    if (stem.length === 0 || options.length < 2) continue

    // The stimulus is whatever prose sits between the previous question and
    // this heading. For a grouped run it starts at the group's own heading, so
    // every member gets the same block rather than only the first.
    const group = groups.find((g) => number >= g.first && number <= g.last)
    let contextMarkdown: string | undefined
    let contextKey: string | undefined

    if (group != null) {
      const from = group.headingIndex + group.headingLength
      const to = marks.find((m) => Number(m[1]) === group.first)?.index ?? mark.index!
      const cleaned = cleanStimulus(text.slice(from, Math.max(from, to)))
      if (cleaned.length > 40) {
        contextMarkdown = cleaned
        contextKey = `g${group.first}-${group.last}`
      }
    } else {
      const prevEnd = index === 0 ? 0 : marks[index - 1]!.index!
      const between = text.slice(prevEnd, mark.index!)
      // A new passage begins after the previous question's last option. Finding
      // that boundary by the last option line is exact; an earlier version
      // looked for the last indented line instead, which lands *inside* the
      // passage and returned only its final sentence.
      const betweenLines = between.split('\n')
      let lastOptionLine = -1
      for (let line = 0; line < betweenLines.length; line += 1) {
        if (/^\s{2,}[A-H]\.\s/.test(betweenLines[line] ?? '')) lastOptionLine = line
      }
      const cleaned = cleanStimulus(betweenLines.slice(lastOptionLine + 1).join('\n'))
      // A short fragment here is leftover furniture, not a passage.
      if (cleaned.length > 200) {
        contextMarkdown = cleaned
        contextKey = `q${number}`
      }
    }

    const answer = key.get(number)
    questions.push({
      number,
      stem,
      contextMarkdown,
      contextKey,
      options,
      correctOption: answer?.option,
      level: answer?.level,
      needsArtwork: referencesArtwork(`${contextMarkdown ?? ''}\n${stem}`),
    })
  }

  return questions
}

/**
 * Questions safe to put in front of a student: a printed answer, a label that
 * matches one of the options, and no dependency on artwork the text layer
 * cannot carry.
 */
export function usableQuestions(questions: ParsedQuestion[]): ParsedQuestion[] {
  return questions.filter(
    (question) =>
      !question.needsArtwork
      && question.correctOption != null
      && question.options.some((option) => option.label === question.correctOption),
  )
}
