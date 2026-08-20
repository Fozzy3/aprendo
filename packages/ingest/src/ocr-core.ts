import { Mistral } from '@mistralai/mistralai'

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
  const response = await new Mistral({ apiKey: args.apiKey }).ocr.process({
    model: 'mistral-ocr-latest',
    document: {
      type: 'document_url',
      documentUrl,
    },
    includeImageBase64: true,
    tableFormat: 'markdown',
  })

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
