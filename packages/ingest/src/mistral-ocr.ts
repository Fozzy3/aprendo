import path from 'node:path'
import * as FileSystem from '@effect/platform/FileSystem'
import { Mistral } from '@mistralai/mistralai'
import { Config, Console, Data, Effect } from 'effect'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export interface OcrPaths {
  pdfPath: string
  artifactRoot: string
  assetsDir: string
  pagesDir: string
}

export interface OcrImageAsset {
  pageNumber: number
  imageIndex: number
  fileName: string
  contentType: string
  sourcePath: string
  blob: Blob
}

export interface OcrPage {
  pageNumber: number
  markdown: string
  assets: OcrImageAsset[]
}

export interface OcrResult {
  pageCount: number
  pages: OcrPage[]
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class OcrError extends Data.TaggedError('OcrError')<{
  code:
    | 'ARTIFACT_SETUP_FAILED'
    | 'ASSET_WRITE_FAILED'
    | 'MARKDOWN_WRITE_FAILED'
    | 'OCR_REQUEST_FAILED'
    | 'PDF_NOT_FOUND'
    | 'PDF_READ_FAILED'
  message: string
  details?: Record<string, unknown>
}> {}

function fail(
  code: OcrError['code'],
  message: string,
  details?: Record<string, unknown>,
) {
  return new OcrError({ code, message, details })
}

function fileSystemCause(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeBase64Payload(base64Payload: string) {
  const dataUrlMatch = base64Payload.match(/^data:.*;base64,(.+)$/)
  return Buffer.from(dataUrlMatch?.[1] ?? base64Payload, 'base64')
}

function detectImageExtension(imageBuffer: Buffer) {
  if (
    imageBuffer.length >= 8 &&
    imageBuffer[0] === 0x89 &&
    imageBuffer[1] === 0x50 &&
    imageBuffer[2] === 0x4e &&
    imageBuffer[3] === 0x47
  ) {
    return 'png'
  }

  if (
    imageBuffer.length >= 2 &&
    imageBuffer[0] === 0xff &&
    imageBuffer[1] === 0xd8
  ) {
    return 'jpg'
  }

  if (
    imageBuffer.length >= 3 &&
    imageBuffer[0] === 0x47 &&
    imageBuffer[1] === 0x49 &&
    imageBuffer[2] === 0x46
  ) {
    return 'gif'
  }

  if (
    imageBuffer.length >= 12 &&
    imageBuffer.toString('ascii', 0, 4) === 'RIFF' &&
    imageBuffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }

  return 'bin'
}

function extensionToMimeType(extension: string) {
  switch (extension) {
    case 'png':
      return 'image/png'
    case 'jpg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

export function buildImageAssetFileName(
  pageNumber: number,
  imageIndex: number,
  extension: string,
) {
  return `page-${String(pageNumber).padStart(2, '0')}-image-${String(imageIndex + 1).padStart(2, '0')}.${extension}`
}

export function buildPageMarkdownFileName(pageNumber: number) {
  return `page-${String(pageNumber).padStart(2, '0')}.md`
}

// ---------------------------------------------------------------------------
// Load PDF
// ---------------------------------------------------------------------------

function loadPdfDocumentUrl(pdfPath: string) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    const fileBuffer = yield* fs.readFile(pdfPath).pipe(
      Effect.mapError((error) =>
        fail(
          error._tag === 'SystemError' && error.reason === 'NotFound'
            ? 'PDF_NOT_FOUND'
            : 'PDF_READ_FAILED',
          `Unable to read PDF: ${pdfPath}`,
          { pdfPath, cause: fileSystemCause(error) },
        ),
      ),
    )

    return `data:application/pdf;base64,${Buffer.from(fileBuffer).toString('base64')}`
  })
}

// ---------------------------------------------------------------------------
// Reset artifact directories
// ---------------------------------------------------------------------------

function resetArtifactDirectories(paths: OcrPaths) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem

    yield* fs.remove(paths.artifactRoot, { recursive: true }).pipe(
      Effect.catchTag('SystemError', (error) =>
        error.reason === 'NotFound' ? Effect.void : Effect.fail(error),
      ),
      Effect.mapError((error) =>
        fail(
          'ARTIFACT_SETUP_FAILED',
          'Failed to prepare OCR artifact directories.',
          { artifactRoot: paths.artifactRoot, cause: fileSystemCause(error) },
        ),
      ),
    )

    for (const dir of [paths.assetsDir, paths.pagesDir]) {
      yield* fs.makeDirectory(dir, { recursive: true }).pipe(
        Effect.mapError((error) =>
          fail(
            'ARTIFACT_SETUP_FAILED',
            'Failed to prepare OCR artifact directories.',
            { dir, cause: fileSystemCause(error) },
          ),
        ),
      )
    }
  })
}

// ---------------------------------------------------------------------------
// Call Mistral OCR
// ---------------------------------------------------------------------------

function requestOcr(args: { apiKey: string; documentUrl: string }) {
  return Effect.tryPromise({
    try: () =>
      new Mistral({ apiKey: args.apiKey }).ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          documentUrl: args.documentUrl,
        },
        includeImageBase64: true,
        tableFormat: 'markdown',
      }),
    catch: (error) =>
      fail('OCR_REQUEST_FAILED', 'Mistral OCR request failed.', {
        cause: error instanceof Error ? error.message : String(error),
      }),
  })
}

async function blobToDocumentUrl(blob: Blob) {
  const buffer = Buffer.from(await blob.arrayBuffer())
  const contentType = blob.type || 'application/pdf'
  return `data:${contentType};base64,${buffer.toString('base64')}`
}

export async function ocrPdfBlob(args: {
  apiKey: string
  pdfBlob: Blob
}): Promise<OcrResult> {
  const documentUrl = await blobToDocumentUrl(args.pdfBlob)
  const response = await Effect.runPromise(
    requestOcr({ apiKey: args.apiKey, documentUrl }),
  )

  const pages: OcrPage[] = response.pages.map((page) => {
    const pageNumber = page.index + 1
    const idToRelativePath = new Map<string, string>()
    const assets: OcrImageAsset[] = []

    for (const [index, image] of page.images.entries()) {
      if (image.imageBase64 == null) continue

      const imageBuffer = decodeBase64Payload(image.imageBase64)
      const extension = detectImageExtension(imageBuffer)
      const fileName = buildImageAssetFileName(pageNumber, index, extension)
      const sourcePath = `../assets/${fileName}`

      idToRelativePath.set(image.id, sourcePath)
      assets.push({
        pageNumber,
        imageIndex: index + 1,
        fileName,
        contentType: extensionToMimeType(extension),
        sourcePath,
        blob: new Blob([imageBuffer], {
          type: extensionToMimeType(extension),
        }),
      })
    }

    return {
      pageNumber,
      markdown: buildPageMarkdown({
        pageNumber,
        markdown: page.markdown,
        tables: (page.tables ?? []).map((table) => ({
          id: table.id,
          content: table.content,
        })),
        idToRelativePath,
      }),
      assets,
    }
  })

  return {
    pageCount: pages.length,
    pages,
  }
}

// ---------------------------------------------------------------------------
// Save images
// ---------------------------------------------------------------------------

function savePageImages(args: {
  pageNumber: number
  images: { id: string; imageBase64?: string | null }[]
  assetsDir: string
  pagesDir: string
}) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const idToRelativePath = new Map<string, string>()

    for (const [index, image] of args.images.entries()) {
      if (image.imageBase64 === null || image.imageBase64 === undefined) {
        continue
      }

      const imageBuffer = decodeBase64Payload(image.imageBase64)
      const extension = detectImageExtension(imageBuffer)
      const fileName = buildImageAssetFileName(
        args.pageNumber,
        index,
        extension,
      )
      const absolutePath = path.join(args.assetsDir, fileName)

      yield* fs.writeFile(absolutePath, imageBuffer).pipe(
        Effect.mapError((error) =>
          fail('ASSET_WRITE_FAILED', 'Failed to save image asset.', {
            fileName,
            cause: fileSystemCause(error),
          }),
        ),
      )

      const relativePath = path
        .relative(args.pagesDir, absolutePath)
        .split(path.sep)
        .join('/')

      idToRelativePath.set(image.id, relativePath)
    }

    return idToRelativePath
  })
}

// ---------------------------------------------------------------------------
// Rewrite image links + build page markdown
// ---------------------------------------------------------------------------

function rewriteImageLinks(
  markdown: string,
  idToRelativePath: Map<string, string>,
) {
  let result = markdown
  for (const [id, relativePath] of idToRelativePath) {
    result = result.replaceAll(`(${id})`, `(${relativePath})`)
  }
  return result
}

export function buildPageMarkdown(args: {
  pageNumber: number
  markdown: string
  tables: { id: string; content: string }[]
  idToRelativePath: Map<string, string>
}) {
  const rewritten = rewriteImageLinks(
    args.markdown.trim(),
    args.idToRelativePath,
  )

  const lines = [`# Page ${args.pageNumber}`, '', rewritten]

  if (args.tables.length > 0) {
    lines.push('', '## Tables', '')
    for (const table of args.tables) {
      lines.push(`<!-- ${table.id} -->`, '', table.content.trim(), '')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

// ---------------------------------------------------------------------------
// Main OCR pipeline
// ---------------------------------------------------------------------------

export function runOcr(paths: OcrPaths) {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const apiKey = yield* Config.string('MISTRAL_API_KEY')
    const documentUrl = yield* loadPdfDocumentUrl(paths.pdfPath)

    yield* resetArtifactDirectories(paths)

    const response = yield* requestOcr({ apiKey, documentUrl })

    for (const page of response.pages) {
      const pageNumber = page.index + 1

      const idToRelativePath = yield* savePageImages({
        pageNumber,
        images: page.images,
        assetsDir: paths.assetsDir,
        pagesDir: paths.pagesDir,
      })

      const markdown = buildPageMarkdown({
        pageNumber,
        markdown: page.markdown,
        tables: (page.tables ?? []).map((t) => ({
          id: t.id,
          content: t.content,
        })),
        idToRelativePath,
      })

      const markdownPath = path.join(
        paths.pagesDir,
        buildPageMarkdownFileName(pageNumber),
      )

      yield* fs.writeFileString(markdownPath, markdown).pipe(
        Effect.mapError((error) =>
          fail('MARKDOWN_WRITE_FAILED', 'Failed to write page markdown.', {
            markdownPath,
            cause: fileSystemCause(error),
          }),
        ),
      )
    }

    yield* Console.log(`  OCR complete: ${response.pages.length} pages`)

    return { pageCount: response.pages.length }
  })
}
