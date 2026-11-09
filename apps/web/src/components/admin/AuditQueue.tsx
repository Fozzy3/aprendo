import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '@aprendo/convex/api'
import { getSubjectLabel } from '@aprendo/convex/taxonomy'
import type { FunctionReturnType } from 'convex/server'
import { confirmDialog } from '../ConfirmDialog.tsx'
import { EmptyState } from '../EmptyState.tsx'
import { PageLoader } from '../FullScreenLoader.tsx'
import { MarkdownBlock } from '../MarkdownBlock.tsx'
import { toast } from '../Toast.tsx'
import { readConvexError } from '../../lib/convex-error.ts'

type Item = NonNullable<FunctionReturnType<typeof api.audit.getAuditItem>>
type View = 'queue' | 'rejected' | 'done'

const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'queue', label: 'Por revisar' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'done', label: 'Firmadas' },
]

const STATUS_LABEL: Record<string, string> = {
  pending_checks: 'Sin chequear',
  needs_review: 'Por revisar',
  auto_passed: 'Muestra',
  rejected: 'Rechazada',
  approved: 'Aprobada',
  fixed: 'Corregida',
}

const CHECK_LABEL: Record<string, string> = {
  key_present: 'Clave',
  printed_key: 'Clave impresa',
  option_count: 'Cantidad de opciones',
  options_filled: 'Opciones llenas',
  options_unique: 'Opciones distintas',
  missing_figure: 'Figura',
  katex: 'Fórmulas',
  page_furniture: 'Texto de la página',
  group_range: 'Grupo',
  urls_resolve: 'Imágenes',
  crop_sanity: 'Recorte',
  duplicate_stem: 'Duplicado',
  taxonomy_valid: 'Taxonomía',
}

const HISTORY_SOURCE: Record<string, string> = {
  inventory: 'Inventario',
  printed_reread: 'Cuadernillo releído',
  'key_proposal:teacher': 'Propuesta del docente',
  'key_proposal:admin': 'Propuesta del administrador',
  key_applied: 'Aplicada con dos firmas',
  key_proposal_dismissed: 'Propuesta descartada',
  review: 'Revisión',
}

const FIELD_LABEL = { key: 'Clave', stem: 'Enunciado', options: 'Opciones', taxonomy: 'Taxonomía', context: 'Contexto', guide: 'Guía' } as const

/** Page image beside the question, what the machines said, and the signature. */
export function AuditQueue({ questionId, onSelect }: { questionId?: string; onSelect: (questionId: string) => void }) {
  const [view, setView] = useState<View>('queue')
  const [subjectId, setSubjectId] = useState<string | undefined>()
  const queueQuery = useQuery(convexQuery(api.audit.getAuditQueue, { view, ...(subjectId == null ? {} : { subjectId }) }))
  const countsQuery = useQuery(convexQuery(api.audit.getReviewerCounts, {}))
  const items = queueQuery.data?.items ?? []
  const current = questionId ?? items[0]?.questionId
  const index = items.findIndex((item) => item.questionId === current)

  const go = (delta: number) => {
    const next = items[index + delta]
    if (next != null) onSelect(next.questionId)
  }

  return (
    <section aria-labelledby="audit-title">
      <div className="section-head">
        <h1 id="audit-title" className="page-title">Auditoría</h1>
        <p className="m-0 text-sm text-[var(--text-secondary)]">
          Has firmado <strong className="tabular-nums">{countsQuery.data?.mine ?? 0}</strong> preguntas
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <nav className="tab-nav" aria-label="Estado">
          {VIEWS.map(({ value, label }) => (
            <button key={value} type="button" className={`tab-item${view === value ? ' is-active' : ''}`} onClick={() => setView(value)}>
              {label}
            </button>
          ))}
        </nav>
        {(queueQuery.data?.subjects.length ?? 0) > 1 ? (
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            Área
            <select
              className="input"
              style={{ width: 'auto' }}
              value={subjectId ?? ''}
              onChange={(event) => setSubjectId(event.target.value || undefined)}
            >
              <option value="">Todas</option>
              {queueQuery.data!.subjects.map((subject) => (
                <option key={subject} value={subject}>{getSubjectLabel(subject)}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Cola de preguntas">
          {queueQuery.isPending ? (
            <PageLoader message="Cargando la cola…" />
          ) : items.length === 0 ? (
            <EmptyState title={view === 'queue' ? 'No hay preguntas por revisar' : 'Nada en esta lista'} />
          ) : (
            <>
              <p className="mb-2 mt-0 text-xs tabular-nums text-[var(--text-tertiary)]">
                {items.length} de {queueQuery.data!.total}
              </p>
              <ul className="ruled-list">
                {items.map((item) => (
                  <li key={item.auditId}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.questionId)}
                      aria-current={item.questionId === current ? 'true' : undefined}
                      className={`ruled-row w-full cursor-pointer border-x-0 border-t-0 bg-transparent text-left ${item.questionId === current ? 'bg-[var(--accent-soft)]' : ''}`}
                    >
                      <span className="ruled-row-main gap-1">
                        <span className="text-sm font-semibold">
                          {getSubjectLabel(item.subjectId)} · <span className="tabular-nums">{item.questionNumber}</span>
                        </span>
                        <span className="line-clamp-2 text-xs text-[var(--text-secondary)]">{item.excerpt}</span>
                        {item.rank === 0 ? <span className="chip chip-accent self-start">La clave está en duda</span> : null}
                        {item.failed > 0 ? <span className="text-xs text-[var(--danger-text)]">{item.failed} falla{item.failed === 1 ? '' : 's'}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(countsQuery.data?.byReviewer?.length ?? 0) > 0 ? (
            <div className="mt-5">
              <h2 className="section-title">Firmas por revisor</h2>
              <ul className="m-0 list-none space-y-1 p-0 text-sm">
                {countsQuery.data!.byReviewer!.map((reviewer) => (
                  <li key={reviewer.studentId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{reviewer.name}</span>
                    <span className="tabular-nums">{reviewer.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0">
          {current == null ? null : <AuditDetail questionId={current} onNext={() => go(1)} onPrevious={() => go(-1)} />}
        </div>
      </div>
    </section>
  )
}

function AuditDetail({ questionId, onNext, onPrevious }: { questionId: string; onNext: () => void; onPrevious: () => void }) {
  const itemQuery = useQuery(convexQuery(api.audit.getAuditItem, { questionId: questionId as never }))
  const openAudit = useConvexMutation(api.audit.openAudit)
  const openMutation = useMutation({ mutationFn: () => openAudit({ questionId: questionId as never }) })

  if (itemQuery.isPending) return <PageLoader message="Cargando la pregunta…" />
  if (itemQuery.isError) {
    return <EmptyState title="No se pudo abrir esta pregunta">Puede que no tengas permiso sobre esta área.</EmptyState>
  }
  if (itemQuery.data == null) {
    return (
      <EmptyState
        title="Esta pregunta aún no entra a la auditoría"
        action={
          <button type="button" className="btn-primary" disabled={openMutation.isPending} onClick={() => openMutation.mutate()}>
            Abrir auditoría
          </button>
        }
      />
    )
  }
  return <ReviewPanel key={questionId} item={itemQuery.data} onNext={onNext} onPrevious={onPrevious} />
}

function ReviewPanel({ item, onNext, onPrevious }: { item: Item; onNext: () => void; onPrevious: () => void }) {
  const { audit, question } = item
  const [fixing, setFixing] = useState(false)
  const approve = useConvexMutation(api.audit.approveAudit)
  const reject = useConvexMutation(api.audit.rejectAudit)
  const signProposal = useConvexMutation(api.audit.signKeyProposal)
  const dismissProposal = useConvexMutation(api.audit.dismissKeyProposal)
  const proposalPending = item.pendingKey != null
  // The second signature is the other role's: the one that proposed only waits.
  const canResolveProposal = proposalPending && item.pendingKey!.source !== `key_proposal:${item.reviewerRole}`

  const signMutation = useMutation({
    mutationFn: () => signProposal({ auditId: audit._id }),
    onSuccess: () => toast('Propuesta firmada: el cambio quedó aplicado.'),
  })
  const dismissMutation = useMutation({
    mutationFn: () => dismissProposal({ auditId: audit._id }),
    onSuccess: () => toast('Propuesta descartada: la clave sigue igual.'),
  })
  const approveMutation = useMutation({
    mutationFn: () => approve({ auditId: audit._id }),
    onSuccess: () => {
      toast('Pregunta aprobada.')
      onNext()
    },
  })
  const rejectMutation = useMutation({
    mutationFn: () => reject({ auditId: audit._id }),
    onSuccess: () => {
      toast('Pregunta rechazada: salió del banco.')
      onNext()
    },
  })

  const askReject = async () => {
    const yes = await confirmDialog({
      title: '¿Rechazar esta pregunta?',
      body: 'Sale del banco de inmediato. Los resultados de los estudiantes dejan de contarla.',
      confirmLabel: 'Rechazar',
      destructive: true,
    })
    if (yes) rejectMutation.mutate()
  }

  const askDismiss = async () => {
    const yes = await confirmDialog({
      title: '¿Descartar esta propuesta?',
      body: 'La clave sigue igual y la propuesta queda en el historial. La pregunta aún espera su aprobación.',
      confirmLabel: 'Descartar',
      destructive: true,
    })
    if (yes) dismissMutation.mutate()
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest?.('input, textarea, select') != null || event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'a') {
        if (!proposalPending) approveMutation.mutate()
      } else if (key === 'c') setFixing(true)
      else if (key === 'r') void askReject()
      else if (key === 'j') onNext()
      else if (key === 'k') onPrevious()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const error = approveMutation.error ?? rejectMutation.error ?? signMutation.error ?? dismissMutation.error

  return (
    <article className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="section-title m-0">
          {item.source} · pregunta <span className="tabular-nums">{question.questionNumber}</span>
        </h2>
        <span className="chip">{STATUS_LABEL[audit.status] ?? audit.status}</span>
      </header>

      {item.rank === 0 ? (
        <p role="alert" className="m-0 text-sm font-semibold text-[var(--danger-text)]">
          Los dos modelos contradicen la clave. La clave no cambia sola: un docente y un administrador deben firmar el cambio.
        </p>
      ) : null}
      {item.pendingKey != null ? <PendingKey pending={item.pendingKey} /> : null}
      {item.openReports.length > 0 ? <OpenReports reports={item.openReports} /> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <figure className="m-0">
          <figcaption className="mb-1 text-xs text-[var(--text-tertiary)]">
            Página original{audit.source.page == null ? '' : ` ${audit.source.page}`}
          </figcaption>
          {item.pageImageUrl != null ? (
            <img src={item.pageImageUrl} alt={`Página ${audit.source.page ?? ''} de la fuente`} className="w-full rounded-[var(--radius-sm)] border border-[var(--border)]" />
          ) : item.cropUrl != null ? (
            <img src={item.cropUrl} alt="Recorte de la pregunta" className="w-full rounded-[var(--radius-sm)] border border-[var(--border)]" />
          ) : (
            <EmptyState title="Sin imagen de la página">Pregunta sin fuente impresa o aún no cargada.</EmptyState>
          )}
        </figure>

        <div className="min-w-0 space-y-3">
          {item.group != null ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3 text-sm">
              <MarkdownBlock markdown={item.group.contextMarkdown} />
            </div>
          ) : null}
          {question.stemDisplay === 'scan' && item.cropUrl != null ? <img src={item.cropUrl} alt="Enunciado como imagen" className="w-full" /> : null}
          <MarkdownBlock markdown={question.bodyMarkdown} />
          <div className="space-y-2">
            {question.options.map((option) => (
              <div key={option.label} className={`option-card cursor-default ${option.label === question.answerCorrectOption ? 'is-correct' : ''}`}>
                <span className="option-label">{option.label}</span>
                <span className="flex-1">
                  {option.bodyMarkdown ? <MarkdownBlock markdown={option.bodyMarkdown} /> : <span className="text-sm text-[var(--danger-text)]">Opción vacía</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Checks checks={audit.checks} />
      <Models item={item} />

      <div className="flex flex-wrap items-center gap-2">
        {canResolveProposal ? (
          <>
            <button type="button" className="btn-primary" disabled={signMutation.isPending} onClick={() => signMutation.mutate()}>
              Firmar propuesta
            </button>
            <button type="button" className="btn-secondary" disabled={dismissMutation.isPending} onClick={() => void askDismiss()}>
              Descartar propuesta
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn-primary"
          disabled={approveMutation.isPending || proposalPending}
          title={proposalPending ? 'Primero hay que firmar o descartar la propuesta.' : undefined}
          onClick={() => approveMutation.mutate()}
        >
          Aprobar <Kbd>A</Kbd>
        </button>
        <button type="button" className="btn-secondary" onClick={() => setFixing((value) => !value)}>
          Corregir <Kbd>C</Kbd>
        </button>
        <button type="button" className="btn-ghost" disabled={rejectMutation.isPending} onClick={() => void askReject()}>
          Rechazar <Kbd>R</Kbd>
        </button>
        <span className="ml-auto flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <button type="button" className="btn-ghost text-xs" onClick={onPrevious}>Anterior <Kbd>K</Kbd></button>
          <button type="button" className="btn-ghost text-xs" onClick={onNext}>Siguiente <Kbd>J</Kbd></button>
        </span>
      </div>
      {error != null ? (
        <p role="alert" className="m-0 text-sm text-[var(--danger-text)]">{readConvexError(error, 'No se pudo guardar. Intenta de nuevo.')}</p>
      ) : null}

      {fixing ? <FixForm item={item} onDone={() => setFixing(false)} /> : null}
      {item.guide != null ? <GuideReview guide={item.guide} /> : null}
      <History entries={audit.history} />
    </article>
  )
}

function Kbd({ children }: { children: string }) {
  return <kbd className="ml-1 text-xs opacity-70">{children}</kbd>
}

function PendingKey({ pending }: { pending: NonNullable<Item['pendingKey']> }) {
  const fromTeacher = pending.source === 'key_proposal:teacher'
  return (
    <p className="m-0 text-sm font-semibold">
      {pending.keyText != null ? `Cambio del texto de la clave a «${pending.keyText}»` : `Cambio de clave a ${pending.after}`} propuesto por {fromTeacher ? 'un docente' : 'un administrador'}. Falta la firma de {fromTeacher ? 'un administrador' : 'un docente'}.
    </p>
  )
}

function OpenReports({ reports }: { reports: Item['openReports'] }) {
  return (
    <ul className="m-0 list-none space-y-1 p-0 text-sm">
      {reports.map((report, index) => (
        <li key={index}>
          Un estudiante reportó: {report.reason === 'respuesta_incorrecta' ? 'la respuesta' : report.reason === 'imagen_ilegible' ? 'la imagen' : 'otro problema'}
          {report.note ? ` · “${report.note}”` : ''}
        </li>
      ))}
    </ul>
  )
}

function Checks({ checks }: { checks: Item['audit']['checks'] }) {
  const flagged = checks.filter((check) => check.result !== 'pass')
  const passed = checks.length - flagged.length
  if (checks.length === 0) return <p className="m-0 text-sm text-[var(--text-tertiary)]">Sin chequeos automáticos todavía.</p>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {flagged.map((check) => (
        <span key={check.id} className={check.result === 'fail' ? 'chip chip-accent' : 'chip'} title={check.detail} style={{ whiteSpace: 'normal' }}>
          {CHECK_LABEL[check.id] ?? check.id}{check.detail == null ? '' : `: ${check.detail}`}
        </span>
      ))}
      {passed > 0 ? <span className="chip chip-success"><span className="tabular-nums">{passed}</span> sin problemas</span> : null}
    </div>
  )
}

function Models({ item }: { item: Item }) {
  const { audit, question } = item
  if (audit.solvers.length === 0 && audit.vision == null) {
    return <p className="m-0 text-sm text-[var(--text-tertiary)]">Los modelos aún no han leído esta pregunta.</p>
  }
  const yes = (value: boolean) => (value ? 'Sí' : 'No')
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {audit.solvers.length > 0 ? (
        <ul className="m-0 list-none space-y-1 p-0 text-sm">
          {audit.solvers.map((solver) => (
            <li key={solver.modelId} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[var(--text-secondary)]">{solver.modelId}</span>
              <span className={`shrink-0 tabular-nums ${solver.option === question.answerCorrectOption ? '' : 'font-semibold text-[var(--danger-text)]'}`}>
                {solver.option} · {Math.round(solver.confidence * 100)} %
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {audit.vision != null ? (
        <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-3 text-sm text-[var(--text-secondary)]">
          <dt>Enunciado coincide</dt><dd className="m-0">{yes(audit.vision.stemMatches)}</dd>
          <dt>Opciones coinciden</dt><dd className="m-0">{yes(audit.vision.optionsMatch)}</dd>
          <dt>Necesita figura</dt><dd className="m-0">{yes(audit.vision.figureNeeded)}</dd>
          <dt>Figura legible</dt><dd className="m-0">{yes(audit.vision.figureLegible)}</dd>
        </dl>
      ) : null}
    </div>
  )
}

function FixForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const { audit, question } = item
  const [stem, setStem] = useState(question.bodyMarkdown)
  const [options, setOptions] = useState(question.options)
  const [key, setKey] = useState(question.answerCorrectOption ?? '')
  const [subtopicId, setSubtopicId] = useState(question.primarySubtopicId ?? '')
  const [stemDisplay, setStemDisplay] = useState<'text' | 'scan' | ''>(question.stemDisplay ?? '')
  const [note, setNote] = useState('')
  const fix = useConvexMutation(api.audit.fixAudit)

  const save = useMutation({
    mutationFn: () => {
      const optionsChanged = options.some((option, index) => option.bodyMarkdown !== question.options[index]?.bodyMarkdown)
      return fix({
        auditId: audit._id,
        ...(stem !== question.bodyMarkdown ? { stem } : {}),
        ...(optionsChanged ? { options } : {}),
        ...(key !== '' && key !== question.answerCorrectOption ? { key } : {}),
        ...(subtopicId !== '' && subtopicId !== question.primarySubtopicId ? { subtopicId } : {}),
        ...(stemDisplay !== '' && stemDisplay !== question.stemDisplay ? { stemDisplay } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      })
    },
    onSuccess: (result) => {
      toast(result.keyChange === 'proposed' ? 'Cambio registrado: falta la firma de la otra persona.' : 'Corrección guardada.')
      onDone()
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <form className="form-grid" onSubmit={submit} aria-label="Corregir la pregunta">
      <label className="field col-span-full">
        <span>Enunciado</span>
        <textarea className="input" rows={5} value={stem} onChange={(event) => setStem(event.target.value)} />
      </label>
      {options.map((option, index) => (
        <label key={option.label} className="field">
          <span>Opción {option.label}</span>
          <input
            className="input"
            value={option.bodyMarkdown}
            onChange={(event) => setOptions(options.map((other, at) => (at === index ? { ...other, bodyMarkdown: event.target.value } : other)))}
          />
        </label>
      ))}
      <label className="field">
        <span>Clave</span>
        <select name="key" className="input" value={key} onChange={(event) => setKey(event.target.value)}>
          {question.answerCorrectOption == null ? <option value="">Sin clave</option> : null}
          {options.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}
        </select>
        <small>Cambiarla necesita la firma de un docente y de un administrador.</small>
      </label>
      <label className="field">
        <span>Subtema</span>
        <select className="input" value={subtopicId} onChange={(event) => setSubtopicId(event.target.value)}>
          {item.subtopics.map((subtopic) => <option key={subtopic.id} value={subtopic.id}>{subtopic.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Se muestra como</span>
        <select className="input" value={stemDisplay} onChange={(event) => setStemDisplay(event.target.value as typeof stemDisplay)}>
          <option value="">Sin definir</option>
          <option value="text">Texto</option>
          <option value="scan">Imagen del cuadernillo</option>
        </select>
      </label>
      <label className="field col-span-full">
        <span>Nota (opcional)</span>
        <input className="input" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="col-span-full flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-primary" disabled={save.isPending}>Guardar corrección</button>
        <button type="button" className="btn-ghost" onClick={onDone}>Cancelar</button>
        {save.error != null ? (
          <p role="alert" className="m-0 text-sm text-[var(--danger-text)]">{readConvexError(save.error, 'No se pudo guardar la corrección.')}</p>
        ) : null}
      </div>
    </form>
  )
}

function GuideReview({ guide }: { guide: NonNullable<Item['guide']> }) {
  const review = useConvexMutation(api.audit.reviewGuide)
  const mutation = useMutation({ mutationFn: (status: 'approved' | 'rejected') => review({ guideId: guide._id, status }) })

  return (
    <section aria-label="Guía socrática" className="space-y-3 border-t border-[var(--border)] pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="section-title m-0">Guía socrática</h3>
        <span className="chip">{guide.status === 'approved' ? 'Aprobada' : guide.status === 'rejected' ? 'Rechazada' : 'Por revisar'}</span>
      </div>
      <p className="m-0 text-sm"><strong>Pista:</strong> {guide.hint}</p>
      {Object.entries(guide.byOption).map(([label, path]) => (
        <div key={label} className="text-sm">
          <p className="m-0 font-semibold">Si eligió la {label}: {path.diagnose.prompt}</p>
          <ul className="m-0 mt-1 list-disc space-y-0.5 pl-5">
            {path.diagnose.choices.map((choice) => <li key={choice.text}>{choice.text}</li>)}
          </ul>
          <ol className="m-0 mt-1 list-decimal space-y-0.5 pl-5">
            {path.steps.map((step) => (
              <li key={step.prompt}>
                {step.prompt} <span className="text-[var(--text-tertiary)]">({step.choices.map((choice) => (choice.correct === true ? `${choice.text} (correcta)` : choice.text)).join(' · ')})</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="m-0 text-sm"><strong>Al final:</strong> {guide.reveal}</p>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" disabled={mutation.isPending} onClick={() => mutation.mutate('approved')}>Aprobar guía</button>
        <button type="button" className="btn-ghost" disabled={mutation.isPending} onClick={() => mutation.mutate('rejected')}>Rechazar guía</button>
      </div>
      {mutation.error != null ? <p role="alert" className="m-0 text-sm text-[var(--danger-text)]">{readConvexError(mutation.error, 'No se pudo guardar la revisión de la guía.')}</p> : null}
    </section>
  )
}

function History({ entries }: { entries: Item['audit']['history'] }) {
  if (entries.length === 0) return null
  return (
    <details className="border-t border-[var(--border)] pt-3 text-sm">
      <summary className="cursor-pointer font-semibold">Historial</summary>
      <ul className="m-0 mt-2 list-none space-y-1 p-0">
        {entries.map((entry, index) => (
          <li key={index} className="flex flex-wrap gap-x-2 text-[var(--text-secondary)]">
            <span className="tabular-nums text-[var(--text-tertiary)]">{new Date(entry.at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {entry.field === 'key' ? `Clave ${entry.after ?? 'sin definir'}` : FIELD_LABEL[entry.field]}
            </span>
            <span>{HISTORY_SOURCE[entry.source] ?? entry.source}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
