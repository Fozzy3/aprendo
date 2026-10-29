import { describe, expect, test } from 'bun:test'
import { CAREER_FAMILIES, INTEREST_ITEMS, careerScore, careerWeights, suggestFamilies } from '../src/careers'

describe('career families', () => {
  test('every family with its own profile weighs the five areas to 100', () => {
    for (const family of CAREER_FAMILIES) {
      const total = Object.values(careerWeights(family.id)!).reduce((sum, weight) => sum + weight, 0)
      expect(Math.round(total)).toBe(100)
    }
  })

  test('an unknown id has no weights; Artes uses the official global weights', () => {
    expect(careerWeights('astronauta')).toBeNull()
    expect(careerWeights('artes')).toMatchObject({ matematicas: 300 / 13, ingles: 100 / 13 })
  })
})

describe('suggestFamilies', () => {
  test('the two strongest RIASEC types suggest their families, in a stable order', () => {
    const answers = Object.fromEntries(INTEREST_ITEMS.map((item) => [item.id, 0]))
    for (const item of INTEREST_ITEMS.filter((entry) => entry.type === 'I' || entry.type === 'S')) answers[item.id] = 2
    const families = suggestFamilies(answers)
    expect(families[0]).toBe('salud')
    expect(families.length).toBeGreaterThanOrEqual(2)
    expect(families.length).toBeLessThanOrEqual(3)
  })
})

describe('careerScore', () => {
  test('is the weighted mean of the five areas, null while one is missing', () => {
    const areas = [
      { subjectId: 'ciencias_naturales', score: 60 },
      { subjectId: 'lectura_critica', score: 50 },
      { subjectId: 'matematicas', score: 40 },
      { subjectId: 'sociales_ciudadanas', score: 70 },
      { subjectId: 'ingles', score: 80 },
    ]
    // Salud 30/25/20/15/10: 18 + 12.5 + 8 + 10.5 + 8 = 57.
    expect(careerScore('salud', areas)).toBe(57)
    expect(careerScore('salud', areas.slice(1))).toBeNull()
    expect(careerScore(null, areas)).toBeNull()
  })
})

describe('setCareerFamily', () => {
  test('a student sets and clears their own career; never another student’s, never an unknown id', async () => {
    const { setupTest, signUp } = await import('./signIn')
    const { api } = await import('../src/_generated/api')
    const t = setupTest()
    const ana = await signUp(t, 'ana@x.co')
    const beto = await signUp(t, 'beto@x.co')
    await ana.as.mutation(api.students.setCareerFamily, { studentId: ana.studentId, careerFamily: 'derecho' })
    expect((await t.run((ctx) => ctx.db.get('students', ana.studentId)))?.careerFamily).toBe('derecho')
    await ana.as.mutation(api.students.setCareerFamily, { studentId: ana.studentId, careerFamily: null })
    expect((await t.run((ctx) => ctx.db.get('students', ana.studentId)))?.careerFamily).toBeUndefined()
    await expect(beto.as.mutation(api.students.setCareerFamily, { studentId: ana.studentId, careerFamily: 'salud' })).rejects.toThrow()
    await expect(ana.as.mutation(api.students.setCareerFamily, { studentId: ana.studentId, careerFamily: 'astronauta' })).rejects.toThrow()
  })
})
