import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { UploadCloud, X } from 'lucide-react'
import { useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { api } from '@aprendo/convex/api'
import BrandMark from '../components/BrandMark.tsx'
import MarkdownBlock from '../components/MarkdownBlock.tsx'
import { pdfUploadsQuery, questionBrowserQuery } from '../lib/pdf-queries.ts'
import { uploadPdfToConvex } from '../lib/pdf-upload.ts'
import ThemeToggle from '../components/ThemeToggle.tsx'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'

type AdminTab = 'uploads' | 'questions'

type AdminSearch = {
  tab?: AdminTab
  pdfUploadId?: string
  sequence?: number
}

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const admin = await queryClient.ensureQueryData(
      convexQuery(api.auth.getCurrentAdmin, {}),
    )
    if (admin == null) {
      throw redirect({ to: '/login' })
    }
    return { admin }
  },
  validateSearch: (search: Record<string, unknown>): AdminSearch => ({
    tab: search.tab === 'questions' ? 'questions' : undefined,
    pdfUploadId:
      typeof search.pdfUploadId === 'string' ? search.pdfUploadId : undefined,
    sequence:
      typeof search.sequence === 'number'
        ? search.sequence
        : typeof search.sequence === 'string'
          ? Number(search.sequence)
          : undefined,
  }),
  loaderDeps: ({ search }) => ({
    tab: search.tab ?? 'uploads',
    pdfUploadId: search.pdfUploadId,
    sequence: search.sequence ?? 1,
  }),
  loader: async ({ context: { queryClient }, deps }) => {
    await queryClient.ensureQueryData(pdfUploadsQuery(50))
    if (deps.tab === 'questions' && deps.pdfUploadId) {
      await queryClient.ensureQueryData(
        questionBrowserQuery(deps.pdfUploadId, deps.sequence),
      )
    }
  },
  component: AdminPage,
  pendingComponent: AdminPending,
})

function AdminPending() {
  return (
    <FullScreenLoader message="Cargando el panel…" />
  )
}

function AdminPage() {
  const search = Route.useSearch()
  const activeTab: AdminTab = search.tab ?? 'uploads'

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Top bar */}
      <header className="border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="page-container-wide flex flex-wrap items-center justify-between gap-3 py-3">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-[var(--text-primary)] no-underline"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)]">
              <BrandMark />
            </div>
            <div>
              <span className="text-sm font-semibold">Aprendo</span>
              <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">Admin</span>
            </div>
          </Link>

          {/* Center tabs */}
          <nav className="tab-nav">
            <Link
              to="/admin"
              search={{}}
              className={`tab-item ${activeTab === 'uploads' ? 'is-active' : ''}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              Upload PDFs
            </Link>
            <Link
              to="/admin"
              search={{ tab: 'questions' }}
              className={`tab-item ${activeTab === 'questions' ? 'is-active' : ''}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Questions
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/app"
              className="btn-ghost text-xs no-underline"
            >
              App
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="page-container-wide px-4 py-8">
        {activeTab === 'uploads' ? <UploadsTab /> : <QuestionsTab search={search} />}
      </main>
    </div>
  )
}

/* ─── Uploads Tab ─── */

function UploadsTab() {
  const queryClient = useQueryClient()
  const { data: uploads } = useSuspenseQuery(pdfUploadsQuery(50))
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const generateUploadUrl = useConvexMutation(api.pdfs.generatePdfUploadUrl)
  const createPdfUpload = useConvexMutation(api.pdfs.createPdfUpload)
  const retryPdfUpload = useConvexMutation(api.pdfs.retryPdfUpload)

  const addSelectedFiles = (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    )

    if (pdfFiles.length === 0) {
      setErrorMessage('Select or drop one or more PDF files.')
      return
    }

    setErrorMessage(null)
    setSelectedFiles((currentFiles) => {
      const knownFiles = new Set(
        currentFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
      )
      const newFiles = pdfFiles.filter(
        (file) => !knownFiles.has(`${file.name}:${file.size}:${file.lastModified}`),
      )
      return [...currentFiles, ...newFiles]
    })
  }

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addSelectedFiles(event.target.files)
    }
    event.target.value = ''
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDraggingFiles(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingFiles(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDraggingFiles(false)
    addSelectedFiles(event.dataTransfer.files)
  }

  const removeSelectedFile = (fileToRemove: File) => {
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((file) => file !== fileToRemove),
    )
  }

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        setUploadingFileName(file.name)
        await uploadPdfToConvex({ file, generateUploadUrl, createPdfUpload })
      }
    },
    onError: (error) => {
      setUploadingFileName(null)
      setErrorMessage(error instanceof Error ? error.message : String(error))
    },
    onSuccess: async () => {
      setErrorMessage(null)
      setSelectedFiles([])
      setUploadingFileName(null)
      await queryClient.invalidateQueries({ queryKey: pdfUploadsQuery().queryKey })
    },
  })

  const retryMutation = useMutation({
    mutationFn: async (pdfUploadId: string) => {
      await retryPdfUpload({ pdfUploadId: pdfUploadId as never })
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : String(error))
    },
  })

  return (
    <div className="fade-in mx-auto max-w-3xl">
      {/* Upload form */}
      <div className="card mb-8 p-6">
        <h2 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">
          Upload a PDF
        </h2>
        <p className="mb-5 text-sm text-[var(--text-secondary)]">
          Each upload is processed through OCR, question extraction, and enrichment.
        </p>

        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            'flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed px-5 py-8 text-center transition',
            isDraggingFiles
              ? 'border-[var(--border-accent)] bg-[var(--accent-soft)]'
              : 'border-[var(--border-strong)] bg-[var(--bg-inset)] hover:border-[var(--border-accent)] hover:bg-[var(--bg-card-hover)]',
          ].join(' ')}
        >
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileInputChange}
            className="sr-only"
          />
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--accent)]">
            <UploadCloud aria-hidden="true" size={20} />
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            Drop PDF files here or click to choose
          </span>
          <span className="mt-1 text-xs text-[var(--text-tertiary)]">
            Multiple PDFs are uploaded as separate processing jobs.
          </span>
        </label>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-secondary)]">
            {selectedFiles.length === 0
              ? 'No PDFs selected.'
              : `${selectedFiles.length} PDF${selectedFiles.length === 1 ? '' : 's'} selected.`}
          </p>
          <button
            type="button"
            disabled={selectedFiles.length === 0 || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate(selectedFiles)}
            className="btn-primary"
          >
            {uploadMutation.isPending ? 'Subiendo…' : 'Upload PDFs'}
          </button>
        </div>

        {selectedFiles.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {selectedFiles.map((file) => (
              <li
                key={`${file.name}:${file.size}:${file.lastModified}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2"
              >
                <span className="min-w-0 text-sm text-[var(--text-secondary)]">
                  <strong className="block truncate text-[var(--text-primary)]">{file.name}</strong>
                  {Math.ceil(file.size / 1024)} KB
                  {uploadingFileName === file.name ? ' · uploading' : ''}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  disabled={uploadMutation.isPending}
                  onClick={() => removeSelectedFile(file)}
                  className="btn-ghost p-2"
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {errorMessage ? (
          <p className="mt-3 text-sm font-medium text-[var(--accent-text)]">
            {errorMessage}
          </p>
        ) : null}
      </div>

      {/* Upload list */}
      <div className="space-y-3">
        {uploads.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-[var(--text-tertiary)]">No PDFs uploaded yet.</p>
          </div>
        ) : (
          uploads.map((upload) => (
            <div key={upload._id} className="card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
                    {upload.fileName}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`chip ${upload.status === 'completed' ? 'chip-success' : upload.status === 'failed' ? 'chip-accent' : ''}`}>
                      {upload.status}
                    </span>
                    <span className="chip">{Math.ceil(upload.sizeBytes / 1024)} KB</span>
                    {upload.questionCount != null ? <span className="chip">{upload.questionCount} questions</span> : null}
                    {upload.answerCompletedCount != null ? <span className="chip">{upload.answerCompletedCount} answers</span> : null}
                    {upload.taxonomyCompletedCount != null ? <span className="chip">{upload.taxonomyCompletedCount} tagged</span> : null}
                    {upload.diagnosticEligibleCount != null ? <span className="chip chip-success">{upload.diagnosticEligibleCount} eligible</span> : null}
                    {upload.excludedQuestionCount != null && upload.excludedQuestionCount > 0 ? <span className="chip chip-accent">{upload.excludedQuestionCount} excluded</span> : null}
                  </div>
                  {upload.errorMessage ? (
                    <p className="mt-2 text-sm font-medium text-[var(--accent-text)]">
                      {upload.errorMessage}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-shrink-0 flex-wrap gap-2">
                  {upload.pdfUrl ? (
                    <a
                      href={upload.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost text-xs no-underline"
                    >
                      Open PDF
                    </a>
                  ) : null}
                  {upload.rawQuestionsUrl ? (
                    <a
                      href={upload.rawQuestionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost text-xs no-underline"
                    >
                      Raw JSON
                    </a>
                  ) : null}
                  {upload.questionCount != null && upload.questionCount > 0 ? (
                    <Link
                      to="/admin"
                      search={{
                        tab: 'questions',
                        pdfUploadId: upload._id,
                        sequence: 1,
                      }}
                      className="btn-ghost text-xs no-underline"
                    >
                      Browse
                    </Link>
                  ) : null}
                  {upload.status === 'failed' ? (
                    <button
                      type="button"
                      onClick={() => retryMutation.mutate(upload._id)}
                      disabled={retryMutation.isPending}
                      className="btn-secondary text-xs"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ─── Questions Tab ─── */

function QuestionsTab({ search }: { search: AdminSearch }) {
  const { data: uploads } = useSuspenseQuery(pdfUploadsQuery(50))
  const selectedSequence = search.sequence ?? 1
  const completedUploads = uploads.filter((u) => u.questionCount != null && u.questionCount > 0)
  const defaultUploadId = search.pdfUploadId ?? completedUploads[0]?._id

  return (
    <div className="fade-in">
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Sidebar: PDF list */}
        <aside className="space-y-2">
          <p className="kicker mb-2 px-1">Question sets</p>
          {completedUploads.length === 0 ? (
            <div className="card-inset p-4">
              <p className="text-sm text-[var(--text-tertiary)]">No processed sets yet.</p>
            </div>
          ) : (
            completedUploads.map((upload) => (
              <Link
                key={upload._id}
                to="/admin"
                search={{
                  tab: 'questions',
                  pdfUploadId: upload._id,
                  sequence: 1,
                }}
                className={[
                  'block rounded-[var(--radius-md)] border px-4 py-3 no-underline transition',
                  upload._id === defaultUploadId
                    ? 'border-[var(--border-accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]',
                ].join(' ')}
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{upload.fileName}</p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{upload.questionCount} questions</p>
              </Link>
            ))
          )}
        </aside>

        {/* Main: question viewer */}
        <section>
          {defaultUploadId ? (
            <QuestionViewer pdfUploadId={defaultUploadId} sequence={selectedSequence} />
          ) : (
            <div className="card p-6">
              <p className="text-sm text-[var(--text-tertiary)]">Select a processed PDF to start browsing.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function QuestionViewer({ pdfUploadId, sequence }: { pdfUploadId: string; sequence: number }) {
  const browserQuery = useQuery(questionBrowserQuery(pdfUploadId, sequence))
  const browser = browserQuery.data

  if (browserQuery.isPending) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-[var(--text-tertiary)]">Cargando pregunta…</p>
      </div>
    )
  }

  if (!browser || browser.question == null) {
    return (
      <div className="card p-6">
        <p className="text-sm text-[var(--text-tertiary)]">Question not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Question header */}
      <div className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">
              {browser.upload.fileName}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Question {browser.currentSequence} of {browser.totalQuestions}
              {' \u00b7 '}
              Original #{browser.question.questionNumber}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin"
              search={{
                tab: 'questions',
                pdfUploadId: browser.upload._id,
                sequence: Math.max(1, browser.currentSequence - 1),
              }}
              className="btn-secondary text-xs no-underline"
            >
              Previous
            </Link>
            <Link
              to="/admin"
              search={{
                tab: 'questions',
                pdfUploadId: browser.upload._id,
                sequence: Math.min(browser.totalQuestions, browser.currentSequence + 1),
              }}
              className="btn-primary text-xs no-underline"
            >
              Next
            </Link>
          </div>
        </div>

        {/* Status chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="chip">
            eligibility: {browser.question.eligibility ?? 'legacy'}
          </span>
          <span className="chip">
            answer: {browser.question.answerStatus ?? 'legacy'}
          </span>
          <span className="chip">
            taxonomy: {browser.question.taxonomyStatus ?? 'legacy'}
          </span>
          {browser.question.subjectId ? (
            <span className="chip chip-accent">{browser.question.subjectId}</span>
          ) : null}
          {browser.question.primarySubtopicId ? (
            <span className="chip chip-accent">{browser.question.primarySubtopicId}</span>
          ) : null}
          {browser.question.answerCorrectOption ? (
            <span className="chip chip-success">correct: {browser.question.answerCorrectOption}</span>
          ) : null}
        </div>
      </div>

      {/* Question body */}
      <div className="card p-6">
        <p className="kicker mb-3">Question body</p>
        <MarkdownBlock markdown={browser.question.bodyMarkdown} />
      </div>

      {/* Options */}
      <div className="space-y-2">
        {browser.question.options.map((option) => (
          <div
            key={option.label}
            className={`option-card cursor-default ${option.label === browser.question!.answerCorrectOption ? 'is-correct' : ''}`}
          >
            <span className="option-label">{option.label}</span>
            <span className="flex-1">
              {option.bodyMarkdown ? (
                <MarkdownBlock markdown={option.bodyMarkdown} />
              ) : (
                <span className="text-sm text-[var(--text-tertiary)]">Empty option body.</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
