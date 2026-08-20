export async function uploadPdfToConvex(args: {
  file: File
  generateUploadUrl: (args: {}) => Promise<string>
  createPdfUpload: (args: {
    storageId: never
    fileName: string
    contentType: string
    sizeBytes: number
  }) => Promise<unknown>
}) {
  const uploadUrl = await args.generateUploadUrl({})
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': args.file.type || 'application/pdf',
    },
    body: args.file,
  })

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload PDF binary (${uploadResponse.status}).`)
  }

  const { storageId } = (await uploadResponse.json()) as {
    storageId: string
  }

  return args.createPdfUpload({
    storageId: storageId as never,
    fileName: args.file.name,
    contentType: args.file.type || 'application/pdf',
    sizeBytes: args.file.size,
  })
}
