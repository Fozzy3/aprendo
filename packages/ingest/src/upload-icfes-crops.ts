/**
 * Upload the rendered question crops and attach them to their rows.
 *
 *   python3 packages/ingest/src/icfes-crop-questions.py <pdf> content/crops
 *   bun run packages/ingest/src/upload-icfes-crops.ts
 *
 * Run after `load-icfes-booklets.ts`: the crops are matched to questions by
 * number within an upload, so the rows have to exist first.
 *
 * Files go through Convex's upload URLs rather than as base64 in a function
 * argument — 418 PNGs at ~75 KB each is binary that has no business being
 * encoded into JSON.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../../..')
const CONVEX_DIR = resolve(REPO, 'packages/convex')
const CROPS = resolve(REPO, 'content/crops')

/** Same list, and the same slugs, as the loader. */
const BOOKLETS = [
  '02_practica_lectura',
  '04_practica_matematicas',
  '06_practica_sociales',
  '08_practica_ciencias',
  '16-feb-cuadernillo-de-preguntas-lectura-critica-saber-11-2026',
  '09-marzo_cuadernillo-de-preguntas-matematicas-saber-11-2026',
  '24-feb-cuadernillo-preguntas-ciencias-naturales-saber-11-2026',
  '22-diciembre-cuadernillo-de-preguntas-ciencias-naturales-saber-11-2025',
]

function convexRun(fn: string, payload: unknown): unknown {
  let out: string
  try {
    out = execFileSync('bunx', ['convex', 'run', fn, JSON.stringify(payload)], {
      cwd: CONVEX_DIR,
      encoding: 'utf8',
      maxBuffer: 60e6,
    })
  } catch (error) {
    // A silent catch here is how 418 uploads reported success and attached
    // nothing: the failure has to be visible or the run lies about its result.
    const detail = error instanceof Error ? error.message : String(error)
    console.log(`   ✗ ${fn}: ${detail.split('\n')[0]}`)
    return null
  }
  // Parse the whole payload, not one line at a time.
  //
  // The CLI pretty-prints anything that is not a scalar, so an array of URLs
  // arrives across many lines and a line-by-line scan finds nothing valid — it
  // silently returned null and every upload failed with "URL is invalid".
  const trimmed = out.trim()
  const start = trimmed.search(/[[{"]/)
  if (start === -1) return null
  try {
    return JSON.parse(trimmed.slice(start))
  } catch {
    // Warnings can follow the value; fall back to the longest parsable prefix.
    for (let end = trimmed.length; end > start; end -= 1) {
      try {
        return JSON.parse(trimmed.slice(start, end))
      } catch {
        continue
      }
    }
    return null
  }
}

/** One call yields this many upload URLs; the files then go straight over HTTP. */
const BATCH = 20

async function storeBatch(names: string[]): Promise<Map<string, string>> {
  const urls = convexRun('booklets:generateCropUploadUrls', { count: names.length }) as
    | string[]
    | null
  if (urls == null || urls.length < names.length) {
    console.log(`   ✗ no se obtuvieron URLs para ${names.length} archivos`)
    return new Map()
  }

  const stored = new Map<string, string>()
  await Promise.all(
    names.map(async (name, index) => {
      try {
        const response = await fetch(urls[index]!, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: readFileSync(resolve(CROPS, name)),
        })
        if (!response.ok) {
          console.log(`   ✗ ${name}: HTTP ${response.status}`)
          return
        }
        const body = (await response.json()) as { storageId?: string }
        if (body.storageId != null) stored.set(name, body.storageId)
      } catch (error) {
        console.log(`   ✗ ${name}: ${error instanceof Error ? error.message : error}`)
      }
    }),
  )
  return stored
}

if (!existsSync(CROPS)) {
  console.log(`No existe ${CROPS}. Corre primero icfes-crop-questions.py.`)
  process.exit(1)
}

const files = readdirSync(CROPS).filter((f) => f.endsWith('.png'))
let uploaded = 0
let failed = 0

for (const stem of BOOKLETS) {
  const mine = files.filter((f) => f.startsWith(`${stem}-`))
  if (mine.length === 0) continue

  const pdfUploadId = convexRun('booklets:findBooklet', { slug: `icfes-${stem}` })
  if (typeof pdfUploadId !== 'string') {
    console.log(`⚠  ${stem}: no está cargado todavía; sáltalo o corre el loader primero`)
    continue
  }

  const questions: Array<{ number: number; storageId: string }> = []
  const groups: Array<{ first: number; last: number; storageId: string }> = []
  const sorted = mine.sort()

  for (let start = 0; start < sorted.length; start += BATCH) {
    const batch = sorted.slice(start, start + BATCH)
    const ids = await storeBatch(batch)

    for (const name of batch) {
      const storageId = ids.get(name)
      if (storageId == null) {
        failed += 1
        continue
      }
      uploaded += 1

      const question = name.match(/-q(\d{3})\.png$/)
      const group = name.match(/-g(\d{3})-(\d{3})\.png$/)
      if (question != null) {
        questions.push({ number: Number(question[1]), storageId })
      } else if (group != null) {
        groups.push({ first: Number(group[1]), last: Number(group[2]), storageId })
      }
    }
  }

  const result = convexRun('booklets:attachCrops', { pdfUploadId, questions, groups }) as {
    attached?: number
    attachedGroups?: number
    skipped?: number
  } | null

  console.log(
    `${stem.slice(0, 48).padEnd(50)} subidas ${String(questions.length + groups.length).padStart(3)}/${mine.length}`
    + `  ·  adjuntas ${String(result?.attached ?? 0).padStart(3)}`
    + `  ·  grupos ${String(result?.attachedGroups ?? 0).padStart(2)}`
    + `  ·  sin fila ${result?.skipped ?? 0}`,
  )
}

console.log(`\nTOTAL subidas ${uploaded}${failed > 0 ? ` · fallidas ${failed}` : ''}`)
