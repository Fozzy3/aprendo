import { Flame, Medal, Shield, Zap } from 'lucide-react'
import { MotionConfig, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { MASTERY_LEVEL_LABELS, type MasteryLevel } from '@aprendo/convex/mastery'
import { MEDAL_LABELS, type MedalId, streakMilestone } from '@aprendo/convex/rewards'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { closingLine } from '../lib/mastery-display.ts'
import { motionTokens } from '../lib/motion-tokens.ts'
import { MasteryBadge } from './MasteryBadge.tsx'

/** Topic labels like "histórica/cultural/situacional" have no spaces: let them wrap after a slash, not mid-word. */
const breakAtSlashes = (label: string) => label.replaceAll('/', '/​')

/** One line under each streak milestone: effort, never a promise about the score. */
const MILESTONE_NOTE: Record<number, string> = {
  3: 'Así se arma un hábito.',
  7: 'Una semana completa, día tras día.',
  14: 'Dos semanas sin parar.',
  30: 'Un mes entero practicando cada día.',
}

type Reward = { xp: number; medals: string[]; streakDays: number; previousStreakDays?: number; shieldEarned?: boolean }

/**
 * The close of any session with a reward (F54): the score, how each topic
 * moved (with what the next level needs), then XP, streak and medals, and the
 * way forward. On a fresh close a topic that went up settles in; the day's
 * first session ticks the streak up, and 3, 7, 14 and 30 days get a card.
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
  reward: Reward | null
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
      ? `Subiste a ${MASTERY_LEVEL_LABELS[wentUp.to]} en ${breakAtSlashes(getSubtopicLabel(wentUp.subtopicId))}`
      : score
  const previous = reward?.previousStreakDays
  const milestone = isFresh && reward != null && previous != null ? streakMilestone(previous, reward.streakDays) : null

  return (
    <MotionConfig reducedMotion="user">
      <div className="reward fade-in">
        <h1 className="reward-title">{headline}</h1>
        {sealedNote != null ? (
          <p className="reward-lede">{sealedNote}</p>
        ) : wentUp != null ? (
          <p className="reward-lede">{score}</p>
        ) : null}

        {milestone != null ? <StreakMoment days={milestone} /> : null}

        {changes.length > 0 ? (
          <section aria-labelledby="reward-changes-title">
            <h2 id="reward-changes-title" className="reward-section-title">Tus temas</h2>
            <ul className="reward-changes">
              {changes.map((change) => {
                const line = closingLine(change)
                return (
                  <li key={change.subtopicId} className={`reward-change is-${line.moved}${isFresh ? ' is-fresh' : ''}`}>
                    <b className="reward-change-name">{breakAtSlashes(getSubtopicLabel(change.subtopicId))}</b>
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
              <StreakCount streakDays={reward.streakDays} from={isFresh ? previous : undefined} />
            </li>
            {reward.shieldEarned === true ? (
              <li><Shield size={16} aria-hidden /> Ganaste un escudo para tu racha</li>
            ) : null}
            {reward.medals.map((medal) => (
              <li key={medal}><Medal size={16} aria-hidden /> {MEDAL_LABELS[medal as MedalId] ?? medal}</li>
            ))}
          </ul>
        ) : null}

        <div className="reward-actions">{children}</div>
      </div>
    </MotionConfig>
  )
}

/**
 * "Racha de N días". On the day's first session (`from` below the streak) it
 * shows yesterday's count, then the new one rises in once the card is read.
 */
function StreakCount({ streakDays, from }: { streakDays: number; from?: number }) {
  const ticks = from != null && from >= 1 && from < streakDays
  const [shown, setShown] = useState(ticks ? from : streakDays)
  useEffect(() => {
    if (!ticks) {
      setShown(streakDays)
      return
    }
    const timer = setTimeout(() => setShown(streakDays), motionTokens().spring * 1000)
    return () => clearTimeout(timer)
  }, [ticks, streakDays])

  if (shown <= 1) return <>Empezaste tu racha</>
  const t = motionTokens()
  return (
    <span>
      Racha de{' '}
      <motion.span
        key={shown}
        className="reward-streak-count"
        initial={ticks && shown === streakDays ? { opacity: 0, transform: 'translateY(40%)', filter: 'blur(2px)' } : false}
        animate={{ opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }}
        transition={{ duration: t.step, ease: t.ease }}
      >
        {shown}
      </motion.span>{' '}
      días
    </span>
  )
}

/** 3, 7, 14 or 30 days reached in this session: the card takes a moment of its own. */
function StreakMoment({ days }: { days: number }) {
  const t = motionTokens()
  return (
    <motion.section
      className="streak-moment"
      aria-label={`Racha de ${days} días seguidos`}
      initial={{ opacity: 0, transform: 'scale(0.96)' }}
      animate={{ opacity: 1, transform: 'scale(1)' }}
      transition={{ duration: t.spring, ease: t.ease, delay: t.step }}
    >
      <Flame className="streak-moment-icon" size={28} strokeWidth={2.25} aria-hidden />
      <p className="streak-moment-count">{days}</p>
      <p className="streak-moment-label">días seguidos</p>
      <p className="streak-moment-note">{MILESTONE_NOTE[days]}</p>
    </motion.section>
  )
}
