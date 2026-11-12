/**
 * What a student earns for showing up: XP and medals (F54), the streak and its
 * shields (F58), the sticker album, the portrait and the nickname (F55).
 *
 * XP and the league measure effort; stickers measure mastery. Nothing here feeds
 * a learning metric, and `computeReward` takes no correctness at all. Pure, and
 * free of `convex/*` imports so the web can use it too.
 */
import taxonomyContract from '../../../docs/taxonomy.v1.json'
import { colombiaHour, colombiaMonday } from './colombiaTime'
import type { MasteryLevel } from './mastery'

export const XP_PER_ANSWER = 10
/** On top of the answer's XP, for walking a guided path to its end (F56). */
export const XP_PER_GUIDED_PATH = 5
/** Below this an answer is a tap-through, not an attempt: it pays nothing. */
export const MIN_ANSWER_MS = 4_000
/** The most XP one Colombia day can pay, so grinding cannot buy a league. */
export const DAILY_XP_CAP = 300

export const MEDAL_LABELS = {
  primera_sesion: 'Primera sesión',
  racha_3: 'Tres días seguidos',
  racha_7: 'Siete días seguidos',
  racha_14: 'Catorce días seguidos',
  racha_30: 'Treinta días seguidos',
  camino_terminado: 'Camino guiado completo',
} as const

export type MedalId = keyof typeof MEDAL_LABELS

/** Each one is a medal and a full-card moment on the reward (`streakMilestone`). */
const STREAK_MEDALS: readonly { days: number; medal: MedalId }[] = [
  { days: 3, medal: 'racha_3' },
  { days: 7, medal: 'racha_7' },
  { days: 14, medal: 'racha_14' },
  { days: 30, medal: 'racha_30' },
]

/** The milestone a session's streak just reached (3, 7, 14, 30), or null. */
export function streakMilestone(previousStreakDays: number, streakDays: number) {
  return STREAK_MEDALS.filter(({ days }) => previousStreakDays < days && days <= streakDays).at(-1)?.days ?? null
}

export interface RewardAnswer {
  /** `pacing.questionTimeMs`: null when the client reported no time. */
  timeMs: number | null
  guidedOutcome?: 'self_corrected' | 'revealed'
  /** "Muéstrame" before the end of the ladder: the path was skipped, not walked. */
  guidedSkipped?: boolean
  /** Steps answered. None means there was no path to walk, only the retry. */
  guidedStep?: number
}

/**
 * The reward of one finished session. Called once, from `completeSession`, so a
 * stale tab cannot be paid twice. Effort only: time on the question, guided
 * paths finished, a daily cap. There is no correctness in the input on purpose.
 */
export function computeReward(input: {
  answers: RewardAnswer[]
  xpEarnedToday: number
  streakDays: number
  earnedMedals: readonly string[]
}) {
  const walkedPath = (answer: RewardAnswer) => answer.guidedOutcome != null && answer.guidedSkipped !== true && (answer.guidedStep ?? 0) > 0
  const raw = input.answers.reduce(
    (total, answer) =>
      total
      + (answer.timeMs != null && answer.timeMs >= MIN_ANSWER_MS ? XP_PER_ANSWER : 0)
      + (walkedPath(answer) ? XP_PER_GUIDED_PATH : 0),
    0,
  )

  const candidates: MedalId[] = [
    ...(input.answers.length > 0 ? ['primera_sesion' as const] : []),
    ...STREAK_MEDALS.filter(({ days }) => input.streakDays >= days).map(({ medal }) => medal),
    ...(input.answers.some(walkedPath) ? ['camino_terminado' as const] : []),
  ]

  return {
    xp: Math.min(raw, Math.max(0, DAILY_XP_CAP - input.xpEarnedToday)),
    medals: candidates.filter((medal) => !input.earnedMedals.includes(medal)),
    streakDays: input.streakDays,
  }
}

/** XP of the sessions whose close passes `keep` (a day, a week). */
export function earnedXp(
  sessions: { completedAt?: number; reward?: { xp: number } }[],
  keep: (completedAt: number) => boolean,
) {
  return sessions.reduce(
    (total, session) => total + (session.completedAt != null && keep(session.completedAt) ? session.reward?.xp ?? 0 : 0),
    0,
  )
}

/** A shield is earned every this many active days, ever. */
export const ACTIVE_DAYS_PER_SHIELD = 7
export const MAX_SHIELDS = 2

/**
 * The student's streak and shields, replayed from their active days (Colombia
 * day numbers), so there is no table and no cron and the answer never drifts.
 * Today not done yet changes nothing: the day is not over. A missed day spends a
 * shield if there is one (the streak survives without growing); otherwise the
 * streak starts over. `lastShieldUsedDay` is the last day a shield covered.
 */
export function streakFrom(activeDays: ReadonlySet<number>, today: number) {
  let streakDays = 0
  let shields = 0
  let activeCount = 0
  let lastShieldUsedDay: number | null = null
  if (activeDays.size === 0) return { streakDays, shields, lastShieldUsedDay }
  for (let day = Math.min(...activeDays); day <= today; day += 1) {
    if (activeDays.has(day)) {
      streakDays += 1
      activeCount += 1
      if (activeCount % ACTIVE_DAYS_PER_SHIELD === 0) shields = Math.min(MAX_SHIELDS, shields + 1)
    } else if (day !== today) {
      if (shields > 0) {
        shields -= 1
        lastShieldUsedDay = day
      } else streakDays = 0
    }
  }
  return { streakDays, shields, lastShieldUsedDay }
}

/**
 * What one session did to the streak: the active days without its answers
 * (`before`) and with them (`after`). Only the first session of a day moves
 * the count or earns a shield.
 */
export function sessionStreak(before: ReadonlySet<number>, after: ReadonlySet<number>, today: number) {
  const was = streakFrom(before, today)
  const is = streakFrom(after, today)
  return { streakDays: is.streakDays, previousStreakDays: was.streakDays, shieldEarned: is.shields > was.shields }
}

/** From this hour (Colombia) an untouched day reads as a streak to look after. */
export const STREAK_RISK_HOUR = 17

/** Late in the day, a streak alive and nothing done yet: Hoy says how to keep it. */
export function isStreakAtRisk(input: { streakDays: number; practicedToday: boolean; nowMs: number }) {
  return input.streakDays > 0 && !input.practicedToday && colombiaHour(input.nowMs) >= STREAK_RISK_HOUR
}

/** Days since the last active one that make Hoy start soft. */
export const COMEBACK_DAYS = 3

export function isComeback(lastActiveDay: number | null, today: number) {
  return lastActiveDay != null && today - lastActiveDay >= COMEBACK_DAYS
}

/**
 * This calendar week, Monday to Sunday, for Hoy's strip. A past day without
 * practice stays `open`, never "missed" (G5).
 */
export function weekStrip(activeDays: ReadonlySet<number>, today: number) {
  const monday = colombiaMonday(today)
  return Array.from({ length: 7 }, (_, index) => {
    const day = monday + index
    const status = activeDays.has(day) ? 'done' as const
      : day === today ? 'today' as const
        : day < today ? 'open' as const
          : 'upcoming' as const
    return { day, status, isToday: day === today }
  })
}

const FIRST_WEEK_DAYS = 7

/**
 * The first week's path (F58), from the days with a completed session: day 1 is
 * the first such day. Past days without practice stay `open`, never "missed"
 * (G5); `committed` is the commitment step, taken before the first session.
 */
export function firstWeekPath(sessionDays: number[], today: number, committed: boolean) {
  if (sessionDays.length === 0) return { active: true, committed, days: [] }
  const firstDay = Math.min(...sessionDays)
  const done = new Set(sessionDays)
  return {
    active: today < firstDay + FIRST_WEEK_DAYS,
    committed,
    days: Array.from({ length: FIRST_WEEK_DAYS }, (_, index) => {
      const date = firstDay + index
      const status = done.has(date) ? 'done' as const
        : date === today ? 'today' as const
          : date < today ? 'open' as const
            : 'upcoming' as const
      return { day: index + 1, status }
    }),
  }
}

/**
 * The album: one numbered sticker per subtopic, in taxonomy order. `competente`
 * or above earns it, `dominado` makes it shiny. Levels only: an aggregate from
 * before levels existed carries none, and a sticker is never a guess.
 */
export function buildStickerAlbum(aggregates: { subtopicId?: string; masteryLevel?: MasteryLevel }[]) {
  const levelBySubtopic = new Map(aggregates.map((aggregate) => [aggregate.subtopicId, aggregate.masteryLevel]))
  let number = 0
  const subjects = taxonomyContract.subjects.map((subject) => {
    const stickers = subject.categories.flatMap((category) => category.subtopics).map((subtopic) => {
      const level = levelBySubtopic.get(subtopic.id)
      number += 1
      return {
        number,
        subtopicId: subtopic.id,
        label: subtopic.label_es,
        earned: level === 'competente' || level === 'dominado',
        shiny: level === 'dominado',
      }
    })
    return {
      subjectId: subject.id,
      label: subject.label_es,
      stickers,
      earnedCount: stickers.filter((sticker) => sticker.earned).length,
    }
  })
  return {
    subjects,
    total: number,
    earnedCount: subjects.reduce((sum, subject) => sum + subject.earnedCount, 0),
  }
}

/** Closed part ids of the sticker portrait: the web draws one SVG per id, nothing is uploaded. */
export const AVATAR_PARTS = {
  skin: ['tono1', 'tono2', 'tono3', 'tono4', 'tono5', 'tono6'],
  hair: ['corto', 'liso', 'rizado', 'afro', 'trenzas', 'recogido', 'rapado'],
  top: ['camiseta', 'buso', 'uniforme', 'chaqueta'],
  accessory: ['ninguno', 'gafas', 'audifonos', 'gorra'],
} as const

export function isValidAvatar(avatar: { skin: string; hair: string; top: string; accessory: string }) {
  return (Object.keys(AVATAR_PARTS) as (keyof typeof AVATAR_PARTS)[])
    .every((part) => (AVATAR_PARTS[part] as readonly string[]).includes(avatar[part]))
}

/** Reviewed for Colombian double meanings (G4): see the denylist in `rewards.test.ts`. */
export const NOUNS = [
  'Cóndor', 'Colibrí', 'Jaguar', 'Delfín', 'Tucán', 'Búho', 'Puma', 'Tiburón',
  'Cometa', 'Volcán', 'Trueno', 'Relámpago', 'Brújula', 'Faro', 'Cohete', 'Planeta',
  'Galaxia', 'Aurora', 'Cumbre', 'Selva', 'Páramo', 'Cascada', 'Río', 'Nevado',
] as const

/** Same form in masculine and feminine, so any noun pairs with any adjective. */
export const ADJECTIVES = [
  'Veloz', 'Audaz', 'Tenaz', 'Brillante', 'Constante', 'Valiente',
  'Fugaz', 'Gigante', 'Imparable', 'Noble', 'Leal', 'Ágil', 'Libre', 'Firme', 'Genial', 'Radiante',
] as const

/** The nickname for a noun and an adjective, or null if either is off the lists. */
export function nicknameFrom(noun: string, adjective: string): string | null {
  const inLists = (NOUNS as readonly string[]).includes(noun) && (ADJECTIVES as readonly string[]).includes(adjective)
  return inLists ? `${noun} ${adjective}` : null
}
