import path from 'node:path'
import * as FileSystem from '@effect/platform/FileSystem'
import { Config, Console, Data, Effect } from 'effect'
import {
  extractQuestionsFromMarkdown as coreExtractQuestionsFromMarkdown,
  joinPagesMarkdown,
} from './question-extraction-core'
import type { QuestionExtraction } from './question-schema'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export interface ExtractorPaths {
  pagesDir: string
  artifactRoot: string
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class QuestionExtractorError extends Data.TaggedError(
  'QuestionExtractorError',
)<{
  code: 'EXTRACTION_FAILED' | 'OUTPUT_WRITE_FAILED' | 'PAGES_NOT_FOUND'
  message: string
  details?: Record<string, unknown>
}> {}

function fail(
  code: QuestionExtractorError['code'],
  message: string,
  details?: Record<string, unknown>,
) {
  return new QuestionExtractorError({ code, message, details })
}

function fileSystemCause(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

// ---------------------------------------------------------------------------
// Prompt + model call
// ---------------------------------------------------------------------------

// The system prompt, `buildPrompt` and the Gemini call used to be duplicated
// here byte-for-byte from `question-extraction-core.ts` (which Convex uses),
// so any change to the extraction rules — the grouped-question fix included —
// only landed on one of the two paths. There is now a single definition and
// this CLI re-exports it.
export { joinPagesMarkdown }

// ---------------------------------------------------------------------------
// Read page markdown files
// ---------------------------------------------------------------------------

function readPageMarkdownFiles(pagesDir: string) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const entries = yield* fs.readDirectory(pagesDir).pipe(
      Effect.mapError((error) =>
        fail('PAGES_NOT_FOUND', 'Could not read pages directory.', {
          pagesDir,
          cause: fileSystemCause(error),
        }),
      ),
    )

    const markdownFiles = entries.filter((f) => f.endsWith('.md')).sort()

    if (markdownFiles.length === 0) {
      return yield* Effect.fail(
        fail('PAGES_NOT_FOUND', 'No markdown page files found.', { pagesDir }),
      )
    }

    const pages: string[] = []
    for (const file of markdownFiles) {
      const content = yield* fs
        .readFileString(path.join(pagesDir, file))
        .pipe(
          Effect.mapError((error) =>
            fail('PAGES_NOT_FOUND', `Failed to read page file: ${file}`, {
              file,
              cause: fileSystemCause(error),
            }),
          ),
        )
      pages.push(content)
    }

    return joinPagesMarkdown(pages)
  })
}

// ---------------------------------------------------------------------------
// Call Gemini
// ---------------------------------------------------------------------------

function extractQuestions(args: { apiKey: string; pagesMarkdown: string }) {
  return Effect.tryPromise({
    try: () => coreExtractQuestionsFromMarkdown(args),
    catch: (error) =>
      fail('EXTRACTION_FAILED', 'Gemini extraction request failed.', {
        cause: error instanceof Error ? error.message : String(error),
      }),
  })
}

export async function extractQuestionsFromMarkdown(args: {
  apiKey: string
  pagesMarkdown: string
}): Promise<QuestionExtraction[]> {
  return Effect.runPromise(extractQuestions(args))
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

function writeQuestions(args: {
  questions: QuestionExtraction[]
  outputPath: string
}) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const json = JSON.stringify(args.questions, null, 2)

    yield* fs.writeFileString(args.outputPath, `${json}\n`).pipe(
      Effect.mapError((error) =>
        fail('OUTPUT_WRITE_FAILED', 'Failed to write questions JSON.', {
          outputPath: args.outputPath,
          cause: fileSystemCause(error),
        }),
      ),
    )
  })
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export function runQuestionExtractor(paths: ExtractorPaths) {
  return Effect.gen(function* () {
    const apiKey = yield* Config.string('GEMINI_API_KEY')

    yield* Console.log('  Reading page markdown files...')
    const pagesMarkdown = yield* readPageMarkdownFiles(paths.pagesDir)

    yield* Console.log('  Extracting questions with Gemini...')
    const questions = yield* extractQuestions({ apiKey, pagesMarkdown })

    const outputPath = path.join(paths.artifactRoot, 'questions.json')
    yield* Console.log(
      `  Extraction complete: ${questions.length} questions → ${outputPath}`,
    )
    yield* writeQuestions({ questions, outputPath })

    return { questionCount: questions.length }
  })
}
