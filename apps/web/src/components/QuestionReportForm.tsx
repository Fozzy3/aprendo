import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { MessageSquareWarning } from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { readConvexError } from '../lib/convex-error.ts'

type Reason = 'respuesta_incorrecta' | 'enunciado_confuso' | 'imagen_ilegible' | 'otro'

const REASONS: Array<{ value: Reason; label: string }> = [
  { value: 'respuesta_incorrecta', label: 'La respuesta correcta está mal' },
  { value: 'enunciado_confuso', label: 'El enunciado es confuso' },
  { value: 'imagen_ilegible', label: 'No se lee la imagen' },
  { value: 'otro', label: 'Otro problema' },
]

const MAX_NOTE_CHARS = 500

/**
 * "Reportar un problema" for one reviewed question. Inline rather than a modal:
 * it interrupts nothing, and the question stays in view while the student says
 * what is wrong with it. Mount it with `key={questionId}` so it resets per
 * question.
 */
export function QuestionReportForm({
  questionId,
  sessionId,
}: {
  questionId: string
  sessionId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState<Reason | null>(null)
  const [note, setNote] = useState('')

  const report = useConvexMutation(api.questionReports.reportQuestionProblem)
  const reportMutation = useMutation({
    mutationFn: async (chosen: Reason) =>
      report({
        questionId: questionId as never,
        sessionId: sessionId as never,
        reason: chosen,
        ...(note.trim().length > 0 ? { note } : {}),
      }),
  })

  if (reportMutation.isSuccess) {
    return (
      <p role="status" className="mt-4 text-center text-xs text-[var(--text-secondary)]">
        Gracias. Revisamos la pregunta y la corregimos si hace falta.
      </p>
    )
  }

  if (!isOpen) {
    return (
      <div className="mt-4 flex justify-center">
        <button type="button" className="btn-ghost text-xs" onClick={() => setIsOpen(true)}>
          <MessageSquareWarning size={14} aria-hidden /> Reportar un problema
        </button>
      </div>
    )
  }

  return (
    <form
      className="card-inset mt-4 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (reason != null) reportMutation.mutate(reason)
      }}
    >
      <fieldset className="m-0 border-0 p-0">
        <legend className="text-sm font-bold text-[var(--text-primary)]">¿Qué tiene esta pregunta?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`confidence-chip${reason === option.value ? ' is-active' : ''}`}
              aria-pressed={reason === option.value}
              onClick={() => setReason(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block text-xs font-semibold text-[var(--text-secondary)]">
        Cuéntanos más (opcional)
        <textarea
          className="input mt-1 min-h-20 resize-y text-sm"
          maxLength={MAX_NOTE_CHARS}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      {reportMutation.error != null ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-[var(--danger-text)]">
          {readConvexError(reportMutation.error, 'No pudimos enviar el reporte. Intenta de nuevo.')}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => setIsOpen(false)}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={reason == null || reportMutation.isPending}>
          {reportMutation.isPending ? 'Enviando…' : 'Enviar reporte'}
        </button>
      </div>
    </form>
  )
}
