import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Flame, Medal, Minus } from 'lucide-react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { api } from '@aprendo/convex/api'
import type { MasteryLevel } from '@aprendo/convex/mastery'
import { MEDAL_LABELS, type MedalId } from '@aprendo/convex/rewards'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { landedStickers } from '../lib/album-view.ts'
import { closingLine } from '../lib/mastery-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { Sticker } from './Sticker.tsx'

const MOVED_ICON = { up: ArrowUp, down: ArrowDown, same: Minus }

/** The strong ease-out the rest of the student look uses. */
const EASE_OUT = [0.23, 1, 0.32, 1] as const

/** Counts up once, on a fresh close. Reduced motion, and any later visit, get the number at once. */
function useCountUp(target: number, shouldAnimate: boolean) {
  const [value, setValue] = useState(shouldAnimate ? 0 : target)
  useEffect(() => {
    if (!shouldAnimate) {
      setValue(target)
      return
    }
    const controls = animate(0, target, { duration: 0.8, ease: EASE_OUT, onUpdate: (latest) => setValue(Math.round(latest)) })
    return () => controls.stop()
  }, [shouldAnimate, target])
  return value
}

/**
 * The close of any session with a reward (F54): XP, streak, the sticker landing
 * in its slot, medals, how each topic moved, and the score last. The landing is
 * the app's one authored piece of motion; it plays once, on a fresh close.
 */
export function RewardScreen({
  studentId,
  subjectId,
  reward,
  changes,
  correctCount,
  questionCount,
  isFresh,
  sealedNote,
  children,
}: {
  studentId: string
  subjectId: string | null
  reward: { xp: number; medals: string[]; streakDays: number } | null
  changes: { subtopicId: string; from: MasteryLevel; to: MasteryLevel }[]
  correctCount: number
  questionCount: number
  /** Just finished: only then the count-up and the landing play. */
  isFresh: boolean
  /** In place of the score, while a school test's keys are still sealed. */
  sealedNote?: string
  /** The way forward, which depends on the session kind. */
  children: ReactNode
}) {
  const reduceMotion = useReducedMotion() === true
  const shownXp = useCountUp(reward?.xp ?? 0, isFresh && !reduceMotion)
  const landed = landedStickers(changes)[0] ?? null
  const album = useQuery(convexQuery(api.today.getStickerAlbum, landed == null ? 'skip' : { studentId: studentId as never }))
  const page = album.data?.subjects.find((subject) => subject.stickers.some((item) => item.subtopicId === landed?.subtopicId))
  const fieldSubject = page?.subjectId ?? subjectId

  return (
    <div
      className="reward fade-in"
      style={{ '--field': fieldSubject == null ? 'var(--cover)' : getSubjectTheme(fieldSubject).color } as CSSProperties}
    >
      {reward != null ? (
        <>
          <p className="reward-xp">
            <span aria-hidden>+{shownXp}</span>
            <span className="sr-only">{reward.xp}</span> XP
          </p>
          <p className="reward-streak">
            <Flame size={20} strokeWidth={2.4} aria-hidden />
            {reward.streakDays <= 1 ? 'Empezaste tu racha' : `Racha de ${reward.streakDays} días`}
          </p>
        </>
      ) : null}

      {page != null && landed != null ? (
        <section aria-label={`Lámina nueva: ${landed.label}`}>
          <ol className="reward-page">
            {page.stickers.map((sticker) =>
              sticker.subtopicId === landed.subtopicId ? (
                <motion.li
                  key={sticker.subtopicId}
                  className="is-landing"
                  initial={isFresh
                    ? reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, transform: 'translateY(-130%) rotate(-10deg) scale(1.35)' }
                    : false}
                  animate={reduceMotion ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0%) rotate(0deg) scale(1)' }}
                  transition={reduceMotion ? { duration: 0.3, delay: 0.3 } : { type: 'spring', duration: 0.7, bounce: 0.3, delay: 0.8 }}
                >
                  <Sticker sticker={landed} />
                </motion.li>
              ) : (
                <li key={sticker.subtopicId}><Sticker sticker={sticker} /></li>
              ),
            )}
          </ol>
          <p className="reward-landed">{landed.shiny ? 'Lámina brillante' : 'Lámina nueva'}: {landed.label}</p>
        </section>
      ) : null}

      <div className="reward-sheet">
        {(reward?.medals ?? []).map((medal) => (
          <p key={medal} className="reward-medal">
            <span className="reward-medal-icon"><Medal size={20} strokeWidth={2.4} aria-hidden /></span>
            {MEDAL_LABELS[medal as MedalId] ?? medal}
          </p>
        ))}

        {changes.length > 0 ? (
          <ul className="reward-changes">
            {changes.map((change) => {
              const line = closingLine(change)
              const Icon = MOVED_ICON[line.moved]
              return (
                <li key={change.subtopicId} className="reward-change">
                  <span className={`session-close-mark is-${line.moved}`} aria-hidden><Icon size={16} /></span>
                  <span>
                    <b>{getSubtopicLabel(change.subtopicId)}</b>
                    <span>{line.text}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}

        <p className="reward-score">{sealedNote ?? `${correctCount} de ${questionCount} correctas`}</p>
      </div>

      <div className="reward-actions">{children}</div>
    </div>
  )
}
