/**
 * Load the ICFES practice booklets into Convex — no OCR, no model, no API key.
 *
 *   bun run packages/ingest/src/load-icfes-booklets.ts [--dry]
 *
 * Re-running is safe: questions are matched by booklet and number and groups by
 * their context key, so a reload updates rows in place and keeps their ids, and
 * with them every student's attempts and history. What a booklet no longer has
 * is retired (kept, but out of every pool), and only after all of it loaded.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { groupSlots, parseBooklet, usableQuestions } from './icfes-booklet'
import { CONFIDENT_AT, guessSubtopic } from './icfes-subtopic-guess'

// `import.meta.dirname` is the portable spelling; `import.meta.dir` is Bun-only
// and is not in the type surface this package compiles against.
const REPO = resolve(import.meta.dirname, '../../..')
const CONVEX_DIR = resolve(REPO, 'packages/convex')

/**
 * Every booklet whose questions this parser can read.
 *
 * Inglés is absent on purpose, and not only because its item formats differ:
 * its reading passages are images, so even a parser for those formats would
 * produce questions no one could answer.
 */
const BOOKLETS: Array<{ file: string; subjectId: string; label: string }> = [
  // Práctica booklets: answer key as a two-column table at the end.
  { file: '02_practica_lectura', subjectId: 'lectura_critica', label: 'Lectura Crítica · práctica' },
  { file: '04_practica_matematicas', subjectId: 'matematicas', label: 'Matemáticas · práctica' },
  { file: '06_practica_sociales', subjectId: 'sociales_ciudadanas', label: 'Sociales · práctica' },
  { file: '08_practica_ciencias', subjectId: 'ciencias_naturales', label: 'Ciencias Naturales · práctica' },

  // Official exam booklets. Same question layout, but the key is a
  // three-column table listing the competency assessed for each item.
  {
    file: '16-feb-cuadernillo-de-preguntas-lectura-critica-saber-11-2026',
    subjectId: 'lectura_critica',
    label: 'Lectura Crítica · examen 2026',
  },
  {
    file: '09-marzo_cuadernillo-de-preguntas-matematicas-saber-11-2026',
    subjectId: 'matematicas',
    label: 'Matemáticas · examen 2026',
  },
  {
    file: '24-feb-cuadernillo-preguntas-ciencias-naturales-saber-11-2026',
    subjectId: 'ciencias_naturales',
    label: 'Ciencias Naturales · examen 2026',
  },
  {
    file: '22-diciembre-cuadernillo-de-preguntas-ciencias-naturales-saber-11-2025',
    subjectId: 'ciencias_naturales',
    label: 'Ciencias Naturales · examen 2025',
  },
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
  const slots = groupSlots(usable)

  const questions = usable.map((question, index) => {
    const guess = guessSubtopic(
      booklet.subjectId,
      `${question.contextMarkdown ?? ''}\n${question.stem}`,
    )!
    const slot = slots[index]
    return {
      number: question.number,
      stem: question.stem,
      group:
        slot == null || question.contextMarkdown == null
          ? undefined
          : { ...slot, contextMarkdown: question.contextMarkdown },
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
  const contextKeys = [...new Set(questions.flatMap((q) => (q.group == null ? [] : [q.group.key])))]
  grandTotal += questions.length
  grandConfident += confident

  console.log(
    `${booklet.label.padEnd(22)} ${String(questions.length).padStart(3)} preguntas`
    + `  ·  ${String(confident).padStart(3)} con etiqueta confiable`
    + `  ·  ${String(contextKeys.length).padStart(2)} estímulos`
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

  // Convex caps a single function argument payload, so a long booklet goes up
  // in slices rather than as one 200-question blob. A failed slice throws and
  // stops the run before `finishBookletLoad`, so nothing is pruned on a partial load.
  for (let start = 0; start < questions.length; start += 20) {
    convexRun('booklets:upsertBookletQuestions', {
      pdfUploadId,
      subjectId: booklet.subjectId,
      questions: questions.slice(start, start + 20),
    })
  }
  const finished = convexRun('booklets:finishBookletLoad', {
    pdfUploadId,
    questionNumbers: questions.map((question) => question.number),
    contextKeys,
  }) as { retiredQuestions?: number } | null
  console.log(`   ✓ cargado  ·  ${finished?.retiredQuestions ?? 0} retiradas`)
}

console.log(
  `\nTOTAL ${grandTotal} preguntas · ${grandConfident} elegibles para nivelación`
  + `${dryRun ? '  (simulación, no se escribió nada)' : ''}`,
)
