import { useEffect, useState } from 'react'

/** How a duel ended, for the projector and the phones: only teams, never a person. */
export function duelOutcome(teams: { name: string; score: number }[]): string {
  const top = Math.max(...teams.map((team) => team.score))
  const winners = teams.filter((team) => team.score === top)
  return winners.length === 1 ? `Ganó ${winners[0]!.name}` : 'Empate'
}

/** Milliseconds left on the game, ticking once a second; the host's and the phones' clock. */
export function useMsLeft(endsAt: number | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return endsAt == null ? null : Math.max(0, endsAt - now)
}
