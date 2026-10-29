import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { readConvexError } from '../lib/convex-error.ts'

const KIND_LABEL = { practica: 'Práctica', tiquete: 'Tiquete de salida' } as const

/**
 * "De tu profe": what the student's teachers assigned (F40), first on Hoy
 * because the classroom leads. Nothing renders without an assignment.
 */
export function TeacherAssignments({ studentId }: { studentId: string }) {
  const navigate = useNavigate()
  const assignments = useQuery(convexQuery(api.teacher.listMyAssignments, { studentId: studentId as never }))
  const createSession = useConvexMutation(api.sessions.createSession)
  const start = useMutation({
    mutationFn: (assignmentId: string) =>
      createSession({ studentId: studentId as never, kind: 'topic', assignmentId: assignmentId as never }),
    onSuccess: (sessionId: string) => navigate({ to: '/practice/$sessionId', params: { sessionId } }),
  })

  if (assignments.data == null || assignments.data.length === 0) return null
  const now = Date.now()

  return (
    <section className="ruled-section" aria-labelledby="teacher-assignments-title">
      <h2 id="teacher-assignments-title" className="section-title">De tu profe</h2>
      <ul className="ruled-list">
        {assignments.data.map((assignment) => (
          <li key={assignment.assignmentId} className="ruled-row">
            <span className="ruled-row-main">
              <span className="font-semibold">{getSubtopicLabel(assignment.subtopicId)}</span>
              <span className="ruled-row-note">
                {KIND_LABEL[assignment.kind]} · {assignment.questionCount} preguntas ·{' '}
                {assignment.dueAt < now
                  ? <span className="text-[var(--danger-text)]">vencida</span>
                  : `para el ${new Date(assignment.dueAt).toLocaleDateString('es-CO', { weekday: 'long' })} ${new Date(assignment.dueAt).getDate()}`}
              </span>
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={start.isPending}
              onClick={() =>
                assignment.sessionId != null
                  ? navigate({ to: '/practice/$sessionId', params: { sessionId: assignment.sessionId } })
                  : start.mutate(assignment.assignmentId)}
            >
              <Play size={13} aria-hidden />
              {assignment.status === 'en_curso' ? 'Continuar' : 'Empezar'}
            </button>
          </li>
        ))}
      </ul>
      {start.error != null ? (
        <p role="alert" className="notice is-danger">{readConvexError(start.error, 'No se pudo abrir la tarea.')}</p>
      ) : null}
    </section>
  )
}
