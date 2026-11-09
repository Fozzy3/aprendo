import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Swords } from 'lucide-react'
import { api } from '@aprendo/convex/api'

/** On Hoy while a teacher hosts a duel in one of the student's classes. Renders nothing otherwise. */
export function ActiveDuelBanner({ studentId }: { studentId: string }) {
  const duel = useQuery(convexQuery(api.duels.getActiveDuel, { studentId: studentId as never }))
  if (duel.data == null) return null
  return (
    <Link to="/duelo/$id" params={{ id: duel.data.duelId }} className="duel-banner no-underline">
      <Swords size={22} aria-hidden />
      <span className="min-w-0 flex-1">
        <strong className="block">Duelo en vivo</strong>
        <span className="block truncate text-sm">{duel.data.classGroupName}</span>
      </span>
      <span className="duel-banner-go">Entrar</span>
    </Link>
  )
}
