import { describe, expect, test } from 'bun:test'
import { SESSION_KIND_CONFIG } from '../src/sessionKinds'
import type { MasteryLevel } from '../src/mastery'
import { RETEST_INTERVAL_DAYS, buildStudyPlan, type StudyPlanInput } from '../src/studyPlan'

const TODAY = 20_000
const SUBJECTS = ['lectura_critica', 'matematicas', 'ciencias_naturales', 'sociales_ciudadanas', 'ingles']

function placedAreas(score = 50) {
  return SUBJECTS.map((subjectId) => ({ subjectId, score, hasEnoughEvidence: true, isPlaced: true }))
}

function subtopic(
  subtopicId: string,
  subjectId: string,
  masteryScore: number,
  masteryLevel?: MasteryLevel,
) {
  const correctCount = Math.round(masteryScore * 6)
  return { subtopicId, subjectId, masteryScore, attemptCount: 6, correctCount, ...(masteryLevel ? { masteryLevel } : {}) }
}

function input(overrides: Partial<StudyPlanInput> = {}): StudyPlanInput {
  return {
    today: TODAY,
    examDay: null,
    areas: placedAreas(),
    subtopics: [],
    launchableSubtopics: [],
    reviewDueCount: 0,
    // A recent full simulacro, so most tests are not about the baseline.
    simulacroSittings: [
      { day: TODAY - 4, sessionNumber: 1 },
      { day: TODAY - 3, sessionNumber: 2 },
    ],
    weeklyGoalMinutes: 180,
    ...overrides,
  }
}

const kinds = (plan: ReturnType<typeof buildStudyPlan>) => plan.tasks.map((task) => task.kind)

describe('buildStudyPlan — placement first', () => {
  test('a pending nivelación leads, heaviest area first, with a launchable action', () => {
    const areas = placedAreas().map((area) =>
      area.subjectId === 'ingles' || area.subjectId === 'matematicas'
        ? { ...area, score: null, hasEnoughEvidence: false, isPlaced: false }
        : area,
    )
    const plan = buildStudyPlan(input({ areas, subtopics: [subtopic('mat_a', 'matematicas', 0.2)] }))
    const first = plan.tasks[0]
    expect(first?.kind).toBe('nivelacion')
    expect(first?.action).toEqual({ type: 'session', kind: 'nivelacion', subjectId: 'matematicas' })
    expect(first?.minutes).toBe(SESSION_KIND_CONFIG.nivelacion.timeLimitMs! / 60_000)
    // One nivelación a day.
    expect(kinds(plan).filter((kind) => kind === 'nivelacion')).toHaveLength(1)
  })

  test('an area with enough practice evidence does not need a nivelación', () => {
    const areas = placedAreas().map((area) =>
      area.subjectId === 'ingles' ? { ...area, isPlaced: false } : area,
    )
    expect(kinds(buildStudyPlan(input({ areas })))).not.toContain('nivelacion')
  })
})

describe('buildStudyPlan — simulacros', () => {
  test('baseline simulacro when there has never been one', () => {
    const plan = buildStudyPlan(
      input({ simulacroSittings: [], reviewDueCount: 4, subtopics: [subtopic('mat_a', 'matematicas', 0.2)] }),
    )
    expect(plan.tasks[0]?.kind).toBe('simulacro')
    expect(plan.tasks[0]?.action).toEqual({ type: 'session', kind: 'simulacro', simulacroSessionNumber: 1 })
    expect(plan.tasks[0]?.reason).toContain('punto de partida')
  })

  test('a due simulacro does not take the day: the weak block still follows', () => {
    const plan = buildStudyPlan(
      input({ simulacroSittings: [], reviewDueCount: 4, subtopics: [subtopic('mat_a', 'matematicas', 0.2)] }),
    )
    expect(kinds(plan)).toEqual(['simulacro', 'lesson', 'practice', 'repaso'])
    expect(plan.tasks[2]?.action).toEqual({ type: 'session', kind: 'topic', subtopicId: 'mat_a' })
  })

  test('Sesión 2 follows Sesión 1, on a later day', () => {
    const sameDay = buildStudyPlan(input({ simulacroSittings: [{ day: TODAY, sessionNumber: 1 }] }))
    expect(kinds(sameDay)).not.toContain('simulacro')

    const nextDay = buildStudyPlan(input({ simulacroSittings: [{ day: TODAY - 1, sessionNumber: 1 }] }))
    expect(nextDay.tasks[0]?.action).toEqual({ type: 'session', kind: 'simulacro', simulacroSessionNumber: 2 })
    expect(nextDay.tasks[0]?.title).toContain('Sesión 2')
    expect(nextDay.tasks[0]?.reason).toContain('Inglés')
  })

  test('only both sittings reset the retest clock', () => {
    const plan = buildStudyPlan(
      input({
        simulacroSittings: [
          { day: TODAY - 60, sessionNumber: 1 },
          { day: TODAY - 59, sessionNumber: 2 },
          { day: TODAY - 5, sessionNumber: 1 },
        ],
      }),
    )
    expect(plan.tasks[0]?.action).toEqual({ type: 'session', kind: 'simulacro', simulacroSessionNumber: 2 })
  })

  test('no baseline while a nivelación is pending', () => {
    const areas = placedAreas().map((area) =>
      area.subjectId === 'ingles' ? { ...area, score: null, hasEnoughEvidence: false, isPlaced: false } : area,
    )
    expect(kinds(buildStudyPlan(input({ areas, simulacroSittings: [] })))).not.toContain('simulacro')
  })

  test('retest about every four weeks', () => {
    const full = (day: number) => [
      { day: day - 1, sessionNumber: 1 },
      { day, sessionNumber: 2 },
    ]
    const due = buildStudyPlan(input({ simulacroSittings: full(TODAY - RETEST_INTERVAL_DAYS) }))
    expect(due.tasks[0]?.action).toEqual({ type: 'session', kind: 'simulacro', simulacroSessionNumber: 1 })
    expect(due.tasks[0]?.reason).toContain(`${RETEST_INTERVAL_DAYS} días`)

    const recent = buildStudyPlan(input({ simulacroSittings: full(TODAY - RETEST_INTERVAL_DAYS + 1) }))
    expect(kinds(recent)).not.toContain('simulacro')
  })
})

describe('buildStudyPlan — weak areas by global points', () => {
  test('a moderately weak subtopic in a ×3 area beats a weaker one in Inglés', () => {
    const plan = buildStudyPlan(
      input({
        areas: placedAreas(40).map((area) => (area.subjectId === 'ingles' ? { ...area, score: 20 } : area)),
        subtopics: [subtopic('ing_a', 'ingles', 0.1, 'intentado'), subtopic('mat_a', 'matematicas', 0.5, 'familiar')],
      }),
    )
    const practice = plan.tasks.find((task) => task.kind === 'practice')
    expect(practice?.action).toEqual({ type: 'session', kind: 'topic', subtopicId: 'mat_a' })
  })

  test('the lower area level wins between equally weighted areas', () => {
    const plan = buildStudyPlan(
      input({
        areas: placedAreas(70).map((area) =>
          area.subjectId === 'ciencias_naturales' ? { ...area, score: 30 } : area,
        ),
        subtopics: [subtopic('mat_a', 'matematicas', 0.4, 'intentado'), subtopic('cn_a', 'ciencias_naturales', 0.4, 'intentado')],
      }),
    )
    expect(plan.tasks[0]?.action).toEqual({ type: 'lesson', subtopicId: 'cn_a' })
  })

  test('a barely started subtopic gets the lesson before the practice', () => {
    const plan = buildStudyPlan(input({ subtopics: [subtopic('mat_a', 'matematicas', 0.2, 'intentado')] }))
    expect(plan.tasks[0]).toMatchObject({ kind: 'lesson', action: { type: 'lesson', subtopicId: 'mat_a' } })
    expect(plan.tasks[1]).toMatchObject({ kind: 'practice', action: { type: 'session', kind: 'topic', subtopicId: 'mat_a' } })
  })

  test('a familiar subtopic goes straight to practice', () => {
    const plan = buildStudyPlan(input({ subtopics: [subtopic('mat_a', 'matematicas', 0.6, 'familiar')] }))
    expect(plan.tasks[0]?.kind).toBe('practice')
  })

  test('a subtopic never asked yet is a candidate, and gets the lesson first', () => {
    const plan = buildStudyPlan(
      input({
        subtopics: [subtopic('mat_a', 'matematicas', 0.3, 'intentado')],
        launchableSubtopics: [
          { subtopicId: 'mat_a', subjectId: 'matematicas' },
          { subtopicId: 'mat_new', subjectId: 'matematicas' },
          { subtopicId: 'ing_new', subjectId: 'ingles' },
        ],
      }),
    )
    expect(plan.tasks[0]).toMatchObject({ kind: 'lesson', action: { type: 'lesson', subtopicId: 'mat_new' } })
    expect(plan.tasks[1]?.action).toEqual({ type: 'session', kind: 'topic', subtopicId: 'mat_new' })
    // An unstarted subtopic is not "practiced" for the reto.
    expect(kinds(plan)).not.toContain('reto')
  })

  test('competente and dominado subtopics are not weak-area work', () => {
    const plan = buildStudyPlan(
      input({ subtopics: [subtopic('mat_a', 'matematicas', 0.8, 'competente'), subtopic('mat_b', 'matematicas', 0.9, 'dominado')] }),
    )
    expect(plan.tasks.some((task) => 'subtopicId' in task.action)).toBe(false)
    // The day still has work: the weakest area as a whole, and a mixed practice.
    expect(plan.tasks.map((task) => task.id)).toEqual(['practice:lectura_critica', 'recommended'])
  })
})

describe('buildStudyPlan — interleave, review and budget', () => {
  const mixed = [
    subtopic('mat_a', 'matematicas', 0.2, 'intentado'),
    subtopic('lc_a', 'lectura_critica', 0.6, 'familiar'),
    subtopic('cn_a', 'ciencias_naturales', 0.8, 'competente'),
  ]

  test('a quick win on a familiar subtopic follows the weak block', () => {
    const plan = buildStudyPlan(input({ subtopics: mixed }))
    expect(kinds(plan).slice(0, 3)).toEqual(['lesson', 'practice', 'practice'])
    expect(plan.tasks[2]).toMatchObject({
      quickWin: true,
      action: { type: 'session', kind: 'topic', subtopicId: 'lc_a' },
    })
    expect(plan.tasks[2]?.reason).toContain('Competente')
  })

  test('the quick win is the familiar subtopic closest to Competente', () => {
    const plan = buildStudyPlan(
      input({
        subtopics: [
          subtopic('mat_a', 'matematicas', 0.2, 'intentado'),
          subtopic('mat_far', 'matematicas', 0.55, 'familiar'),
          subtopic('mat_near', 'matematicas', 0.95, 'familiar'),
        ],
        weeklyGoalMinutes: 1200,
      }),
    )
    expect(plan.tasks.find((task) => task.quickWin)?.action).toEqual({
      type: 'session',
      kind: 'topic',
      subtopicId: 'mat_near',
    })
  })

  test('the quick win is never the weak block itself', () => {
    const plan = buildStudyPlan(input({ subtopics: [subtopic('lc_a', 'lectura_critica', 0.6, 'familiar')] }))
    expect(plan.tasks.filter((task) => task.quickWin)).toHaveLength(0)
  })

  test('repaso only when something is due', () => {
    expect(kinds(buildStudyPlan(input({ subtopics: mixed, weeklyGoalMinutes: 1200 })))).not.toContain('repaso')
    const plan = buildStudyPlan(input({ subtopics: mixed, reviewDueCount: 3, weeklyGoalMinutes: 1200 }))
    expect(plan.tasks.find((task) => task.kind === 'repaso')?.action).toEqual({ type: 'session', kind: 'repaso' })
    expect(plan.tasks.find((task) => task.kind === 'repaso')?.reason).toContain('3')
  })

  test('the weekly goal sets how much fits in a day, between two and four tasks', () => {
    const light = buildStudyPlan(input({ subtopics: mixed, reviewDueCount: 5, weeklyGoalMinutes: 30 }))
    expect(light.tasks).toHaveLength(2)

    const heavy = buildStudyPlan(input({ subtopics: mixed, reviewDueCount: 5, weeklyGoalMinutes: 1200 }))
    expect(heavy.tasks).toHaveLength(4)
  })

  test('a reto once there are enough practiced subtopics to re-test', () => {
    const practiced = [
      subtopic('cn_a', 'ciencias_naturales', 0.8, 'competente'),
      subtopic('lc_a', 'lectura_critica', 0.6, 'familiar'),
      subtopic('mat_a', 'matematicas', 0.9, 'dominado'),
    ]
    const plan = buildStudyPlan(input({ subtopics: practiced, weeklyGoalMinutes: 1200 }))
    expect(plan.tasks.find((task) => task.kind === 'reto')?.action).toEqual({ type: 'session', kind: 'reto' })

    const tooFew = buildStudyPlan(input({ subtopics: practiced.slice(0, 2), weeklyGoalMinutes: 1200 }))
    expect(kinds(tooFew)).not.toContain('reto')
    expect(tooFew.tasks.find((task) => task.id === 'recommended')?.action).toEqual({ type: 'session', kind: 'recommended' })
  })

  test('a subtopic without a stored level falls back to its accuracy', () => {
    const plan = buildStudyPlan(input({ subtopics: [subtopic('mat_a', 'matematicas', 0.2)] }))
    expect(plan.tasks[0]?.kind).toBe('lesson')
  })

  test('with nothing measured yet it still proposes two things to do', () => {
    const plan = buildStudyPlan(
      input({ areas: placedAreas(60).map((area) => (area.subjectId === 'matematicas' ? { ...area, score: 30 } : area)) }),
    )
    expect(plan.tasks[0]?.action).toEqual({ type: 'session', kind: 'topic', subjectId: 'matematicas' })
    expect(plan.tasks.length).toBeGreaterThanOrEqual(2)
    expect(plan.tasks.every((task) => task.minutes > 0 && task.reason.length > 0)).toBe(true)
  })

  test('task ids are unique', () => {
    const plan = buildStudyPlan(input({ subtopics: mixed, reviewDueCount: 5, weeklyGoalMinutes: 1200 }))
    expect(new Set(plan.tasks.map((task) => task.id)).size).toBe(plan.tasks.length)
  })
})

describe('buildStudyPlan — the last days before the exam', () => {
  const heavyDay = {
    simulacroSittings: [],
    reviewDueCount: 4,
    subtopics: [subtopic('mat_a', 'matematicas', 0.2, 'intentado'), subtopic('lc_a', 'lectura_critica', 0.6, 'familiar')],
    areas: placedAreas().map((area) =>
      area.subjectId === 'ingles' ? { ...area, score: null, hasEnoughEvidence: false, isPlaced: false } : area,
    ),
  }

  test.each([0, 1, 2])('%i days out: nothing heavy, only review and a quick win', (daysOut) => {
    const plan = buildStudyPlan(input({ ...heavyDay, examDay: TODAY + daysOut }))
    expect(kinds(plan)).toEqual(['repaso', 'practice'])
    expect(plan.tasks[1]?.quickWin).toBe(true)
  })

  test('three days out the normal plan applies', () => {
    const plan = buildStudyPlan(input({ ...heavyDay, examDay: TODAY + 3 }))
    expect(plan.tasks[0]?.kind).toBe('nivelacion')
  })

  test('after the exam the plan ignores the date', () => {
    const plan = buildStudyPlan(input({ ...heavyDay, examDay: TODAY - 1 }))
    expect(plan.tasks[0]?.kind).toBe('nivelacion')
  })
})
