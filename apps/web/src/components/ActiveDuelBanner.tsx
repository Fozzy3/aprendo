import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Swords } from 'lucide-react'
import { api } from '@aprendo/convex/api'

/**
 * On Hoy and Retos while a teacher hosts a duel in one of the student's
 * classes; renders nothing otherwise. One tap: the duel page joins on arrival.
 */
export function ActiveDuelBanner({ studentId }: { studentId: string }) {
  const duel = useQuery(convexQuery(api.duels.getActiveDuel, { studentId: studentId as never }))
  if (duel.data == null) return null
  return (
    <Link to="/duelo/$id" params={{ id: duel.data.duelId }} className="duel-banner no-underline">
      <span className="duel-banner-icon" aria-hidden>
        <Swords size={22} />
      </span>
      <span className="duel-banner-text">
        <strong>Duelo en vivo</strong>
        <span>{duel.data.classGroupName}</span>
      </span>
      <span className="duel-banner-go">
        Entrar <ArrowRight size={18} aria-hidden />
      </span>
    </Link>
  )
}
