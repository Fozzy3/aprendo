import { describe, expect, it } from 'vitest'
import { areaChartRow, levelDistribution, weakestCompetencies } from '../lib/progress-display.ts'

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
