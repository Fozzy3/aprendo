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
  /^Cuadernillo de(\s+preguntas)?\s*$/i,
  // The 2026 footer prints a lone dot and the area on their own lines.
  /^\.\s*$/,
  /^Prueba\s+(Lectura|Matemáticas|Sociales|Ciencias|Inglés)/i,
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
/**
 * Headings the booklets put above their answer key, strongest first. The covers
 * of the 2026 booklets say "respuestas correctas" too, so the weak form is only
 * trusted when nothing better exists.
 */
const KEY_HEADINGS = [
  /Tabla de respuestas correctas/i,
  /Clave de respuestas|Posición\s+Afirmación/i,
  /Respuestas? correctas?/i,
]

export function parseAnswerKey(text: string): Map<number, { option: string; level?: string }> {
  // Scan from the key's own heading rather than from a fixed tail.
  //
  // The 2026 booklets print the key as a three-column table with the assessed
  // statement in the middle, so one entry spans about five lines and a 50-entry
  // key runs well past any fixed window. A 6000-character tail saw the last
  // fourteen rows of Ciencias Naturales and silently dropped the other
  // thirty-two.
  const heading = KEY_HEADINGS.map((pattern) => pattern.exec(text)).find((match) => match != null)
  const from = heading?.index ?? Math.max(0, text.length - 6000)
  return readKeyRows(text.slice(from))
}

/** Every `number letter` row of an answer key, wherever it starts. */
function readKeyRows(section: string): Map<number, { option: string; level?: string }> {
  const key = new Map<number, { option: string; level?: string }>()

  for (const line of section.split('\n')) {
    // `4   naturaleza con base en…   B`: the statement shares the row. It needs
    // a real word in the middle, or two key columns (`1  A   26  C`) would match.
    const statementRow = line.match(/^\s*(\d{1,3})\s{2,}(?=.*\p{L}{2,}).*\S\s{3,}([A-H])\s*$/u)
    const pairs = statementRow != null
      ? [statementRow]
      : line.matchAll(/(?<![\d.,])(\d{1,3})\s+([A-H])(?![\w])(?:\s+(Pre\s?A1|A1|A2|B1|B\+|[1-4])(?![\d]))?/g)
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

/** `Tabla de respuestas correctas - Examen 2`, with or without the dash or a line break. */
const EXAM_KEY_HEADING = /Tabla de respuestas correctas\s*(?:[-–]\s*)?Examen\s+(\d)/gi

/**
 * The answer keys of a booklet that prints two exams, by exam number.
 *
 * Both exams number their questions from 1, so read as one key the second table
 * would overwrite the first. Empty when the booklet has no exam sections.
 */
export function parseExamAnswerKeys(
  text: string,
): Map<number, Map<number, { option: string; level?: string }>> {
  const headings = [...text.matchAll(EXAM_KEY_HEADING)]
  return new Map(
    headings.map((heading, index) => [
      Number(heading[1]),
      readKeyRows(text.slice(heading.index, headings[index + 1]?.index)),
    ]),
  )
}

/**
 * The ways a booklet prints an answer right beside its question.
 *
 * Case matters in the first one: the explanations also say "la opción de
 * respuesta correcta", which is prose, not a key.
 */
const INLINE_ANSWER = [
  /Respuesta correcta(?:\s+de la descripción \d+)?[ \t]*:?[ \t]*([A-H])\b/,
  /encuentra en la opción ([A-H])\b/i,
]

/** The answer printed beside a question, for booklets with no key table. */
export function inlineAnswer(block: string): string | undefined {
  for (const pattern of INLINE_ANSWER) {
    const match = pattern.exec(block)
    if (match != null) return match[1]
  }
  return undefined
}

interface OptionCell {
  label: string
  /** Where the label starts. */
  column: number
  /** Just past the label's dot. */
  end: number
}

/**
 * The options a line opens with. Figure answers print side by side (`A. 12   B. 5`)
 * or as bare labels above their drawings.
 *
 * A later label needs a column gap and a later letter, or it is prose inside the
 * option: "la opción B." is not option B.
 */
function optionCells(line: string): OptionCell[] {
  const first = line.match(/^(\s*)([A-H])\.(?=\s|$)/)
  if (first == null) return []
  const cells: OptionCell[] = [{ label: first[2]!, column: first[1]!.length, end: first[0].length }]
  for (const match of line.matchAll(/(?:\s{2,}|\t)([B-H])\.(?=\s|$)/g)) {
    const end = match.index + match[0].length
    if (match[1]! > cells[cells.length - 1]!.label) {
      cells.push({ label: match[1]!, column: end - 2, end })
    }
  }
  return cells
}

/** Split the option block off the end of a question and label each choice. */
function splitOptions(block: string): { stem: string; options: ParsedOption[] } {
  const lines = block.split('\n')
  let options: ParsedOption[] = []
  let firstOptionLine = -1
  // The options of the row being read. A wrapped line continues them, column by
  // column; anything starting further left is new material.
  let open: Array<{ option: ParsedOption; column: number }> = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line == null) continue

    const cells = optionCells(line)
    if (cells.length > 0) {
      // A second `A.` means the first was a label inside the figure, not an option.
      if (firstOptionLine === -1 || cells[0]!.label === 'A') {
        firstOptionLine = index
        options = []
      }
      open = cells.map((cell, position) => {
        const option = {
          label: cell.label,
          text: line.slice(cell.end, cells[position + 1]?.column).trim(),
        }
        options.push(option)
        return { option, column: cell.column }
      })
      continue
    }

    if (options.length === 0) continue

    // A blank line closes the option. Without this the last option kept
    // swallowing whatever followed — in the Lectura booklet, option D of
    // question 1 absorbed the next group's heading and its whole 2000-character
    // passage.
    if (line.trim().length === 0) {
      open = []
      continue
    }
    if (open.length === 0) continue

    // A shared-stimulus heading or the page footer is never part of an option.
    if (/RESPONDA\s+(?:LAS\s+)?PREGUNTAS?/i.test(line) || isNoise(line)) {
      open = []
      continue
    }

    const indent = line.length - line.trimStart().length
    if (indent < open[0]!.column + 1) {
      open = []
      continue
    }

    open.forEach((cell, position) => {
      const piece = line.slice(position === 0 ? 0 : cell.column, open[position + 1]?.column).trim()
      if (piece.length > 0) cell.option.text = `${cell.option.text} ${piece}`.trim()
    })
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
        if (/^\s*[A-H]\.(?:\s|$)/.test(betweenLines[line] ?? '')) lastOptionLine = line
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
      correctOption: inlineAnswer(block) ?? answer?.option,
      level: answer?.level,
      // A blank option is a drawing the text layer cannot carry.
      needsArtwork:
        referencesArtwork(`${contextMarkdown ?? ''}\n${stem}`)
        || options.some((option) => option.text.length === 0),
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

/**
 * Questions that lean on a figure but have a printed key. They are not dropped:
 * a person reads them against the crop, in the audit queue.
 */
export function figureQuestions(questions: ParsedQuestion[]): ParsedQuestion[] {
  return questions.filter(
    (question) =>
      question.needsArtwork
      && question.correctOption != null
      && question.options.some((option) => option.label === question.correctOption),
  )
}

export interface BookletGroupSlot {
  /** The group's `contextKey`. */
  key: string
  firstNumber: number
  lastNumber: number
  memberCount: number
  /** 0-based position of this question within its group. */
  position: number
}

/**
 * Each question's place in its stimulus group, worked out over the whole
 * booklet. The loader sends questions to Convex in slices; computing this per
 * slice split a passage that straddled two slices into two groups.
 */
export function groupSlots(
  questions: Array<Pick<ParsedQuestion, 'number' | 'contextKey'>>,
): Array<BookletGroupSlot | null> {
  const numbersByKey = new Map<string, number[]>()
  for (const question of questions) {
    if (question.contextKey == null) continue
    numbersByKey.set(question.contextKey, [
      ...(numbersByKey.get(question.contextKey) ?? []),
      question.number,
    ])
  }
  for (const numbers of numbersByKey.values()) numbers.sort((a, b) => a - b)

  return questions.map((question) => {
    if (question.contextKey == null) return null
    const numbers = numbersByKey.get(question.contextKey)!
    return {
      key: question.contextKey,
      firstNumber: numbers[0]!,
      lastNumber: numbers[numbers.length - 1]!,
      memberCount: numbers.length,
      position: numbers.indexOf(question.number),
    }
  })
}
