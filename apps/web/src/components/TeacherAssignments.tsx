import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { readConvexError } from '../lib/convex-error.ts'
import { dueLabel } from '../lib/today-display.ts'

const KIND_LABEL = { practica: 'Práctica', tiquete: 'Tiquete', prueba: 'Prueba' } as const

/**
 * "De tu profe": what the student's teachers assigned (F40), a list on Hoy.
 * Nothing renders without an assignment.
 */
export function TeacherAssignments({ studentId }: { studentId: string }) {
  const navigate = useNavigate()
  const assignments = useQuery(convexQuery(api.teacher.listMyAssignments, { studentId: studentId as never }))
  const createSession = useConvexMutation(api.sessions.createSession)
  const start = useMutation({
    mutationFn: ({ assignmentId, kind }: { assignmentId: string; kind: 'topic' | 'prueba' }) =>
      createSession({ studentId: studentId as never, kind, assignmentId: assignmentId as never }),
    onSuccess: (sessionId: string) => navigate({ to: '/practice/$sessionId', params: { sessionId } }),
  })

  if (assignments.data == null || assignments.data.length === 0) return null
  const now = Date.now()

  return (
    <section className="tasks" aria-labelledby="hoy-teacher-title">
      <h2 id="hoy-teacher-title" className="hoy-section-title">De tu profe</h2>
      <ul className="tasks-list">
        {assignments.data.map((assignment) => (
          <li key={assignment.assignmentId}>
            <button
              type="button"
              className="task"
              disabled={start.isPending}
              onClick={() =>
                assignment.sessionId != null
                  ? navigate({ to: '/practice/$sessionId', params: { sessionId: assignment.sessionId } })
                  : start.mutate({
                      assignmentId: assignment.assignmentId,
                      kind: assignment.kind === 'prueba' ? 'prueba' : 'topic',
                    })}
            >
              <span className="task-text">
                <b>
                  {assignment.testTitle ?? `${KIND_LABEL[assignment.kind]}: ${getSubtopicLabel(assignment.subtopicId ?? '')}`}
                </b>
                <span>
                  {assignment.status === 'en_curso' ? 'Empezada' : dueLabel(assignment.dueAt, now)}
                </span>
              </span>
              <ChevronRight size={20} aria-hidden />
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
