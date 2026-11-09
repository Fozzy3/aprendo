import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { UploadCloud, X } from 'lucide-react'
import { useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { AuditQueue } from '../components/admin/AuditQueue.tsx'
import { ReportsQueue } from '../components/admin/ReportsQueue.tsx'
import { SchoolsAdmin } from '../components/admin/SchoolsAdmin.tsx'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { MarkdownBlock } from '../components/MarkdownBlock.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { pdfUploadsQuery, questionBrowserQuery } from '../lib/pdf-queries.ts'
import { uploadPdfToConvex } from '../lib/pdf-upload.ts'

type AdminTab = 'bank' | 'audit' | 'reports' | 'schools'

type AdminSearch = {
  tab?: AdminTab
  pdfUploadId?: string
  sequence?: number
  questionId?: string
}

const TAB_LABEL: Record<AdminTab, string> = { bank: 'Banco', audit: 'Auditoría', reports: 'Reportes', schools: 'Colegios' }

/** The tab a link asks for; the old PDFs and Preguntas links land on Banco. */
function parseTab(tab: unknown): AdminTab | undefined {
  if (tab === 'uploads' || tab === 'questions' || tab === 'bank') return 'bank'
  return tab === 'audit' || tab === 'reports' || tab === 'schools' ? tab : undefined
}

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const staff = await queryClient.ensureQueryData(convexQuery(api.auth.getCurrentStaffMember, {}))
    if (staff == null) throw redirect({ to: '/login' })
    return { staff }
  },
  validateSearch: (search: Record<string, unknown>): AdminSearch => ({
    tab: parseTab(search.tab),
    pdfUploadId: typeof search.pdfUploadId === 'string' ? search.pdfUploadId : undefined,
    sequence:
      typeof search.sequence === 'number'
        ? search.sequence
        : typeof search.sequence === 'string'
          ? Number(search.sequence)
          : undefined,
    questionId: typeof search.questionId === 'string' ? search.questionId : undefined,
  }),
  loaderDeps: ({ search }) => ({ tab: search.tab ?? 'bank', pdfUploadId: search.pdfUploadId, sequence: search.sequence ?? 1 }),
  loader: async ({ context: { queryClient, staff }, deps }) => {
    if (deps.tab !== 'bank' || !staff.isAdmin) return
    await queryClient.ensureQueryData(pdfUploadsQuery(50))
    if (deps.pdfUploadId) await queryClient.ensureQueryData(questionBrowserQuery(deps.pdfUploadId, deps.sequence))
  },
  component: AdminPage,
  pendingComponent: AdminPending,
})

function AdminPending() {
  return <FullScreenLoader message="Cargando el panel…" />
}

/** Aprendo staff see the whole panel; a reviewer only ever the audit. */
function AdminPage() {
  const search = Route.useSearch()
  const { staff } = Route.useRouteContext()
  const navigate = useNavigate()
  const activeTab: AdminTab = staff.isAdmin ? (search.tab ?? 'bank') : 'audit'
  const tabs: AdminTab[] = staff.isAdmin ? ['bank', 'audit', 'reports', 'schools'] : ['audit']

  return (
    <StaffShell
      role={staff.isAdmin ? 'admin' : 'reviewer'}
      home="/admin"
      nav={tabs.map((tab) => (
        <Link
          key={tab}
          to="/admin"
          search={{ tab }}
          className={`student-topnav-item${activeTab === tab ? ' is-active' : ''}`}
          aria-current={activeTab === tab ? 'page' : undefined}
        >
          {TAB_LABEL[tab]}
        </Link>
      ))}
    >
      {activeTab === 'bank' ? (
        <BankTab search={search} />
      ) : activeTab === 'audit' ? (
        <AuditQueue
          questionId={search.questionId}
          onSelect={(questionId) => void navigate({ to: '/admin', search: { tab: 'audit', questionId } })}
        />
      ) : activeTab === 'reports' ? (
        <ReportsQueue />
      ) : (
        <SchoolsAdmin />
      )}
    </StaffShell>
  )
}

const UPLOAD_STATUS_LABEL: Record<string, string> = {
  uploaded: 'En cola',
  processing: 'Leyendo',
  enriching: 'Completando',
  completed: 'Listo',
  failed: 'Falló',
}

const ELIGIBILITY_LABEL: Record<string, string> = {
  pending: 'Pendiente de auditoría',
  diagnostic: 'En el banco',
  practice_only: 'Solo práctica',
  excluded: 'Fuera del banco',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  completed: 'Lista',
  failed: 'Falló',
  needs_review: 'Por revisar',
}

/** PDFs and their questions, together: upload, follow the status, and read what came out. */
function BankTab({ search }: { search: AdminSearch }) {
  const { data: uploads } = useSuspenseQuery(pdfUploadsQuery(50))
  const browsable = uploads.filter((upload) => (upload.questionCount ?? 0) > 0)
  const selectedId = search.pdfUploadId ?? browsable[0]?._id

  return (
    <section aria-labelledby="bank-title">
      <h1 id="bank-title" className="page-title">Banco</h1>
      <p className="page-lede">Cada PDF pasa por lectura, extracción y enriquecimiento; lo que sale espera en Auditoría antes de llegar a los estudiantes.</p>

      <UploadForm />

      <div className="ruled-section grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div>
          <h2 className="section-title">Fuentes</h2>
          <UploadList uploads={uploads} selectedId={selectedId} />
        </div>
        <div className="min-w-0">
          <h2 className="section-title">Preguntas</h2>
          {selectedId != null ? (
            <QuestionViewer pdfUploadId={selectedId} sequence={search.sequence ?? 1} />
          ) : (
            <p className="m-0 text-sm text-[var(--text-tertiary)]">Sube un PDF para empezar.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function UploadForm() {
  const queryClient = useQueryClient()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const generateUploadUrl = useConvexMutation(api.pdfs.generatePdfUploadUrl)
  const createPdfUpload = useConvexMutation(api.pdfs.createPdfUpload)

  const addSelectedFiles = (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    )

    if (pdfFiles.length === 0) {
      setErrorMessage('Elige o suelta uno o más archivos PDF.')
      return
    }

    setErrorMessage(null)
    setSelectedFiles((currentFiles) => {
      const knownFiles = new Set(currentFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`))
      const newFiles = pdfFiles.filter((file) => !knownFiles.has(`${file.name}:${file.size}:${file.lastModified}`))
      return [...currentFiles, ...newFiles]
    })
  }

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addSelectedFiles(event.target.files)
    event.target.value = ''
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDraggingFiles(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFiles(false)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDraggingFiles(false)
    addSelectedFiles(event.dataTransfer.files)
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
      setErrorMessage(readConvexError(error, 'No se pudo subir el PDF.'))
    },
    onSuccess: async () => {
      setErrorMessage(null)
      setSelectedFiles([])
      setUploadingFileName(null)
      await queryClient.invalidateQueries({ queryKey: pdfUploadsQuery().queryKey })
    },
  })

  return (
    <div className="ruled-section">
      <h2 className="section-title">Subir PDF</h2>
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed px-5 py-8 text-center transition-colors',
          isDraggingFiles
            ? 'border-[var(--border-accent)] bg-[var(--accent-soft)]'
            : 'border-[var(--border-strong)] bg-[var(--bg-inset)] hover:border-[var(--border-accent)]',
        ].join(' ')}
      >
        <input type="file" accept="application/pdf" multiple onChange={handleFileInputChange} className="sr-only" />
        <UploadCloud aria-hidden="true" size={20} className="mb-2 text-[var(--accent)]" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">Suelta los PDF aquí o haz clic para elegirlos</span>
        <span className="mt-1 text-xs text-[var(--text-tertiary)]">Cada PDF se procesa por separado.</span>
      </label>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          {selectedFiles.length === 0 ? 'Ningún PDF elegido.' : `${selectedFiles.length} PDF ${selectedFiles.length === 1 ? 'elegido' : 'elegidos'}.`}
        </p>
        <button
          type="button"
          disabled={selectedFiles.length === 0 || uploadMutation.isPending}
          onClick={() => uploadMutation.mutate(selectedFiles)}
          className="btn-primary"
        >
          {uploadMutation.isPending ? 'Subiendo…' : 'Subir'}
        </button>
      </div>

      {selectedFiles.length > 0 ? (
        <ul className="ruled-list mt-3">
          {selectedFiles.map((file) => (
            <li key={`${file.name}:${file.size}:${file.lastModified}`} className="ruled-row">
              <span className="ruled-row-main text-sm">
                <strong className="block truncate">{file.name}</strong>
                <span className="text-[var(--text-secondary)]">
                  <span className="tabular-nums">{Math.ceil(file.size / 1024)}</span> KB
                  {uploadingFileName === file.name ? ' · subiendo' : ''}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Quitar ${file.name}`}
                disabled={uploadMutation.isPending}
                onClick={() => setSelectedFiles((files) => files.filter((other) => other !== file))}
                className="btn-ghost p-2"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {errorMessage ? <p role="alert" className="mt-3 text-sm font-medium text-[var(--danger-text)]">{errorMessage}</p> : null}
    </div>
  )
}

type Upload = FunctionReturnType<typeof api.pdfs.listPdfUploads>[number]

function UploadList({ uploads, selectedId }: { uploads: Upload[]; selectedId: string | undefined }) {
  const retryPdfUpload = useConvexMutation(api.pdfs.retryPdfUpload)
  const retryMutation = useMutation({ mutationFn: (pdfUploadId: Upload['_id']) => retryPdfUpload({ pdfUploadId }) })

  if (uploads.length === 0) return <p className="m-0 text-sm text-[var(--text-tertiary)]">Aún no hay PDF.</p>

  return (
    <>
      <ul className="ruled-list">
        {uploads.map((upload) => (
          <li key={upload._id}>
            <div className={`ruled-row items-start ${upload._id === selectedId ? 'bg-[var(--accent-soft)]' : ''}`}>
              <div className="ruled-row-main gap-1.5">
                <span className="truncate text-sm font-semibold">{upload.fileName}</span>
                <div className="flex flex-wrap gap-1">
                  <span className={`chip ${upload.status === 'completed' ? 'chip-success' : upload.status === 'failed' ? 'chip-accent' : ''}`}>
                    {UPLOAD_STATUS_LABEL[upload.status] ?? upload.status}
                  </span>
                  {upload.questionCount != null ? <span className="chip tabular-nums">{upload.questionCount} preguntas</span> : null}
                  {upload.excludedQuestionCount != null && upload.excludedQuestionCount > 0 ? (
                    <span className="chip chip-accent tabular-nums">{upload.excludedQuestionCount} excluidas</span>
                  ) : null}
                </div>
                {upload.errorMessage ? <p className="m-0 text-xs font-medium text-[var(--danger-text)]">{upload.errorMessage}</p> : null}
                <div className="flex flex-wrap gap-1">
                  {(upload.questionCount ?? 0) > 0 ? (
                    <Link to="/admin" search={{ tab: 'bank', pdfUploadId: upload._id, sequence: 1 }} className="btn-ghost text-xs no-underline">
                      Explorar
                    </Link>
                  ) : null}
                  {upload.pdfUrl ? <a href={upload.pdfUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs no-underline">Abrir PDF</a> : null}
                  {upload.rawQuestionsUrl ? <a href={upload.rawQuestionsUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs no-underline">JSON crudo</a> : null}
                  {upload.status === 'failed' ? (
                    <button type="button" onClick={() => retryMutation.mutate(upload._id)} disabled={retryMutation.isPending} className="btn-secondary text-xs">
                      Reintentar
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {retryMutation.error != null ? (
        <p role="alert" className="mt-2 text-sm text-[var(--danger-text)]">{readConvexError(retryMutation.error, 'No se pudo reprocesar el PDF.')}</p>
      ) : null}
    </>
  )
}

function QuestionViewer({ pdfUploadId, sequence }: { pdfUploadId: string; sequence: number }) {
  const browserQuery = useQuery(questionBrowserQuery(pdfUploadId, sequence))
  const browser = browserQuery.data

  if (browserQuery.isPending) return <p className="m-0 text-sm text-[var(--text-tertiary)]">Cargando pregunta…</p>
  if (browser == null || browser.question == null) return <p className="m-0 text-sm text-[var(--text-tertiary)]">No encontramos esa pregunta.</p>

  const question = browser.question

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">{browser.upload.fileName}</span>
          {' · '}
          <span className="tabular-nums">{browser.currentSequence} de {browser.totalQuestions}</span>
          {' · '}
          número original <span className="tabular-nums">{question.questionNumber}</span>
        </p>
        <div className="flex gap-2">
          <Link
            to="/admin"
            search={{ tab: 'bank', pdfUploadId: browser.upload._id, sequence: Math.max(1, browser.currentSequence - 1) }}
            className="btn-secondary text-xs no-underline"
          >
            Anterior
          </Link>
          <Link
            to="/admin"
            search={{ tab: 'bank', pdfUploadId: browser.upload._id, sequence: Math.min(browser.totalQuestions, browser.currentSequence + 1) }}
            className="btn-secondary text-xs no-underline"
          >
            Siguiente
          </Link>
          <Link to="/admin" search={{ tab: 'audit', questionId: question._id }} className="btn-primary text-xs no-underline">
            Editar en Auditoría
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="chip">{ELIGIBILITY_LABEL[question.eligibility ?? ''] ?? 'Sin clasificar'}</span>
        <span className="chip">Clave: {STATUS_LABEL[question.answerStatus ?? ''] ?? 'sin estado'}</span>
        <span className="chip">Taxonomía: {STATUS_LABEL[question.taxonomyStatus ?? ''] ?? 'sin estado'}</span>
        {question.answerCorrectOption ? <span className="chip chip-success">Correcta: {question.answerCorrectOption}</span> : null}
      </div>

      <MarkdownBlock markdown={question.bodyMarkdown} />

      <div className="space-y-2">
        {question.options.map((option) => (
          <div key={option.label} className={`option-card cursor-default ${option.label === question.answerCorrectOption ? 'is-correct' : ''}`}>
            <span className="option-label">{option.label}</span>
            <span className="flex-1">
              {option.bodyMarkdown ? <MarkdownBlock markdown={option.bodyMarkdown} /> : <span className="text-sm text-[var(--text-tertiary)]">Opción vacía.</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
