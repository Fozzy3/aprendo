import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Swords } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { readConvexError } from '../lib/convex-error.ts'

/**
 * The teacher's one click to a class duel: opens the lobby (or the game already
 * running) and goes to the projector. A class that cannot play yet gets the
 * reason, with its code, from the backend.
 */
export function DuelLaunchButton({ classGroupId, compact = false }: { classGroupId: string; compact?: boolean }) {
  const navigate = useNavigate()
  const open = useMutation({
    mutationFn: useConvexMutation(api.duels.openDuel),
    onSuccess: (duelId: string) => navigate({ to: '/teacher/duelo/$id', params: { id: duelId } }),
  })
  return (
    <div className={`duel-launch${compact ? ' is-compact' : ''}`}>
      <button
        type="button"
        className="duel-launch-btn"
        disabled={open.isPending}
        onClick={() => open.mutate({ classGroupId: classGroupId as never })}
      >
        <Swords size={compact ? 16 : 20} aria-hidden />
        {open.isPending ? 'Abriendo…' : 'Duelo en vivo'}
      </button>
      {open.error != null ? (
        <p role="alert" className="notice is-danger duel-launch-error">{readConvexError(open.error, 'No se pudo abrir el duelo.')}</p>
      ) : null}
    </div>
  )
}
