import { describe, expect, it } from 'vitest'
import type { StudyTaskAction } from '@aprendo/convex/studyPlan'
import { areaRows, comebackLaunch, dueLabel, hoursToGoalMinutes, targetGapLines, taskSessionArgs, taskTarget, timedIntro } from '../lib/today-display'

describe('dueLabel', () => {
  const monday = new Date(2026, 10, 9, 10).getTime()
  const on = (day: number) => new Date(2026, 10, day, 18).getTime()

  it('names the close dates in words', () => {
    expect(dueLabel(on(9), monday)).toBe('vence hoy')
    expect(dueLabel(on(10), monday)).toBe('vence mañana')
  })

  it('names a later date by its weekday', () => {
    expect(dueLabel(on(13), monday)).toBe('para el viernes 13')
  })

  // G5: no red "vencida". A task still listed is one that can still be done.
  it('does not scold a late task', () => {
    expect(dueLabel(on(8), monday)).toBe('todavía puedes hacerla')
  })
})

describe('taskSessionArgs', () => {
  it('drops the action type and keeps what createSession takes', () => {
    expect(taskSessionArgs({ type: 'session', kind: 'topic', subtopicId: 'x' })).toEqual({
      kind: 'topic',
      subtopicId: 'x',
    })
    expect(
      taskSessionArgs({ type: 'session', kind: 'simulacro', simulacroSessionNumber: 1 }),
    ).toEqual({ kind: 'simulacro', simulacroSessionNumber: 1 })
  })
})

describe('timedIntro', () => {
  it('stops a timed task at the intro, with its questions and clock', () => {
    expect(timedIntro({ type: 'session', kind: 'nivelacion', subjectId: 'matematicas' })).toEqual({
      questionCount: 15,
      timeLimitMs: 30 * 60_000,
    })
    expect(timedIntro({ type: 'session', kind: 'simulacro', simulacroSessionNumber: 1 })).toEqual({
      questionCount: 120,
      timeLimitMs: 270 * 60_000,
    })
  })

  it('times an area simulacro at the official pace', () => {
    expect(timedIntro({ type: 'session', kind: 'simulacro', subjectId: 'matematicas' })?.questionCount).toBe(50)
  })

  it('lets untimed practice start straight away', () => {
    expect(timedIntro({ type: 'session', kind: 'topic', subtopicId: 'x' })).toBeNull()
    expect(timedIntro({ type: 'session', kind: 'repaso' })).toBeNull()
    expect(timedIntro({ type: 'session', kind: 'reto' })).toBeNull()
  })
})

describe('hoursToGoalMinutes', () => {
  it('converts the hours a student types into whole minutes', () => {
    expect(hoursToGoalMinutes('3')).toBe(180)
    expect(hoursToGoalMinutes('1,5')).toBe(90)
    expect(hoursToGoalMinutes('2.25')).toBe(135)
  })

  it('rejects anything outside the backend range', () => {
    expect(hoursToGoalMinutes('0.25')).toBeNull()
    expect(hoursToGoalMinutes('21')).toBeNull()
    expect(hoursToGoalMinutes('')).toBeNull()
    expect(hoursToGoalMinutes('abc')).toBeNull()
  })
})

const base = {
  estimate: { score: 290, margin: 20, low: 270, high: 310, attemptCount: 300 },
  target: 330,
  gap: 40,
  weeksRemaining: 8,
  pointsPerWeek: null,
  onTrack: null,
  areaGaps: null,
}

describe('targetGapLines', () => {
  it('invites a target when there is none', () => {
    expect(targetGapLines({ ...base, target: null, gap: null }, 60)).toEqual({
      headline: 'Ponte una meta de puntaje global',
      detail: 'Con una meta, Hoy te dice cuánto te falta y si vas a tiempo.',
      verdict: null,
    })
  })

  it('shows the gap and the weekly pace it needs, with no verdict before three weeks of data', () => {
    expect(targetGapLines(base, 60)).toEqual({
      headline: 'Te faltan 40 puntos para tu meta de 330',
      detail: 'Quedan 8 semanas: unos 5 puntos por semana.',
      verdict: null,
    })
  })

  it('leaves the pace out without an exam date', () => {
    expect(targetGapLines({ ...base, weeksRemaining: null }, null)?.detail).toBe(
      'Pon la fecha de tu examen para saber a qué ritmo subir.',
    )
  })

  it('tells a student whose exam already passed to update the date, with no verdict', () => {
    expect(
      targetGapLines({ ...base, weeksRemaining: null, pointsPerWeek: 4, onTrack: false }, -1),
    ).toEqual({
      headline: 'Te faltan 40 puntos para tu meta de 330',
      detail: 'Tu examen ya pasó: actualiza la fecha si vas a presentarlo de nuevo.',
      verdict: null,
    })
  })

  it('gives no verdict in the light days before the exam, when the plan says rest', () => {
    for (const daysRemaining of [0, 1, 2]) {
      const lines = targetGapLines(
        { ...base, weeksRemaining: daysRemaining === 0 ? 0 : 1, pointsPerWeek: 4, onTrack: false, gap: 20 },
        daysRemaining,
      )
      expect(lines?.verdict).toBeNull()
      expect(lines?.detail).toBe('Tu examen ya está encima: repasa lo que ya sabes y descansa.')
    }
  })

  it('gives the verdict only when the backend has one', () => {
    expect(targetGapLines({ ...base, pointsPerWeek: 6, onTrack: true }, 60)?.verdict).toEqual({
      onTrack: true,
      text: 'Vas a tiempo: subes unos 6 puntos por semana.',
    })
    expect(targetGapLines({ ...base, pointsPerWeek: -2, onTrack: false }, 60)?.verdict).toEqual({
      onTrack: false,
      text: 'A tu ritmo actual (-2 puntos por semana) no llegas. Sube la dosis de práctica.',
    })
  })

  it('celebrates a reached target', () => {
    expect(targetGapLines({ ...base, gap: 0 }, 60)?.headline).toBe('Ya alcanzaste tu meta de 330')
  })

  it('returns null without an estimate', () => {
    expect(targetGapLines({ ...base, estimate: null }, 60)).toBeNull()
  })
})

describe('taskTarget', () => {
  const task = (kind: string, action: object) => ({ kind, action }) as Parameters<typeof taskTarget>[0]

  it('opens a lesson task on its lesson', () => {
    expect(taskTarget(task('lesson', { type: 'lesson', subtopicId: 'x' }))).toEqual({ type: 'lesson', subtopicId: 'x' })
  })

  // Timed sessions start behind an intro, which lives where they are chosen.
  it('sends a nivelación to the placement screen and a simulacro to Retos', () => {
    expect(taskTarget(task('nivelacion', { type: 'session', kind: 'nivelacion', subjectId: 'ingles' }))).toEqual({ type: 'link', to: '/diagnostic' })
    expect(taskTarget(task('simulacro', { type: 'session', kind: 'simulacro', simulacroSessionNumber: 1 }))).toEqual({ type: 'link', to: '/practice' })
  })

  it('starts any other session on the tap', () => {
    expect(taskTarget(task('practice', { type: 'session', kind: 'topic', subtopicId: 'x' }))).toEqual({
      type: 'launch',
      args: { kind: 'topic', subtopicId: 'x' },
    })
  })
})

describe('areaRows', () => {
  const album = {
    subjects: [
      { subjectId: 'matematicas', label: 'Matemáticas', earnedCount: 2, stickers: [{}, {}, {}, {}] },
      { subjectId: 'ingles', label: 'Inglés', earnedCount: 0, stickers: [{}, {}] },
    ],
  }
  const subjects = [
    { subjectId: 'ingles', level: { placement: { band: { labelEs: 'A2' } } } },
    { subjectId: 'matematicas', level: { placement: null } },
  ]

  it('counts topics at Competente or above, in the album order, with the area level', () => {
    expect(areaRows(album, subjects)).toEqual([
      { subjectId: 'matematicas', label: 'Matemáticas', done: 2, total: 4, level: null },
      { subjectId: 'ingles', label: 'Inglés', done: 0, total: 2, level: 'A2' },
    ])
  })

  it('still lists the areas while the levels load', () => {
    expect(areaRows(album, undefined).map((row) => row.level)).toEqual([null, null])
  })
})

describe('comebackLaunch', () => {
  const task = (action: StudyTaskAction) => ({ action })

  it('starts with five of the review when something is due', () => {
    expect(comebackLaunch([
      task({ type: 'session', kind: 'topic', subtopicId: 'a' }),
      task({ type: 'session', kind: 'repaso' }),
    ])).toEqual({ kind: 'repaso', questionLimit: 5 })
  })

  it('else five questions of the plan’s first topic', () => {
    expect(comebackLaunch([
      task({ type: 'lesson', subtopicId: 'b' }),
      task({ type: 'session', kind: 'topic', subtopicId: 'b' }),
    ])).toEqual({ kind: 'topic', subtopicId: 'b', questionLimit: 5 })
  })

  it('never a timed sitting: without a topic, the five of the recommended practice', () => {
    expect(comebackLaunch([task({ type: 'session', kind: 'simulacro', simulacroSessionNumber: 1 })])).toEqual({ kind: 'recommended' })
    expect(comebackLaunch([])).toEqual({ kind: 'recommended' })
  })
})
