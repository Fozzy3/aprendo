import { convexQuery } from '@convex-dev/react-query'
import { api } from '@aprendo/convex/api'

export function pdfUploadsQuery(limit = 20) {
  return convexQuery(api.pdfs.listPdfUploads, { limit })
}

export function questionBrowserQuery(pdfUploadId: string, sequence: number) {
  return convexQuery(api.pdfs.getQuestionBrowser, {
    pdfUploadId: pdfUploadId as never,
    sequence,
  })
}
