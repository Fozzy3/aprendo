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
  MEDAL_LABELS,
  firstWeekPath,
  isComeback,
  isStreakAtRisk,
  isValidAvatar,
  nicknameFrom,
  sessionStreak,
  streakFrom,
  streakMilestone,
  weekStrip,
} from '../src/rewards'
import { colombiaDayNumber, colombiaDayStartMs } from '../src/colombiaTime'

const noPrior = { xpEarnedToday: 0, streakDays: 2, earnedMedals: ['primera_sesion'] }
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
      expect(computeReward({ ...noPrior, streakDays: 3, answers: [answer(10_000)] }).medals).toEqual(['racha_3'])
      const earned = ['primera_sesion', 'racha_3']
      expect(computeReward({ ...noPrior, streakDays: 7, earnedMedals: earned, answers: [answer(10_000)] }).medals).toEqual(['racha_7'])
      expect(computeReward({ ...noPrior, streakDays: 14, earnedMedals: [...earned, 'racha_7'], answers: [answer(10_000)] }).medals).toEqual(['racha_14'])
      expect(computeReward({ ...noPrior, streakDays: 8, earnedMedals: [...earned, 'racha_7'], answers: [answer(10_000)] }).medals).toEqual([])
    })

    test('every streak medal has its name', () => {
      expect(MEDAL_LABELS.racha_3).toBe('Tres días seguidos')
      expect(MEDAL_LABELS.racha_14).toBe('Catorce días seguidos')
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
    expect(streakFrom(days(), 100)).toEqual({ streakDays: 0, shields: 0, lastShieldUsedDay: null })
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
    expect(streakFrom(active, 108)).toEqual({ streakDays: 8, shields: 0, lastShieldUsedDay: 107 })
  })

  test('two missed days with one shield end the streak; replay is the same every time', () => {
    const active = new Set(Array.from({ length: 7 }, (_, index) => 100 + index))
    active.add(109)
    const first = streakFrom(active, 109)
    expect(first).toEqual({ streakDays: 1, shields: 0, lastShieldUsedDay: 107 })
    expect(streakFrom(active, 109)).toEqual(first)
  })

  test('remembers the last day a shield covered, not an earlier one', () => {
    // 100-106 earn a shield, 107 spends it; 108-114 earn another, 115 spends it.
    const active = new Set([...Array.from({ length: 7 }, (_, index) => 100 + index), ...Array.from({ length: 7 }, (_, index) => 108 + index), 116])
    expect(streakFrom(active, 116)).toEqual({ streakDays: 15, shields: 0, lastShieldUsedDay: 115 })
  })
})

describe('sessionStreak', () => {
  const run = (count: number, from = 100) => new Set(Array.from({ length: count }, (_, index) => from + index))

  test('the first session of the day moves the streak up by one', () => {
    expect(sessionStreak(run(3), run(4), 103)).toEqual({ streakDays: 4, previousStreakDays: 3, shieldEarned: false })
  })

  test('a later session the same day changes nothing', () => {
    expect(sessionStreak(run(4), run(4), 103)).toEqual({ streakDays: 4, previousStreakDays: 4, shieldEarned: false })
  })

  test('the seventh active day earns a shield', () => {
    expect(sessionStreak(run(6), run(7), 106)).toEqual({ streakDays: 7, previousStreakDays: 6, shieldEarned: true })
  })

  test('no shield past the cap of two', () => {
    expect(sessionStreak(run(20), run(21), 120).shieldEarned).toBe(false)
  })
})

describe('streakMilestone', () => {
  test('3, 7, 14 and 30 are moments when the streak reaches them', () => {
    expect([[2, 3], [6, 7], [13, 14], [29, 30]].map(([before, after]) => streakMilestone(before!, after!))).toEqual([3, 7, 14, 30])
  })

  test('anything else, or a streak that did not move, is not', () => {
    expect(streakMilestone(3, 4)).toBeNull()
    expect(streakMilestone(7, 7)).toBeNull()
    expect(streakMilestone(0, 1)).toBeNull()
  })
})

describe('weekStrip', () => {
  // Day 0 was a Thursday, so day 20_404 is a Wednesday and its Monday is 20_402.
  const wednesday = 20_404

  test('runs Monday to Sunday and marks what was done, today and what is to come', () => {
    const strip = weekStrip(new Set([20_402, 20_400]), wednesday)
    expect(strip.map((entry) => entry.day)).toEqual([20_402, 20_403, 20_404, 20_405, 20_406, 20_407, 20_408])
    expect(strip.map((entry) => entry.status)).toEqual(['done', 'open', 'today', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(strip.filter((entry) => entry.isToday).map((entry) => entry.day)).toEqual([wednesday])
  })

  test('today done is done; a past day without practice is never a miss (G5)', () => {
    const statuses = weekStrip(new Set([wednesday]), wednesday).map((entry) => entry.status)
    expect(statuses[2]).toBe('done')
    expect(statuses).not.toContain('missed')
  })

  test('Monday and Sunday sit in their own week', () => {
    expect(weekStrip(new Set(), 20_402)[0]?.isToday).toBe(true)
    expect(weekStrip(new Set(), 20_408)[6]?.isToday).toBe(true)
  })
})

describe('isStreakAtRisk', () => {
  const at = (hour: number) => colombiaDayStartMs(20_405) + hour * 3_600_000

  test('from 5 p.m. Colombia, with a streak and nothing done today', () => {
    expect(isStreakAtRisk({ streakDays: 4, practicedToday: false, nowMs: at(17) })).toBe(true)
    expect(isStreakAtRisk({ streakDays: 4, practicedToday: false, nowMs: at(23.9) })).toBe(true)
  })

  test('not before 5 p.m., not once practised, not without a streak', () => {
    expect(isStreakAtRisk({ streakDays: 4, practicedToday: false, nowMs: at(16.9) })).toBe(false)
    expect(isStreakAtRisk({ streakDays: 4, practicedToday: true, nowMs: at(18) })).toBe(false)
    expect(isStreakAtRisk({ streakDays: 0, practicedToday: false, nowMs: at(18) })).toBe(false)
    expect(colombiaDayNumber(at(23.9))).toBe(20_405)
  })
})

describe('isComeback', () => {
  test('three days or more since the last active day', () => {
    expect(isComeback(97, 100)).toBe(true)
    expect(isComeback(80, 100)).toBe(true)
  })

  test('not after one or two days off, and never for a student with no activity', () => {
    expect(isComeback(98, 100)).toBe(false)
    expect(isComeback(100, 100)).toBe(false)
    expect(isComeback(null, 100)).toBe(false)
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
