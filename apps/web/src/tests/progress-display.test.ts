import { describe, expect, it } from 'vitest'
import { areaChartRow, changeSincePlacement, focusSubjectId, levelDistribution, weakestCompetencies } from '../lib/progress-display.ts'

describe('focusSubjectId', () => {
  const subjects = [
    { subjectId: 'matematicas', masteryScore: 0.6 },
    { subjectId: 'ingles', masteryScore: 0.3 },
  ]

  it('is the area of the plan’s first pick: Hoy calls it Foco and Ruta opens on it', () => {
    expect(focusSubjectId([{ subjectId: 'matematicas' }], subjects)).toBe('matematicas')
  })

  it('falls back to the lowest mastery before the plan has a pick', () => {
    expect(focusSubjectId([], subjects)).toBe('ingles')
    expect(focusSubjectId([], [])).toBeNull()
  })
})

describe('changeSincePlacement', () => {
  const area = (currentScore: number | null, baselineScore: number | null, hasEnoughEvidence = true) =>
    ({ currentScore, baselineScore, hasEnoughEvidence })

  it('averages today against the nivelación over the areas that have both, as a 0-1 fraction', () => {
    // +10 and -2 on the 0-100 scale; the unlevelled and unplaced areas are left out.
    expect(changeSincePlacement([area(50, 40), area(38, 40), area(70, null), area(60, 30, false)])).toBeCloseTo(0.04)
  })

  it('is null until one area has a score to compare', () => {
    expect(changeSincePlacement([area(null, 40), area(55, null)])).toBeNull()
  })
})

describe('areaChartRow', () => {
  it('places today and the starting point on the 0-100 scale, with the ICFES cut points', () => {
    const row = areaChartRow({
      subjectId: 'lectura_critica',
      hasEnoughEvidence: true,
      currentScore: 48,
      baselineScore: 40,
      attemptCount: 30,
      current: { band: { labelEs: 'Nivel 2' }, index: 2 },
    })
    expect(row).toMatchObject({ score: 48, baseline: 40, levelLabel: 'Nivel 2', levelIndex: 2 })
    // Lectura crítica: 0-35 / 36-50 / 51-65 / 66-100.
    expect(row.cuts).toEqual([36, 51, 66])
  })

  it('says how much of the country shares the level, only where ICFES published it', () => {
    const base = {
      subjectId: 'lectura_critica',
      hasEnoughEvidence: true,
      currentScore: 48,
      baselineScore: null,
      attemptCount: 30,
      current: { band: { labelEs: 'Nivel 2' }, index: 2 },
    }
    expect(areaChartRow({ ...base, national: { shareAtThisLevel: 48, year: 2024 } }).nationalNote)
      .toBe('El 48% del país está en Nivel 2 (ICFES 2024).')
    expect(areaChartRow({ ...base, national: null }).nationalNote).toBeNull()
    expect(areaChartRow({ ...base, national: { shareAtThisLevel: 48, year: 2024 }, hasEnoughEvidence: false }).nationalNote)
      .toBeNull()
  })

  it('draws no score without enough evidence: a guessed level is worse than none', () => {
    const row = areaChartRow({
      subjectId: 'matematicas',
      hasEnoughEvidence: false,
      currentScore: 70,
      baselineScore: null,
      attemptCount: 3,
      current: null,
    })
    expect(row.score).toBeNull()
    expect(row.levelLabel).toBeNull()
  })
})

describe('levelDistribution', () => {
  it('counts the class per level in one area, with the students not levelled yet apart', () => {
    const students = [1, 1, 2, null, 4].map((levelIndex) => ({
      subjects: [{ subjectId: 'matematicas', levelIndex }, { subjectId: 'ingles', levelIndex: 3 }],
    }))
    expect(levelDistribution(students, 'matematicas')).toEqual({ none: 1, byLevel: [2, 1, 0, 1], total: 5 })
  })
})

describe('weakestCompetencies', () => {
  it('keeps the five the class misses most, worst first', () => {
    const rows = [0.8, 0.3, 0.55, 0.1, 0.9, 0.45, 0.6].map((accuracy, index) => ({ subtopicId: `t${index}`, accuracy }))
    expect(weakestCompetencies(rows).map((row) => row.subtopicId)).toEqual(['t3', 't1', 't5', 't2', 't6'])
  })
})
