/**
 * The deterministic stage of the question audit (F62): everything that can be
 * known about a question without asking a model. Pure, so each rule is pinned
 * by a test and the same rules run on the ICFES bank, on authored items and on
 * the seed.
 *
 * `fail` means a student must not meet the question as it stands; `warn` means
 * a person should look at it.
 */
import { referencesArtwork } from '@aprendo/ingest/icfes-booklet'
import { getSubtopicContext } from './taxonomy'

export type AuditCheck = { id: string; result: 'pass' | 'warn' | 'fail'; detail?: string }

type Option = { label: string; bodyMarkdown: string }

export type CheckQuestion = {
  bodyMarkdown: string
  options: Option[]
  answerCorrectOption?: string
  subjectId?: string
  categoryId?: string
  primarySubtopicId?: string
  renderedStemImageId?: string
  stemDisplay?: 'text' | 'scan'
}

export type CheckGroup = {
  contextMarkdown: string
  firstNumber?: number
  lastNumber?: number
  memberCount?: number
  contextImages?: string[]
  renderedContextImageId?: string
}

const check = (id: string, problem: { result: 'warn' | 'fail'; detail: string } | null): AuditCheck =>
  problem == null ? { id, result: 'pass' } : { id, ...problem }

const fail = (detail: string) => ({ result: 'fail' as const, detail })
const warn = (detail: string) => ({ result: 'warn' as const, detail })

/** Lower case, no accents, single spaces: what two texts are compared on. */
function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function markdownImageUrls(markdown: string): string[] {
  return [...markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)].map((match) => match[1]!)
}

export function checkKeyPresent(question: Pick<CheckQuestion, 'answerCorrectOption' | 'options'>) {
  const key = question.answerCorrectOption
  if (key == null) return check('key_present', fail('La pregunta no tiene clave.'))
  if (!question.options.some((option) => option.label === key)) {
    return check('key_present', fail(`La clave ${key} no es una de las opciones.`))
  }
  return check('key_present', null)
}

/** The printed key, read again from the booklet, against what the row holds. */
export function checkPrintedKey(question: Pick<CheckQuestion, 'answerCorrectOption'>, printedKey: string | undefined) {
  if (printedKey == null || printedKey === question.answerCorrectOption) return check('printed_key', null)
  return check('printed_key', fail(`El cuadernillo imprime ${printedKey}; la fila guarda ${question.answerCorrectOption ?? 'nada'}.`))
}

/** A-C (Inglés), A-D, and A-H (matching items) are the only shapes the exam has. */
export function checkOptionCount(options: Option[]) {
  const labels = options.map((option) => option.label).join('')
  if (![3, 4, 8].includes(options.length) || !'ABCDEFGH'.startsWith(labels)) {
    return check('option_count', fail(`Opciones inesperadas: ${labels || 'ninguna'}.`))
  }
  return check('option_count', null)
}

export function checkOptionsFilled(options: Option[]) {
  const empty = options.filter((option) => option.bodyMarkdown.trim().length === 0).map((option) => option.label)
  return check('options_filled', empty.length === 0 ? null : fail(`Opciones vacías: ${empty.join(', ')}.`))
}

export function checkOptionsUnique(options: Option[]) {
  const seen = new Set<string>()
  const repeated = options.filter((option) => {
    const text = normalize(option.bodyMarkdown)
    if (text.length === 0) return false
    if (seen.has(text)) return true
    seen.add(text)
    return false
  })
  return check('options_unique', repeated.length === 0 ? null : fail(`Opciones repetidas: ${repeated.map((option) => option.label).join(', ')}.`))
}

export function checkMissingFigure(
  question: Pick<CheckQuestion, 'bodyMarkdown' | 'options' | 'renderedStemImageId'>,
  group: CheckGroup | null,
) {
  const text = `${group?.contextMarkdown ?? ''}\n${question.bodyMarkdown}`
  const hasImage =
    question.renderedStemImageId != null
    || group?.renderedContextImageId != null
    || (group?.contextImages?.length ?? 0) > 0
    || markdownImageUrls(text).length > 0
  return check('missing_figure', referencesArtwork(text) && !hasImage ? warn('Menciona una figura y no tiene imagen.') : null)
}

const FURNITURE = [
  /^\s*Saber 11\.?[º°]?(\s+\d{1,3})?\s*$/im,
  /www\.icfes\.gov\.co/i,
  /^\s*Cuadernillo de\b/im,
  /RESPONDA\s+(LAS?\s+)?PREGUNTAS?/i,
  /^\s*Pregunta\s+\d{1,3}\s*$/im,
]

export function checkPageFurniture(text: string) {
  return check('page_furniture', FURNITURE.some((pattern) => pattern.test(text)) ? warn('Hay texto de la página dentro del enunciado.') : null)
}

export function checkGroupRange(group: Pick<CheckGroup, 'firstNumber' | 'lastNumber' | 'memberCount'> | null) {
  if (group?.firstNumber == null || group.lastNumber == null || group.memberCount == null) return check('group_range', null)
  const expected = group.lastNumber - group.firstNumber + 1
  return check('group_range', expected === group.memberCount ? null : warn(`El grupo dice ${expected} preguntas y tiene ${group.memberCount}.`))
}

/** `unresolved` comes from the caller, the only one that can reach the network. */
export function checkUrlsResolve(urls: string[], unresolved: string[]) {
  const broken = urls.filter((url) => !/^https?:\/\//.test(url) || unresolved.includes(url))
  return check('urls_resolve', broken.length === 0 ? null : fail(`Imágenes que no cargan: ${broken.join(', ')}.`))
}

const MIN_CROP_BYTES = 1024

export function checkCrop(question: Pick<CheckQuestion, 'stemDisplay'>, crop: { size: number; contentType?: string } | null) {
  if (crop == null) return check('crop_sanity', question.stemDisplay === 'scan' ? fail('Se muestra como escaneo y no tiene recorte.') : null)
  if (crop.contentType != null && !crop.contentType.startsWith('image/')) return check('crop_sanity', warn(`El recorte no es una imagen (${crop.contentType}).`))
  return check('crop_sanity', crop.size < MIN_CROP_BYTES ? warn('El recorte está casi vacío.') : null)
}

/** Checks the structure only; KaTeX itself is not available to the backend. */
export function checkKatex(text: string) {
  const plain = text.replace(/\\\$/g, '')
  const segments = [...plain.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$]*)\$/g)].map((match) => match[1] ?? match[2] ?? '')
  if (plain.replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, '').includes('$')) return check('katex', warn('Hay un signo $ sin cerrar.'))
  for (const math of segments) {
    const body = math.replace(/\\[{}]/g, '')
    if ((body.match(/{/g) ?? []).length !== (body.match(/}/g) ?? []).length) return check('katex', warn('Llaves sin cerrar en una fórmula.'))
    if ((body.match(/\\begin\{/g) ?? []).length !== (body.match(/\\end\{/g) ?? []).length) return check('katex', warn('Un entorno de fórmula sin cerrar.'))
  }
  return check('katex', null)
}

/** Each repeated row, mapped to the earlier one it repeats. */
export function duplicateStemIndex(rows: Array<{ _id: string; bodyMarkdown: string; groupId?: string }>) {
  const firstByText = new Map<string, string>()
  const duplicates = new Map<string, string>()
  for (const row of rows) {
    const text = `${row.groupId ?? ''}|${normalize(row.bodyMarkdown)}`
    const first = firstByText.get(text)
    if (first == null) firstByText.set(text, row._id)
    else duplicates.set(row._id, first)
  }
  return duplicates
}

export function checkDuplicateStem(duplicateOf: string | undefined) {
  return check('duplicate_stem', duplicateOf == null ? null : warn(`Mismo enunciado que ${duplicateOf}.`))
}

export function checkTaxonomy(question: Pick<CheckQuestion, 'subjectId' | 'categoryId' | 'primarySubtopicId'>) {
  const context = question.primarySubtopicId == null ? undefined : getSubtopicContext(question.primarySubtopicId)
  const valid = context != null && context.subjectId === question.subjectId && context.categoryId === question.categoryId
  return check('taxonomy_valid', valid ? null : fail('La taxonomía no existe o no coincide entre sí.'))
}

export function runDeterministicChecks(input: {
  question: CheckQuestion
  group: CheckGroup | null
  printedKey?: string
  unresolvedUrls: string[]
  crop: { size: number; contentType?: string } | null
  duplicateOf?: string
}): AuditCheck[] {
  const { question, group } = input
  const text = [group?.contextMarkdown ?? '', question.bodyMarkdown, ...question.options.map((option) => option.bodyMarkdown)].join('\n')
  return [
    checkKeyPresent(question),
    checkPrintedKey(question, input.printedKey),
    checkOptionCount(question.options),
    checkOptionsFilled(question.options),
    checkOptionsUnique(question.options),
    checkMissingFigure(question, group),
    checkKatex(text),
    checkPageFurniture(question.bodyMarkdown),
    checkGroupRange(group),
    checkUrlsResolve([...markdownImageUrls(text), ...(group?.contextImages ?? [])], input.unresolvedUrls),
    checkCrop(question, input.crop),
    checkDuplicateStem(input.duplicateOf),
    checkTaxonomy(question),
  ]
}

function shingles(text: string, size: number) {
  const words = normalize(text).replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  if (words.length < size) return new Set(words.length === 0 ? [] : [words.join(' ')])
  return new Set(words.slice(0, words.length - size + 1).map((_, index) => words.slice(index, index + size).join(' ')))
}

/** How much of `text`'s shingles appear in `other`: 1 means all of it. */
function containment(text: Set<string>, other: Set<string>) {
  if (text.size === 0) return 0
  return [...text].filter((shingle) => other.has(shingle)).length / text.size
}

const MIN_PAGE_MATCH = 0.5

/** Which OCR page a question came from, by approximate text. */
export function matchOcrPage(stem: string, pages: Array<{ pageNumber: number; markdown: string }>): number | null {
  const wanted = shingles(stem, 3)
  let best: { pageNumber: number; score: number } | null = null
  for (const page of pages) {
    const score = containment(wanted, shingles(page.markdown, 3))
    if (best == null || score > best.score) best = { pageNumber: page.pageNumber, score }
  }
  return best != null && best.score >= MIN_PAGE_MATCH ? best.pageNumber : null
}

const SIMILARITY_LIMIT = 0.3

/**
 * Stops an authored item that keeps long runs of an ICFES one (F66). Runs on the
 * finished text, after generation: the generator itself never sees the corpus.
 */
export function similarityGate(candidate: string, corpus: Array<{ id: string; text: string }>) {
  const own = shingles(candidate, 5)
  let top = { score: 0, matchId: undefined as string | undefined }
  for (const row of corpus) {
    const score = containment(own, shingles(row.text, 5))
    if (score > top.score) top = { score, matchId: row.id }
  }
  return { ok: top.score < SIMILARITY_LIMIT, ...top }
}

type GuideStep = { prompt: string; choices: Array<{ text: string; correct?: boolean }> }
export type GuideForCheck = {
  hint: string
  byOption: Record<string, { diagnose: GuideStep; steps: GuideStep[] }>
  reveal: string
}

const MAX_STEP_WORDS = 20
const MAX_STEPS = 3
const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

/** Names the option by its letter. A bare capital is not one: "vitamina C". */
function namesLabel(text: string, label: string) {
  return new RegExp(`(?:\\b|^)(?:[Ll]a|[Oo]pci[oó]n|[Ll]etra|[Aa]lternativa|[Rr]espuesta(?:\\s+es)?)\\s+${label}\\b`).test(text)
}

/** Key texts shorter than this ("5", "No") appear everywhere and prove nothing. */
const MIN_LEAK_CHARS = 3

function containsText(text: string, keyText: string) {
  const escaped = normalize(keyText).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'u').test(normalize(text))
}

/**
 * What a guide must satisfy before a person reads it (F56): a path for every
 * wrong option, and nothing that hands over the answer before the path ends.
 * Returns the problems; empty means it passes. `reveal` is exempt: it is what
 * the path ends in.
 */
export function validateGuide(
  question: { options: Option[]; answerCorrectOption?: string },
  guide: GuideForCheck,
): string[] {
  const key = question.answerCorrectOption
  const keyText = question.options.find((option) => option.label === key)?.bodyMarkdown ?? ''
  const wrongLabels = question.options.map((option) => option.label).filter((label) => label !== key)
  const leakable = keyText.length >= MIN_LEAK_CHARS && !keyText.includes('![')
  const problems: string[] = []

  const screen = (place: string, text: string) => {
    if (key != null && namesLabel(text, key)) problems.push(`${place} nombra la clave ${key}.`)
    if (leakable && containsText(text, keyText)) problems.push(`${place} contiene el texto de la clave.`)
  }

  screen('La pista', guide.hint)
  if (key != null && guide.byOption[key] != null) problems.push(`La clave ${key} no debe tener camino.`)
  for (const label of wrongLabels) {
    const path = guide.byOption[label]
    if (path == null) {
      problems.push(`Falta el camino de la opción ${label}.`)
      continue
    }
    if (path.diagnose.choices.some((choice) => choice.correct != null)) problems.push(`El diagnóstico de ${label} no debe tener respuesta correcta.`)
    screen(`El diagnóstico de ${label}`, path.diagnose.prompt)
    for (const choice of path.diagnose.choices) screen(`El diagnóstico de ${label}`, choice.text)
    if (path.steps.length === 0 || path.steps.length > MAX_STEPS) problems.push(`${label} debe tener de 1 a ${MAX_STEPS} pasos.`)
    for (const step of path.steps) {
      if (wordCount(step.prompt) > MAX_STEP_WORDS) problems.push(`Un paso de ${label} supera ${MAX_STEP_WORDS} palabras.`)
      if ((step.prompt.match(/\?/g) ?? []).length !== 1) problems.push(`Un paso de ${label} debe tener una sola pregunta.`)
      if (step.choices.filter((choice) => choice.correct === true).length !== 1) problems.push(`Un paso de ${label} debe tener una sola opción correcta.`)
      screen(`Un paso de ${label}`, step.prompt)
      for (const choice of step.choices) screen(`Un paso de ${label}`, choice.text)
    }
  }
  return problems
}
