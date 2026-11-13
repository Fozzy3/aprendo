import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from '@aprendo/convex/api'
import { AvatarPortrait } from './AvatarPortrait.tsx'

/** How far a classmate is: a gap, never a score of the other student's. */
function gapText(xpGap: number) {
  if (xpGap === 0) return 'empatados'
  return xpGap > 0 ? `+${xpGap} XP` : `${xpGap} XP`
}

/**
 * The week's class league (F59): the student and two classmates each way, by
 * effort, reset every Monday. Nothing until the league exists and enough of the
 * class is playing; the lower half carries no position, only the gap (G3).
 */
export function LeagueStrip({ studentId }: { studentId: string }) {
  const league = useQuery(convexQuery(api.league.getClassLeague, { studentId: studentId as never }))
  const data = league.data
  if (data == null || data.status === 'unavailable' || data.status === 'opted_out') return null

  if (data.status === 'no_xp_yet') {
    return (
      <section className="league" aria-label="Liga de tu curso">
        <p className="league-note">Termina una sesión para entrar a la liga de tu curso</p>
      </section>
    )
  }

  return (
    <section className="league" aria-labelledby="league-title">
      <header className="league-head">
        <h2 id="league-title" className="league-title">Liga de tu curso</h2>
        <p className="league-note">
          {data.you.rank != null ? `Puesto ${data.you.rank} · ` : ''}
          {data.you.gapToNext != null ? `${data.you.gapToNext} XP para subir` : 'vas adelante'}
        </p>
      </header>
      <ol className="league-list">
        {data.entries.map((entry, index) => (
          <li key={`${entry.nickname}-${index}`} className={`league-row${entry.isYou ? ' is-you' : ''}`}>
            <span className="league-rank">{entry.rank ?? ''}</span>
            <span className="avatar-sticker league-avatar"><AvatarPortrait avatar={entry.avatar} /></span>
            <span className="league-name">{entry.isYou ? 'Tú' : entry.nickname}</span>
            <span className="league-gap">{entry.isYou ? `${data.you.xp} XP` : gapText(entry.xpGap)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
