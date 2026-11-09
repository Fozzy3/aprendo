import { describe, expect, test } from 'bun:test'
import {
  ADJECTIVES,
  AVATAR_PARTS,
  DAILY_XP_CAP,
  MIN_ANSWER_MS,
  NOUNS,
  XP_PER_ANSWER,
  XP_PER_GUIDED_PATH,
  buildStickerAlbum,
  computeReward,
  earnedXp,
  firstWeekPath,
  isValidAvatar,
  nicknameFrom,
  streakFrom,
} from '../src/rewards'

const noPrior = { xpEarnedToday: 0, streakDays: 3, earnedMedals: ['primera_sesion'] }
const answer = (timeMs: number | null, guided: Partial<{ guidedOutcome: 'self_corrected' | 'revealed'; guidedSkipped: boolean; guidedStep: number }> = {}) =>
  ({ timeMs, ...(guided.guidedOutcome == null ? {} : { guidedStep: 2 }), ...guided })

describe('computeReward', () => {
  test('pays each answer that took at least the minimum time', () => {
    const reward = computeReward({ ...noPrior, answers: [answer(MIN_ANSWER_MS), answer(MIN_ANSWER_MS - 1), answer(60_000)] })
    expect(reward.xp).toBe(2 * XP_PER_ANSWER)
  })

  test('an answer with no recorded time pays nothing', () => {
    expect(computeReward({ ...noPrior, answers: [answer(null)] }).xp).toBe(0)
  })

  test('a finished guided path earns on top of the answer; jumping to the answer does not', () => {
    const finished = computeReward({ ...noPrior, answers: [answer(10_000, { guidedOutcome: 'self_corrected' })] })
    const revealedAtEnd = computeReward({ ...noPrior, answers: [answer(10_000, { guidedOutcome: 'revealed' })] })
    const skipped = computeReward({ ...noPrior, answers: [answer(10_000, { guidedOutcome: 'revealed', guidedSkipped: true })] })
    expect(finished.xp).toBe(XP_PER_ANSWER + XP_PER_GUIDED_PATH)
    expect(revealedAtEnd.xp).toBe(XP_PER_ANSWER + XP_PER_GUIDED_PATH)
    expect(skipped.xp).toBe(XP_PER_ANSWER)
  })

  test('a retry with no steps walked earns neither the path nor its medal', () => {
    const noSteps = computeReward({ ...noPrior, answers: [answer(10_000, { guidedOutcome: 'revealed', guidedStep: undefined })] })
    expect(noSteps.xp).toBe(XP_PER_ANSWER)
    expect(noSteps.medals).toEqual([])
  })

  test('the daily cap trims what is left, and never goes negative', () => {
    const answers = Array.from({ length: 10 }, () => answer(10_000))
    expect(computeReward({ ...noPrior, answers, xpEarnedToday: DAILY_XP_CAP - 15 }).xp).toBe(15)
    expect(computeReward({ ...noPrior, answers, xpEarnedToday: DAILY_XP_CAP + 50 }).xp).toBe(0)
  })

  test('a right and a wrong answer pay the same: the input has no correctness', () => {
    const correct = { ...answer(10_000), isCorrect: true }
    const wrong = { ...answer(10_000), isCorrect: false }
    expect(computeReward({ ...noPrior, answers: [correct] })).toEqual(computeReward({ ...noPrior, answers: [wrong] }))
  })

  test('carries the streak it was given', () => {
    expect(computeReward({ ...noPrior, streakDays: 9, answers: [] }).streakDays).toBe(9)
  })

  describe('medals', () => {
    test('the first session with an answer gets its medal, once', () => {
      const first = computeReward({ xpEarnedToday: 0, streakDays: 1, earnedMedals: [], answers: [answer(10_000)] })
      expect(first.medals).toEqual(['primera_sesion'])
      const blank = computeReward({ xpEarnedToday: 0, streakDays: 1, earnedMedals: [], answers: [] })
      expect(blank.medals).toEqual([])
    })

    test('streak medals land on the session that reaches them and never repeat', () => {
      expect(computeReward({ ...noPrior, streakDays: 7, answers: [answer(10_000)] }).medals).toEqual(['racha_7'])
      expect(computeReward({ ...noPrior, streakDays: 8, earnedMedals: ['primera_sesion', 'racha_7'], answers: [answer(10_000)] }).medals).toEqual([])
    })

    test('finishing a guided path gets its medal; skipping does not', () => {
      expect(computeReward({ ...noPrior, answers: [answer(10_000, { guidedOutcome: 'revealed' })] }).medals).toEqual(['camino_terminado'])
      expect(computeReward({ ...noPrior, answers: [answer(10_000, { guidedOutcome: 'revealed', guidedSkipped: true })] }).medals).toEqual([])
    })
  })
})

describe('earnedXp', () => {
  test('sums the reward of sessions whose close passes the filter', () => {
    const sessions = [
      { completedAt: 100, reward: { xp: 30 } },
      { completedAt: 200, reward: { xp: 20 } },
      { completedAt: 300 },
      { reward: { xp: 99 } },
    ]
    expect(earnedXp(sessions, (at) => at >= 200)).toBe(20)
  })
})

describe('streakFrom', () => {
  const days = (...list: number[]) => new Set(list)

  test('no activity, no streak', () => {
    expect(streakFrom(days(), 100)).toEqual({ streakDays: 0, shields: 0 })
  })

  test('today not yet done keeps yesterday’s streak alive', () => {
    expect(streakFrom(days(98, 99), 100).streakDays).toBe(2)
  })

  test('a gap with no shield is a fresh start', () => {
    expect(streakFrom(days(95, 96, 99, 100), 100).streakDays).toBe(2)
  })

  test('without a shield a missed yesterday ends it, as Hoy always said', () => {
    expect(streakFrom(days(97, 98), 100).streakDays).toBe(0)
  })

  test('earns a shield every 7 active days, and holds 2', () => {
    const run = (count: number) => new Set(Array.from({ length: count }, (_, index) => 100 + index))
    expect(streakFrom(run(6), 105).shields).toBe(0)
    expect(streakFrom(run(7), 106).shields).toBe(1)
    expect(streakFrom(run(14), 113).shields).toBe(2)
    expect(streakFrom(run(21), 120).shields).toBe(2)
  })

  test('a shield spends itself on a missed day and the streak survives, without growing', () => {
    const active = new Set(Array.from({ length: 7 }, (_, index) => 100 + index))
    active.add(108) // 107 missed, one shield covers it
    expect(streakFrom(active, 108)).toEqual({ streakDays: 8, shields: 0 })
  })

  test('two missed days with one shield end the streak; replay is the same every time', () => {
    const active = new Set(Array.from({ length: 7 }, (_, index) => 100 + index))
    active.add(109)
    const first = streakFrom(active, 109)
    expect(first).toEqual({ streakDays: 1, shields: 0 })
    expect(streakFrom(active, 109)).toEqual(first)
  })
})

describe('avatar and nickname', () => {
  test('an avatar is valid only with one known id per part', () => {
    const ok = { skin: AVATAR_PARTS.skin[0]!, hair: AVATAR_PARTS.hair[0]!, top: AVATAR_PARTS.top[0]!, accessory: AVATAR_PARTS.accessory[0]! }
    expect(isValidAvatar(ok)).toBe(true)
    expect(isValidAvatar({ ...ok, hair: 'javascript:alert(1)' })).toBe(false)
  })

  test('a nickname is one noun and one adjective from the closed lists', () => {
    expect(nicknameFrom(NOUNS[0]!, ADJECTIVES[0]!)).toBe(`${NOUNS[0]} ${ADJECTIVES[0]}`)
    expect(nicknameFrom('Gonorrea', ADJECTIVES[0]!)).toBeNull()
    expect(nicknameFrom(NOUNS[0]!, 'Caliente')).toBeNull()
  })

  /** G4: words with a Colombian double meaning, slur or drug/sexual sense. Add here, never remove. */
  const DENYLIST = [
    'arepa', 'bicho', 'bobo', 'bollo', 'burro', 'caliente', 'chimba', 'chucha', 'conejo', 'cuca', 'culo', 'estupido',
    'feo', 'flaco', 'gallina', 'gonorrea', 'gordo', 'gorda', 'guevon', 'huevo', 'indio', 'loca', 'loco', 'malparido',
    'mamon', 'marica', 'mico', 'mono', 'mota', 'moto', 'negro', 'pajaro', 'paloma', 'papaya', 'pato', 'pendejo',
    'pepa', 'pepino', 'perico', 'perra', 'perro', 'pipi', 'platano', 'polla', 'rata', 'rico', 'sapo', 'teta', 'tonto',
    'toto', 'vaca', 'verga', 'yuca', 'zorra', 'zorro', 'ballena', 'aguila', 'banano', 'bizcocho', 'gato', 'gata',
  ]

  test('no word on the lists carries a Colombian double meaning (G4)', () => {
    const fold = (word: string) => word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    const words = [...NOUNS, ...ADJECTIVES].map(fold)
    const hits = words.filter((word) => DENYLIST.some((bad) => word.includes(bad)))
    expect(hits).toEqual([])
  })
})

describe('buildStickerAlbum', () => {
  const aggregate = (subtopicId: string, masteryLevel?: 'familiar' | 'competente' | 'dominado') => ({
    subtopicId, attemptCount: 5, correctCount: 5, masteryLevel,
  })

  test('numbers the 33 subtopics in taxonomy order, grouped by subject', () => {
    const album = buildStickerAlbum([])
    expect(album.total).toBe(33)
    const numbers = album.subjects.flatMap((subject) => subject.stickers.map((sticker) => sticker.number))
    expect(numbers).toEqual(Array.from({ length: 33 }, (_, index) => index + 1))
    expect(album.earnedCount).toBe(0)
  })

  test('competente earns the sticker, dominado the shiny one, below is empty', () => {
    const [first, second, third] = buildStickerAlbum([]).subjects[0]!.stickers
    const album = buildStickerAlbum([
      aggregate(first!.subtopicId, 'competente'),
      aggregate(second!.subtopicId, 'dominado'),
      aggregate(third!.subtopicId, 'familiar'),
    ])
    expect(album.earnedCount).toBe(2)
    expect(album.subjects[0]!.earnedCount).toBe(2)
    const [a, b, c] = album.subjects[0]!.stickers
    expect(a).toMatchObject({ earned: true, shiny: false })
    expect(b).toMatchObject({ earned: true, shiny: true })
    expect(c).toMatchObject({ earned: false, shiny: false })
  })

  test('an aggregate without a level is never a sticker, however right it was', () => {
    const [first] = buildStickerAlbum([]).subjects[0]!.stickers
    expect(buildStickerAlbum([aggregate(first!.subtopicId)]).earnedCount).toBe(0)
  })
})

describe('firstWeekPath', () => {
  test('before any session there is only the commitment step', () => {
    expect(firstWeekPath([], 100, false)).toEqual({ active: true, committed: false, days: [] })
  })

  test('counts seven days from the first completed session and marks what was done', () => {
    const path = firstWeekPath([100, 101, 104], 104, true)
    expect(path.active).toBe(true)
    expect(path.committed).toBe(true)
    expect(path.days.map((day) => day.status)).toEqual(['done', 'done', 'open', 'open', 'done', 'upcoming', 'upcoming'])
    expect(path.days.map((day) => day.day)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  test('today not done yet is today, never a miss', () => {
    expect(firstWeekPath([100], 102, true).days.map((day) => day.status).slice(0, 3)).toEqual(['done', 'open', 'today'])
  })

  test('ends after the seventh day', () => {
    expect(firstWeekPath([100], 107, true).active).toBe(false)
    expect(firstWeekPath([100], 106, true).active).toBe(true)
  })

  test('no status tells the student they failed (G5)', () => {
    const statuses = firstWeekPath([100, 103], 105, true).days.map((day) => day.status)
    expect(statuses).not.toContain('missed')
    expect(statuses).not.toContain('lost')
  })
})
