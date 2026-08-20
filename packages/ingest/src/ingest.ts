import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as FileSystem from '@effect/platform/FileSystem'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { Cause, Console, Data, Effect, Either, Option } from 'effect'
import { runOcr } from './mistral-ocr'
import type { OcrPaths } from './mistral-ocr'
import { runQuestionExtractor } from './question-extractor'
import type { ExtractorPaths } from './question-extractor'
import { slugify } from './slug'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONCURRENCY = 3

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function resolveProjectPaths() {
  const srcDir = path.dirname(fileURLToPath(import.meta.url))
  const packageRoot = path.resolve(srcDir, '..')
  const repoRoot = path.resolve(packageRoot, '../..')

  return {
    packageRoot,
    repoRoot,
    pdfsDir: path.join(repoRoot, 'data', 'pdfs'),
    artifactsRoot: path.join(packageRoot, '.artifacts', 'mistral-ocr'),
  }
}

interface PdfTarget {
  filename: string
  slug: string
  pdfPath: string
  ocrPaths: OcrPaths
  extractorPaths: ExtractorPaths
}

function buildPdfTarget(pdfsDir: string, artifactsRoot: string, filename: string): PdfTarget {
  const slug = slugify(filename)
  const artifactRoot = path.join(artifactsRoot, slug)
  const assetsDir = path.join(artifactRoot, 'assets')
  const pagesDir = path.join(artifactRoot, 'pages')

  return {
    filename,
    slug,
    pdfPath: path.join(pdfsDir, filename),
    ocrPaths: { pdfPath: path.join(pdfsDir, filename), artifactRoot, assetsDir, pagesDir },
    extractorPaths: { pagesDir, artifactRoot },
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class IngestError extends Data.TaggedError('IngestError')<{
  code: 'NO_PDFS_FOUND' | 'PDF_NOT_FOUND' | 'SCAN_FAILED'
  message: string
  details?: Record<string, unknown>
}> {}

function fail(
  code: IngestError['code'],
  message: string,
  details?: Record<string, unknown>,
) {
  return new IngestError({ code, message, details })
}

// ---------------------------------------------------------------------------
// Discover PDFs
// ---------------------------------------------------------------------------

function discoverPdfs(pdfsDir: string) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const entries = yield* fs.readDirectory(pdfsDir).pipe(
      Effect.mapError((error) =>
        fail('SCAN_FAILED', `Could not read PDFs directory: ${pdfsDir}`, {
          pdfsDir,
          cause: error instanceof Error ? error.message : String(error),
        }),
      ),
    )

    return entries.filter((f) => f.toLowerCase().endsWith('.pdf')).sort()
  })
}

// ---------------------------------------------------------------------------
// Check if OCR pages already exist
// ---------------------------------------------------------------------------

function hasOcrPages(pagesDir: string) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const exists = yield* fs.exists(pagesDir)
    if (!exists) return false

    const entries = yield* fs.readDirectory(pagesDir).pipe(
      Effect.catchAll(() => Effect.succeed([] as string[])),
    )

    return entries.some((f) => f.endsWith('.md'))
  })
}

// ---------------------------------------------------------------------------
// Process a single PDF (OCR → Extraction)
// ---------------------------------------------------------------------------

interface PdfResult {
  slug: string
  filename: string
  ocrSkipped: boolean
  pageCount: number | null
  questionCount: number
}

function processSinglePdf(target: PdfTarget) {
  return Effect.gen(function* () {
    yield* Console.log(`[${target.slug}] Processing ${target.filename}...`)

    // Stage 1: OCR (skip if pages already exist)
    const pagesExist = yield* hasOcrPages(target.ocrPaths.pagesDir)
    let ocrSkipped = false
    let pageCount: number | null = null

    if (pagesExist) {
      yield* Console.log(`[${target.slug}] OCR pages exist, skipping OCR`)
      ocrSkipped = true
    } else {
      yield* Console.log(`[${target.slug}] Running OCR...`)
      const ocrResult = yield* runOcr(target.ocrPaths)
      pageCount = ocrResult.pageCount
    }

    // Stage 2: Extraction (always runs)
    yield* Console.log(`[${target.slug}] Running question extraction...`)
    const extractResult = yield* runQuestionExtractor(target.extractorPaths)

    yield* Console.log(
      `[${target.slug}] Done — ${extractResult.questionCount} questions extracted`,
    )

    return {
      slug: target.slug,
      filename: target.filename,
      ocrSkipped,
      pageCount,
      questionCount: extractResult.questionCount,
    } satisfies PdfResult
  })
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

function runIngest(filterFilename?: string) {
  return Effect.gen(function* () {
    const { pdfsDir, artifactsRoot } = resolveProjectPaths()

    // Discover PDFs
    const allPdfs = yield* discoverPdfs(pdfsDir)

    if (allPdfs.length === 0) {
      return yield* Effect.fail(
        fail('NO_PDFS_FOUND', `No PDF files found in ${pdfsDir}`),
      )
    }

    // Filter to a specific PDF if requested
    const targetPdfs =
      filterFilename !== undefined
        ? allPdfs.filter((f) => f === filterFilename)
        : allPdfs

    if (targetPdfs.length === 0) {
      return yield* Effect.fail(
        fail('PDF_NOT_FOUND', `PDF not found: ${filterFilename}`, {
          pdfsDir,
          available: allPdfs,
        }),
      )
    }

    yield* Console.log(
      `Found ${targetPdfs.length} PDF(s) to process (concurrency: ${CONCURRENCY})`,
    )

    // Build targets
    const targets = targetPdfs.map((filename) =>
      buildPdfTarget(pdfsDir, artifactsRoot, filename),
    )

    // Process all PDFs with bounded concurrency.
    // Wrap each in Effect.either so one failure doesn't short-circuit the rest.
    const results = yield* Effect.forEach(
      targets,
      (target) =>
        Effect.either(
          processSinglePdf(target).pipe(
            Effect.mapError((error) => ({
              slug: target.slug,
              filename: target.filename,
              error,
            })),
          ),
        ),
      { concurrency: CONCURRENCY },
    )

    // Summarize
    const succeeded: PdfResult[] = []
    const failed: Array<{ slug: string; filename: string; error: unknown }> = []

    for (const result of results) {
      if (Either.isRight(result)) {
        succeeded.push(result.right)
      } else {
        failed.push(result.left)
      }
    }

    yield* Console.log('')
    yield* Console.log('=== Summary ===')
    yield* Console.log(`Succeeded: ${succeeded.length}`)

    for (const s of succeeded) {
      yield* Console.log(
        `  ${s.slug}: ${s.questionCount} questions${s.ocrSkipped ? ' (OCR skipped)' : ''}`,
      )
    }

    if (failed.length > 0) {
      yield* Console.log(`Failed: ${failed.length}`)

      for (const f of failed) {
        yield* Console.log(`  ${f.slug}: ${String(f.error)}`)
      }
    }

    return { succeeded, failed }
  })
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseCliArgs(): string | undefined {
  // bun run src/ingest.ts [optional-pdf-filename]
  // When run via "bun run ingest -- Foo.pdf", Bun puts Foo.pdf in process.argv
  const args = process.argv.slice(2)
  return args.length > 0 ? args[0] : undefined
}

async function runCli() {
  const filterFilename = parseCliArgs()

  await Effect.runPromise(
    runIngest(filterFilename).pipe(
      Effect.matchCauseEffect({
        onFailure: (cause) => {
          const failure = Cause.failureOption(cause)

          return Effect.sync(() => {
            if (
              Option.isSome(failure) &&
              failure.value instanceof IngestError
            ) {
              console.error(
                JSON.stringify(
                  {
                    status: 'error',
                    code: failure.value.code,
                    message: failure.value.message,
                    details: failure.value.details ?? null,
                  },
                  null,
                  2,
                ),
              )
            } else {
              console.error(cause)
            }

            process.exitCode = 1
          })
        },
        onSuccess: (result) =>
          Effect.sync(() => {
            if (result.failed.length > 0) {
              process.exitCode = 1
            }
          }),
      }),
      Effect.provide(NodeFileSystem.layer),
    ),
  )
}

if (import.meta.main) {
  void runCli()
}
