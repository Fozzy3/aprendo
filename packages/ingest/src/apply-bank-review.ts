/**
 * Apply the bank review to the deployment `bunx convex run` points at: dev, by default.
 *
 *   bun run packages/ingest/src/apply-bank-review.ts [content/revision-banco/2026-11-09.json]
 *
 * The decision file and its crops live under content/ (gitignored: ICFES text).
 * Crops are uploaded once and remembered in <file>.storage.json. Questions go
 * booklet by booklet to `audit:applyPageReview`, keyed by slug and number, so the
 * same file serves another deployment; seed corrections to `audit:applySeedReview`.
 *
 * A file with `uploads` is an extension of the bank: each new question goes in
 * first through `booklets:upsertBookletQuestions` in add-only mode, so rows already
 * there stay byte for byte and a second run inserts nothing.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const REPO = resolve(import.meta.dirname, '../../..')
const CONVEX_DIR = resolve(REPO, 'packages/convex')
const DECISIONS = resolve(REPO, process.argv[2] ?? 'content/revision-banco/2026-11-09.json')
const STORAGE = `${DECISIONS}.storage.json`
/** One argv string is capped near 128 KB on Linux, which large passages can reach. */
const MAX_PAYLOAD = 100_000

type Decision = {
  slug: string
  number: number
  stemCropFile?: string
  group?: { key: string; contextMarkdown?: string; cropFile?: string; firstNumber: number; lastNumber: number; memberCount: number; position: number }
} & Record<string, unknown>

function convexRun(fn: string, payload: unknown): unknown {
  const out = execFileSync('bunx', ['convex', 'run', fn, JSON.stringify(payload)], {
    cwd: CONVEX_DIR,
    encoding: 'utf8',
    maxBuffer: 60e6,
  }).trim()
  const start = out.search(/[[{"]/)
  return start === -1 ? null : JSON.parse(out.slice(start))
}

/** Crops already uploaded survive a re-run, so a failed batch costs nothing. */
async function uploadCrops(files: string[], cropsDir: string): Promise<Map<string, string>> {
  const stored = new Map<string, string>(
    existsSync(STORAGE) ? Object.entries(JSON.parse(readFileSync(STORAGE, 'utf8')) as Record<string, string>) : [],
  )
  const pending = files.filter((file) => !stored.has(file))
  for (let start = 0; start < pending.length; start += 20) {
    const batch = pending.slice(start, start + 20)
    const urls = convexRun('booklets:generateCropUploadUrls', { count: batch.length }) as string[]
    await Promise.all(batch.map(async (file, index) => {
      const response = await fetch(urls[index]!, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: readFileSync(resolve(cropsDir, file)) })
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)
      stored.set(file, ((await response.json()) as { storageId: string }).storageId)
    }))
    writeFileSync(STORAGE, JSON.stringify(Object.fromEntries(stored), null, 1))
  }
  console.log(`crops: ${files.length} (${pending.length} subidos ahora)`)
  return stored
}

/** Splits one booklet by size. Members of a passage stay together: they record the same context change. */
function batches(questions: Decision[]) {
  const passages = new Map<string, Decision[]>()
  for (const question of questions) {
    const key = question.group?.key ?? `q${question.number}`
    passages.set(key, [...(passages.get(key) ?? []), question])
  }
  const out: Decision[][] = [[]]
  for (const members of passages.values()) {
    const current = out.at(-1)!
    if (current.length > 0 && JSON.stringify([...current, ...members]).length > MAX_PAYLOAD) out.push([...members])
    else current.push(...members)
  }
  return out
}

function forMutation(question: Decision, storage: Map<string, string>) {
  const { slug: _slug, devQuestionId: _id, verdict: _verdict, reviewFile: _file, problems: _problems, note: _note, stemCropFile, group, ...rest } = question
  const { cropFile, ...groupFields } = group ?? { cropFile: undefined }
  return {
    ...rest,
    ...(stemCropFile == null ? {} : { stemImageId: storage.get(stemCropFile) }),
    ...(group == null ? {} : { group: { ...groupFields, ...(cropFile == null ? {} : { contextImageId: storage.get(cropFile) }) } }),
  }
}

type NewUpload = { slug: string; fileName: string | null; subjectId: string; questions: Array<{ number: number } & Record<string, unknown>> }
const file = JSON.parse(readFileSync(DECISIONS, 'utf8')) as { cropsDir: string; crops: Array<{ file: string }>; uploads?: NewUpload[]; questions: Decision[]; seed: unknown[] }
const storage = await uploadCrops(file.crops.map((crop) => crop.file), resolve(REPO, file.cropsDir))

/** Twenty questions per call, fewer when their passages are long. */
function uploadSlices(questions: NewUpload['questions']) {
  const out: NewUpload['questions'][] = [[]]
  for (const question of questions) {
    const current = out.at(-1)!
    if (current.length >= 20 || (current.length > 0 && JSON.stringify([...current, question]).length > MAX_PAYLOAD)) out.push([question])
    else current.push(question)
  }
  return out
}

let inserted = 0
for (const upload of file.uploads ?? []) {
  const pdfUploadId = upload.fileName == null
    ? convexRun('booklets:findBooklet', { slug: upload.slug })
    : convexRun('booklets:prepareBookletUpload', { slug: upload.slug, fileName: upload.fileName })
  if (typeof pdfUploadId !== 'string') throw new Error(`${upload.slug}: no upload row`)
  for (const questions of uploadSlices(upload.questions)) {
    const result = convexRun('booklets:upsertBookletQuestions', { pdfUploadId, subjectId: upload.subjectId, addOnly: true, questions }) as { inserted: number }
    inserted += result.inserted
  }
  console.log(`${upload.slug.slice(0, 44).padEnd(46)} preguntas ${upload.questions.length}`)
}
console.log(`nuevas insertadas: ${inserted}`)

const missing: string[] = []
let applied = 0
for (const slug of new Set(file.questions.map((question) => question.slug))) {
  for (const batch of batches(file.questions.filter((question) => question.slug === slug))) {
    const result = convexRun('audit:applyPageReview', { slug, questions: batch.map((question) => forMutation(question, storage)) }) as { applied: number; missing: number[] }
    applied += result.applied
    missing.push(...result.missing.map((number) => `${slug}#${number}`))
    console.log(`${slug.slice(6, 40).padEnd(36)} aplicadas ${String(result.applied).padStart(3)}`)
  }
}

let seedApplied = 0
for (let start = 0; start < file.seed.length; start += 20) {
  const result = convexRun('audit:applySeedReview', { items: file.seed.slice(start, start + 20).map((item) => {
    const { paths: _paths, ...rest } = item as { paths: unknown } & Record<string, unknown>
    return rest
  }) }) as { applied: number; missing: string[] }
  seedApplied += result.applied
  missing.push(...result.missing)
}

console.log(`\nTOTAL preguntas ${applied} · semillas ${seedApplied} · sin fila: ${missing.length === 0 ? 'ninguna' : missing.join(', ')} (${dirname(DECISIONS)})`)
