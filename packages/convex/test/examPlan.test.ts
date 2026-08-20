import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_SESSIONS_PER_WEEK,
  buildExamPlan,
  daysUntilExam,
  examPhase,
  isPaceEnough,
  observedSessionsPerWeek,
} from '../src/examPlan'

const DAY_MS = 24 * 60 * 60 * 1000
/** 2026-08-20 12:00 Colombia time, expressed in UTC. */
const NOON_BOGOTA = Date.UTC(2026, 7, 20, 17, 0, 0)

describe('daysUntilExam', () => {
  test('exam day itself is zero', () => {
    expect(daysUntilExam(NOON_BOGOTA, NOON_BOGOTA)).toBe(0)
  })

  test('counts whole Colombia days ahead', () => {
    expect(daysUntilExam(NOON_BOGOTA + 30 * DAY_MS, NOON_BOGOTA)).toBe(30)
  })

  test('goes negative once the exam is behind', () => {
    expect(daysUntilExam(NOON_BOGOTA - 2 * DAY_MS, NOON_BOGOTA)).toBe(-2)
  })

  // The reason this uses Colombia days and not `(a - b) / DAY_MS`: a student
  // checking at 11pm Bogotá must not be told the exam is a day further away
  // than a student checking at 1am, and the rollover has to be local midnight.
  test('rolls over at Colombia midnight, not at UTC midnight', () => {
    // 2026-08-20 23:00 Bogotá is already 2026-08-21 04:00 UTC.
    const lateNightBogota = Date.UTC(2026, 7, 21, 4, 0, 0)
    // 2026-08-21 08:00 Bogotá, the next Colombia day.
    const nextMorningBogota = Date.UTC(2026, 7, 21, 13, 0, 0)
    const exam = Date.UTC(2026, 7, 25, 17, 0, 0)

    expect(daysUntilExam(exam, lateNightBogota)).toBe(5)
    expect(daysUntilExam(exam, nextMorningBogota)).toBe(4)
  })

  test('the time of day within a Colombia day does not change the count', () => {
    const exam = NOON_BOGOTA + 10 * DAY_MS
    const earlyBogota = Date.UTC(2026, 7, 20, 6, 0, 0) // 01:00 Bogotá
    const lateBogota = Date.UTC(2026, 7, 21, 3, 0, 0) // 22:00 Bogotá, same day
    expect(daysUntilExam(exam, earlyBogota)).toBe(daysUntilExam(exam, lateBogota))
  })
})

describe('examPhase', () => {
  test('maps the countdown onto phases, boundaries included', () => {
    expect(examPhase(120)).toBe('far')
    expect(examPhase(91)).toBe('far')
    expect(examPhase(90)).toBe('approaching')
    expect(examPhase(31)).toBe('approaching')
    expect(examPhase(30)).toBe('final_stretch')
    expect(examPhase(8)).toBe('final_stretch')
    expect(examPhase(7)).toBe('imminent')
    expect(examPhase(0)).toBe('imminent')
    expect(examPhase(-1)).toBe('past')
  })
})

describe('buildExamPlan', () => {
  test('projects a session budget from the observed rhythm', () => {
    const plan = buildExamPlan({
      examDateMs: NOON_BOGOTA + 28 * DAY_MS,
      nowMs: NOON_BOGOTA,
      sessionsPerWeek: 4,
    })
    expect(plan.daysRemaining).toBe(28)
    expect(plan.weeksRemaining).toBe(4)
    expect(plan.projectedSessions).toBe(16)
  })

  test('rounds partial weeks up — a 10-day run is 2 planning weeks', () => {
    const plan = buildExamPlan({
      examDateMs: NOON_BOGOTA + 10 * DAY_MS,
      nowMs: NOON_BOGOTA,
      sessionsPerWeek: 3,
    })
    expect(plan.weeksRemaining).toBe(2)
  })

  // A student on day one has no rhythm yet. Projecting zero sessions would make
  // every target unreachable and every recommendation pointless.
  test('falls back to the default goal when there is no rhythm yet', () => {
    for (const rhythm of [null, undefined, 0, -2]) {
      const plan = buildExamPlan({
        examDateMs: NOON_BOGOTA + 7 * DAY_MS,
        nowMs: NOON_BOGOTA,
        sessionsPerWeek: rhythm,
      })
      expect(plan.projectedSessions).toBe(DEFAULT_SESSIONS_PER_WEEK)
    }
  })

  test('a past exam has no remaining budget', () => {
    const plan = buildExamPlan({
      examDateMs: NOON_BOGOTA - 3 * DAY_MS,
      nowMs: NOON_BOGOTA,
      sessionsPerWeek: 5,
    })
    expect(plan.phase).toBe('past')
    expect(plan.weeksRemaining).toBe(0)
    expect(plan.projectedSessions).toBe(0)
  })
})

describe('isPaceEnough', () => {
  test('a student already at their target is always on pace', () => {
    expect(isPaceEnough({ pointsNeeded: 0, projectedSessions: 0, pointsPerSession: 0 })).toBe(true)
    expect(isPaceEnough({ pointsNeeded: -5, projectedSessions: 1, pointsPerSession: 1 })).toBe(true)
  })

  test('compares the budget against the gap', () => {
    expect(
      isPaceEnough({ pointsNeeded: 40, projectedSessions: 20, pointsPerSession: 2 }),
    ).toBe(true)
    expect(
      isPaceEnough({ pointsNeeded: 41, projectedSessions: 20, pointsPerSession: 2 }),
    ).toBe(false)
  })

  test('no sessions left means no, not a division by zero', () => {
    expect(
      isPaceEnough({ pointsNeeded: 10, projectedSessions: 0, pointsPerSession: 5 }),
    ).toBe(false)
  })
})

describe('observedSessionsPerWeek', () => {
  test('a student active every day is at 7 per week', () => {
    expect(
      observedSessionsPerWeek({
        activeDayCount: 14,
        firstActivityMs: NOON_BOGOTA - 13 * DAY_MS,
        nowMs: NOON_BOGOTA,
      }),
    ).toBeCloseTo(7, 6)
  })

  test('measures over the observed span, not a fixed window', () => {
    // 3 days of activity in a 7-day-old account is ~3/week, not ~0.4/week.
    expect(
      observedSessionsPerWeek({
        activeDayCount: 3,
        firstActivityMs: NOON_BOGOTA - 6 * DAY_MS,
        nowMs: NOON_BOGOTA,
      }),
    ).toBeCloseTo(3, 6)
  })

  test('a brand-new student has no measurable rhythm', () => {
    expect(
      observedSessionsPerWeek({ activeDayCount: 0, firstActivityMs: null, nowMs: NOON_BOGOTA }),
    ).toBeNull()
    expect(
      observedSessionsPerWeek({
        activeDayCount: 0,
        firstActivityMs: NOON_BOGOTA,
        nowMs: NOON_BOGOTA,
      }),
    ).toBeNull()
  })

  test('a single day of activity today does not divide by a zero span', () => {
    const rhythm = observedSessionsPerWeek({
      activeDayCount: 1,
      firstActivityMs: NOON_BOGOTA,
      nowMs: NOON_BOGOTA,
    })
    expect(rhythm).toBe(7)
  })
})
