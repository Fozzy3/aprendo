import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Medal } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { AvatarEditor } from './AvatarEditor.tsx'

type Student = {
  avatar?: { skin: string; hair: string; top: string; accessory: string }
  nickname?: string
}

/** On Yo: the medals, the portrait and nickname editor, and leaving the league. */
export function YoRewards({
  studentId,
  student,
  medals,
}: {
  studentId: string
  student: Student | null | undefined
  medals: { id: string; label: string; earnedAt: number }[]
}) {
  const queryClient = useQueryClient()
  const league = useQuery(convexQuery(api.league.getClassLeague, { studentId: studentId as never }))
  const setOptOut = useConvexMutation(api.league.setLeagueOptOut)
  const toggleLeague = useMutation({
    mutationFn: (optOut: boolean) => setOptOut({ studentId: studentId as never, optOut }),
    onSuccess: () => queryClient.invalidateQueries(),
  })
  const leagueStatus = league.data?.status
  const isOptedOut = leagueStatus === 'opted_out'

  return (
    <section className="ruled-section" aria-labelledby="yo-rewards-title">
      <h2 id="yo-rewards-title" className="section-title">Logros</h2>
      {medals.length === 0 ? <p className="text-sm text-[var(--text-tertiary)]">Sin medallas aún.</p> : null}
      {medals.length > 0 ? (
        <ul className="yo-album" aria-label="Tus medallas">
          {medals.map((medal) => (
            <li key={medal.id} className="yo-medal">
              <span className="reward-medal-icon"><Medal size={16} strokeWidth={2.4} aria-hidden /></span>
              {medal.label}
            </li>
          ))}
        </ul>
      ) : null}

      {student != null ? (
        <details className="yo-more">
          <summary>Avatar y apodo</summary>
          <AvatarEditor studentId={studentId} avatar={student.avatar ?? null} nickname={student.nickname ?? null} />
        </details>
      ) : null}

      {leagueStatus != null && leagueStatus !== 'unavailable' ? (
        <section className="yo-more" aria-label="Liga de tu curso">
          <button
            type="button"
            className="btn-secondary w-full"
            disabled={toggleLeague.isPending}
            onClick={() => toggleLeague.mutate(!isOptedOut)}
          >
            {isOptedOut ? 'Volver a la liga' : 'Salir de la liga'}
          </button>
        </section>
      ) : null}
    </section>
  )
}
