/**
 * Load the ICFES practice booklets into Convex — no OCR, no model, no API key.
 *
 *   bun run packages/ingest/src/load-icfes-booklets.ts [--dry]
 *
 * Re-running is safe: each booklet's questions and groups are cleared before
 * they are re-inserted.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseBooklet, usableQuestions } from './icfes-booklet'
import { CONFIDENT_AT, guessSubtopic } from './icfes-subtopic-guess'

// `import.meta.dirname` is the portable spelling; `import.meta.dir` is Bun-only
// and is not in the type surface this package compiles against.
const REPO = resolve(import.meta.dirname, '../../..')
const CONVEX_DIR = resolve(REPO, 'packages/convex')

/** Inglés is absent on purpose: its booklet uses a different item format. */
const BOOKLETS: Array<{ file: string; subjectId: string; label: string }> = [
  { file: '02_practica_lectura', subjectId: 'lectura_critica', label: 'Lectura Crítica' },
  { file: '04_practica_matematicas', subjectId: 'matematicas', label: 'Matemáticas' },
  { file: '06_practica_sociales', subjectId: 'sociales_ciudadanas', label: 'Sociales y Ciudadanas' },
  { file: '08_practica_ciencias', subjectId: 'ciencias_naturales', label: 'Ciencias Naturales' },
]

const dryRun = process.argv.includes('--dry')

function convexRun(fn: string, payload: unknown): unknown {
  const out = execFileSync(
    'bunx',
    ['convex', 'run', fn, JSON.stringify(payload)],
    { cwd: CONVEX_DIR, encoding: 'utf8', maxBuffer: 40e6 },
  )
  // `convex run` prints the return value as JSON on its own — a bare quoted
  // string for an id, an object for a record. Progress chatter can precede it,
  // so parse from the last line that is valid JSON.
  const lines = out.trim().split('\n')
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim()
    if (line == null || line.length === 0) continue
    try {
      return JSON.parse(line)
    } catch {
      continue
    }
  }
  return null
}

let grandTotal = 0
let grandConfident = 0

for (const booklet of BOOKLETS) {
  const pdf = resolve(REPO, 'content/icfes', `${booklet.file}.pdf`)
  if (!existsSync(pdf)) {
    console.log(`⚠  falta ${pdf} — corre: bash content/fetch.sh`)
    continue
  }

  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], {
    encoding: 'utf8',
    maxBuffer: 40e6,
  })
  const parsed = parseBooklet(text)
  const usable = usableQuestions(parsed)

  const questions = usable.map((question) => {
    const guess = guessSubtopic(
      booklet.subjectId,
      `${question.contextMarkdown ?? ''}\n${question.stem}`,
    )!
    return {
      number: question.number,
      stem: question.stem,
      contextMarkdown: question.contextMarkdown,
      contextKey: question.contextKey,
      options: question.options.map((option) => ({
        label: option.label,
        bodyMarkdown: option.text,
      })),
      correctOption: question.correctOption!,
      categoryId: guess.categoryId,
      subtopicId: guess.subtopicId,
      tagConfidence: guess.confidence,
      confidentTag: guess.confidence >= CONFIDENT_AT,
    }
  })

  const confident = questions.filter((question) => question.confidentTag).length
  const groups = new Set(questions.map((q) => q.contextKey).filter(Boolean)).size
  grandTotal += questions.length
  grandConfident += confident

  console.log(
    `${booklet.label.padEnd(22)} ${String(questions.length).padStart(3)} preguntas`
    + `  ·  ${String(confident).padStart(3)} con etiqueta confiable`
    + `  ·  ${String(groups).padStart(2)} estímulos`
    + `  ·  ${parsed.length - usable.length} descartadas`,
  )

  if (dryRun || questions.length === 0) continue

  const slug = `icfes-${booklet.file}`
  const pdfUploadId = convexRun('booklets:prepareBookletUpload', {
    slug,
    fileName: `ICFES · ${booklet.label} (práctica)`,
  })
  if (typeof pdfUploadId !== 'string') {
    console.log(`   ✗ no se pudo preparar el registro: ${JSON.stringify(pdfUploadId)}`)
    continue
  }

  convexRun('booklets:clearBooklet', { pdfUploadId })
  // Convex caps a single function argument payload, so a long booklet goes up
  // in slices rather than as one 200-question blob.
  for (let start = 0; start < questions.length; start += 20) {
    convexRun('booklets:insertBookletQuestions', {
      pdfUploadId,
      subjectId: booklet.subjectId,
      questions: questions.slice(start, start + 20),
    })
  }
  console.log('   ✓ cargado')
}

console.log(
  `\nTOTAL ${grandTotal} preguntas · ${grandConfident} elegibles para nivelación`
  + `${dryRun ? '  (simulación, no se escribió nada)' : ''}`,
)
