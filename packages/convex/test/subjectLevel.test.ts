import { describe, expect, test } from 'bun:test'
import { DEFAULT_RATING, expectedScore } from '../src/elo'
import { MIN_ATTEMPTS_FOR_LEVEL, getLevelForScore } from '../src/levels'
import { buildSubjectLevel } from '../src/path'
import { areaScore } from '../src/progress'

const calibrated = {
  abilityBySubject: { matematicas: 1235 },
  abilityAttemptsBySubject: { matematicas: MIN_ATTEMPTS_FOR_LEVEL },
}
const aggregate = { accuracy: 0.45, attemptCount: MIN_ATTEMPTS_FOR_LEVEL }

describe('areaScore', () => {
  test('prefers the Elo estimate once it has enough attempts', () => {
    expect(areaScore('matematicas', 0.45, calibrated)).toEqual({
      score: Math.round(expectedScore(1235, DEFAULT_RATING) * 100),
      isCalibrated: true,
    })
  })

  test('falls back to raw accuracy while the Elo is thin', () => {
    const thin = { ...calibrated, abilityAttemptsBySubject: { matematicas: MIN_ATTEMPTS_FOR_LEVEL - 1 } }
    expect(areaScore('matematicas', 0.45, thin)).toEqual({ score: 45, isCalibrated: false })
    expect(areaScore('matematicas', 0.45, null)).toEqual({ score: 45, isCalibrated: false })
  })
})

describe('path buildSubjectLevel', () => {
  // 45% on hard questions with an Elo worth 55: Ruta said Nivel 2 while
  // Progreso and Hoy said Nivel 3 for the same area.
  test('reports the same score and level as Progreso', () => {
    const level = buildSubjectLevel('matematicas', aggregate, calibrated)
    const progress = areaScore('matematicas', aggregate.accuracy, calibrated)
    expect(level.score).toBe(progress.score)
    expect(level.placement).toEqual(getLevelForScore('matematicas', progress.score))
  })
})
