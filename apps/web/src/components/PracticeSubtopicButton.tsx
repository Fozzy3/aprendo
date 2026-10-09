import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { readConvexError } from '../lib/convex-error.ts'

/**
 * Starts topic practice on one subtopic and goes straight into it. Topic
 * practice is untimed, so unlike a simulacro there is no intro step to stop at.
 */
export function PracticeSubtopicButton({
  studentId,
  subtopicId,
  label = 'Practicar',
  variant = 'secondary',
}: {
  studentId: string
  subtopicId: string
  label?: string
  variant?: 'primary' | 'secondary'
}) {
  const navigate = useNavigate()
  const createSession = useConvexMutation(api.sessions.createSession)
  const startMutation = useMutation({
    mutationFn: async () =>
      createSession({ studentId: studentId as never, kind: 'topic', subtopicId }),
    onSuccess: (sessionId) => navigate({ to: '/practice/$sessionId', params: { sessionId } }),
  })

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}
        disabled={startMutation.isPending}
        onClick={() => startMutation.mutate()}
      >
        <Play size={14} aria-hidden /> {startMutation.isPending ? 'Preparando…' : label}
      </button>
      {startMutation.error != null ? (
        <span role="alert" className="text-xs font-semibold text-[var(--danger-text)]">
          {readConvexError(startMutation.error, 'No pudimos iniciar la práctica.')}
        </span>
      ) : null}
    </span>
  )
}
