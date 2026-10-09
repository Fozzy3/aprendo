import { useConvexMutation } from '@convex-dev/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { readConvexError } from '../lib/convex-error.ts'

type Reason = 'respuesta_incorrecta' | 'enunciado_confuso' | 'imagen_ilegible' | 'otro'

// Worded for someone mid-exam, who cannot see the key: "the answer is wrong"
// is what they can tell as "no option works, or several do".
const REASONS: { value: Reason; label: string }[] = [
  { value: 'respuesta_incorrecta', label: 'Ninguna opción sirve, o sirve más de una' },
  { value: 'enunciado_confuso', label: 'El enunciado es confuso o le falta información' },
  { value: 'imagen_ilegible', label: 'No se lee la imagen o el texto' },
  { value: 'otro', label: 'Otro problema' },
]

const NOTE_LIMIT = 500

/** "Reportar un problema" for one question, from the solve screen. */
export function ReportProblemSheet({
  open,
  onOpenChange,
  questionId,
  sessionId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionId: string
  sessionId: string
}) {
  const [reason, setReason] = useState<Reason | null>(null)
  const [note, setNote] = useState('')
  const reportProblem = useConvexMutation(api.questionReports.reportQuestionProblem)
  const mutation = useMutation({
    mutationFn: () => {
      if (reason == null) throw new Error('Elige un motivo.')
      const trimmed = note.trim()
      return reportProblem({
        questionId: questionId as never,
        sessionId: sessionId as never,
        reason,
        ...(trimmed.length > 0 ? { note: trimmed } : {}),
      })
    },
  })

  const change = (next: boolean) => {
    if (!next) {
      setReason(null)
      setNote('')
      mutation.reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog.Root open={open} onOpenChange={change}>
      <Dialog.Portal>
        <Dialog.Overlay className="solve-sheet-scrim" />
        <Dialog.Content className="solve-sheet solve-report-sheet">
          <span className="solve-sheet-handle" aria-hidden />
          <header className="solve-sheet-head">
            <div>
              <Dialog.Title className="solve-sheet-title">Reportar un problema</Dialog.Title>
              <Dialog.Description className="solve-sheet-sub">
                Lo revisamos para corregir la pregunta. Tu sesión no cambia.
              </Dialog.Description>
            </div>
            <Dialog.Close className="solve-icon-btn" aria-label="Cerrar">
              <X size={18} />
            </Dialog.Close>
          </header>

          {mutation.isSuccess ? (
            <div className="solve-report-done" role="status">
              <p>Gracias. Ya quedó registrado.</p>
              <button type="button" className="btn-primary" onClick={() => change(false)}>
                Seguir
              </button>
            </div>
          ) : (
            <form
              className="solve-report-form"
              onSubmit={(event) => {
                event.preventDefault()
                mutation.mutate()
              }}
            >
              <fieldset className="solve-report-reasons">
                <legend className="sr-only">Motivo</legend>
                {REASONS.map((option) => (
                  <label
                    key={option.value}
                    className={`solve-report-reason${reason === option.value ? ' is-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={option.value}
                      checked={reason === option.value}
                      onChange={() => setReason(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>

              <label className="solve-report-note">
                <span>Cuéntanos más (opcional)</span>
                <textarea
                  value={note}
                  maxLength={NOTE_LIMIT}
                  rows={3}
                  onChange={(event) => setNote(event.target.value)}
                />
                <small>{note.length}/{NOTE_LIMIT}</small>
              </label>

              {mutation.error ? (
                <p className="stage-alert" role="alert">
                  {readConvexError(mutation.error, 'No se pudo enviar el reporte. Intenta de nuevo.')}
                </p>
              ) : null}

              <button
                type="submit"
                className="btn-primary solve-sheet-cta"
                disabled={reason == null || mutation.isPending}
              >
                {mutation.isPending ? 'Enviando…' : 'Enviar reporte'}
              </button>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
