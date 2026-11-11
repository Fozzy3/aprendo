import { Flame, Medal, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { MASTERY_LEVEL_LABELS, type MasteryLevel } from '@aprendo/convex/mastery'
import { MEDAL_LABELS, type MedalId } from '@aprendo/convex/rewards'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { closingLine } from '../lib/mastery-display.ts'
import { MasteryBadge } from './MasteryBadge.tsx'

/**
 * The close of any session with a reward (F54): the score, how each topic
 * moved (with what the next level needs), then XP, streak and medals, and the
 * way forward. A topic that went up is the one moment that animates, once, on
 * a fresh close.
 */
export function RewardScreen({
  reward,
  changes,
  correctCount,
  questionCount,
  isFresh,
  sealedNote,
  children,
}: {
  studentId?: string
  subjectId?: string | null
  reward: { xp: number; medals: string[]; streakDays: number } | null
  changes: { subtopicId: string; from: MasteryLevel; to: MasteryLevel }[]
  correctCount: number
  questionCount: number
  /** Just finished: only then the level-up animates. */
  isFresh: boolean
  /** In place of the score, while a school test's keys are still sealed. */
  sealedNote?: string
  /** The way forward, which depends on the session kind. */
  children: ReactNode
}) {
  const score = `${correctCount} de ${questionCount} correctas`
  const wentUp = changes.find((change) => closingLine(change).moved === 'up')
  const headline = sealedNote != null
    ? 'Prueba entregada'
    : wentUp != null
      ? `Subiste a ${MASTERY_LEVEL_LABELS[wentUp.to]} en ${getSubtopicLabel(wentUp.subtopicId)}`
      : score

  return (
    <div className="reward fade-in">
      <h1 className="reward-title">{headline}</h1>
      {sealedNote != null ? (
        <p className="reward-lede">{sealedNote}</p>
      ) : wentUp != null ? (
        <p className="reward-lede">{score}</p>
      ) : null}

      {changes.length > 0 ? (
        <section aria-labelledby="reward-changes-title">
          <h2 id="reward-changes-title" className="reward-section-title">Tus temas</h2>
          <ul className="reward-changes">
            {changes.map((change) => {
              const line = closingLine(change)
              return (
                <li key={change.subtopicId} className={`reward-change is-${line.moved}${isFresh ? ' is-fresh' : ''}`}>
                  <b className="reward-change-name">{getSubtopicLabel(change.subtopicId)}</b>
                  <span className="reward-change-level">
                    <MasteryBadge level={change.to} />
                    {line.moved === 'up' ? <span className="reward-up">Subiste</span> : null}
                    {line.moved === 'down' ? <span className="reward-down">Bajó</span> : null}
                  </span>
                  <span className="reward-change-note">{line.text}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {reward != null ? (
        <ul className="reward-gains" aria-label="Lo que ganaste">
          <li><Zap size={16} aria-hidden /> {reward.xp} XP</li>
          <li>
            <Flame size={16} aria-hidden />
            {reward.streakDays <= 1 ? 'Empezaste tu racha' : `Racha de ${reward.streakDays} días`}
          </li>
          {reward.medals.map((medal) => (
            <li key={medal}><Medal size={16} aria-hidden /> {MEDAL_LABELS[medal as MedalId] ?? medal}</li>
          ))}
        </ul>
      ) : null}

      <div className="reward-actions">{children}</div>
    </div>
  )
}
