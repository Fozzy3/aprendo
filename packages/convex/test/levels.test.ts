import { describe, expect, test } from 'bun:test'
import {
  LEVELLED_SUBJECT_IDS,
  MIN_ATTEMPTS_FOR_LEVEL,
  estimatedScoreFromAccuracy,
  getLevelForScore,
  getSubjectLevels,
} from '../src/levels'

describe('levels contract', () => {
  test('covers the five ICFES areas', () => {
    expect(LEVELLED_SUBJECT_IDS.sort()).toEqual([
      'ciencias_naturales',
      'ingles',
      'lectura_critica',
      'matematicas',
      'sociales_ciudadanas',
    ])
  })

  test('every area starts at 0 and has ascending, gapless bands', () => {
    for (const subjectId of LEVELLED_SUBJECT_IDS) {
      const subject = getSubjectLevels(subjectId)
      expect(subject).not.toBeUndefined()
      expect(subject!.bands.length).toBeGreaterThanOrEqual(4)
      expect(subject!.bands[0]!.minScore).toBe(0)

      for (let index = 1; index < subject!.bands.length; index += 1) {
        expect(subject!.bands[index]!.minScore).toBeGreaterThan(
          subject!.bands[index - 1]!.minScore,
        )
      }
    }
  })

  test('English uses the CEFR bands, not numeric levels', () => {
    const ingles = getSubjectLevels('ingles')
    expect(ingles?.scale).toBe('cefr')
    expect(ingles?.bands.map((band) => band.id)).toEqual(['PreA1', 'A1', 'A2', 'B1'])
  })

  // Pinned against the official ICFES level sheets published 2025-09-22
  // (icfes.gov.co/wp-content/uploads/2025/09/22-septiembre-nd-prueba-<area>-saber-11.pdf).
  // These numbers are shown to students as their ICFES level: they must never
  // drift by accident. Update this table only alongside a new official sheet.
  test('cut points match the official ICFES level sheets', () => {
    const official: Record<string, number[]> = {
      lectura_critica: [0, 36, 51, 66],
      matematicas: [0, 36, 51, 71],
      ciencias_naturales: [0, 41, 56, 71],
      sociales_ciudadanas: [0, 41, 56, 71],
      ingles: [0, 37, 58, 71],
    }

    for (const [subjectId, cutPoints] of Object.entries(official)) {
      expect(getSubjectLevels(subjectId)?.bands.map((band) => band.minScore)).toEqual(cutPoints)
    }
  })
})

describe('getLevelForScore', () => {
  test('places a score in the band it falls in', () => {
    expect(getLevelForScore('lectura_critica', 20)?.band.id).toBe('1')
    expect(getLevelForScore('lectura_critica', 40)?.band.id).toBe('2')
    expect(getLevelForScore('lectura_critica', 55)?.band.id).toBe('3')
    expect(getLevelForScore('lectura_critica', 90)?.band.id).toBe('4')
  })

  test('a band boundary belongs to the higher band (minScore is inclusive)', () => {
    const subject = getSubjectLevels('matematicas')!
    for (const band of subject.bands) {
      expect(getLevelForScore('matematicas', band.minScore)?.band.id).toBe(band.id)
      if (band.minScore > 0) {
        expect(getLevelForScore('matematicas', band.minScore - 1)?.band.id).not.toBe(band.id)
      }
    }
  })

  test('reports how many points are missing for the next band', () => {
    const placement = getLevelForScore('lectura_critica', 45)
    expect(placement?.band.id).toBe('2')
    expect(placement?.nextBand?.id).toBe('3')
    expect(placement?.pointsToNextBand).toBe(6) // 51 - 45
  })

  test('the top band has no next band', () => {
    const placement = getLevelForScore('lectura_critica', 100)
    expect(placement?.nextBand).toBeNull()
    expect(placement?.pointsToNextBand).toBeNull()
  })

  test('clamps scores outside 0-100 instead of falling off the scale', () => {
    expect(getLevelForScore('matematicas', -20)?.index).toBe(1)
    expect(getLevelForScore('matematicas', 500)?.index).toBe(
      getSubjectLevels('matematicas')!.bands.length,
    )
  })

  test('returns null for an unknown subject', () => {
    expect(getLevelForScore('musica', 50)).toBeNull()
  })
})

describe('estimatedScoreFromAccuracy', () => {
  test('maps accuracy onto the 0-100 scale', () => {
    expect(estimatedScoreFromAccuracy(0)).toBe(0)
    expect(estimatedScoreFromAccuracy(0.634)).toBe(63)
    expect(estimatedScoreFromAccuracy(1)).toBe(100)
  })

  test('clamps out-of-range accuracy', () => {
    expect(estimatedScoreFromAccuracy(-1)).toBe(0)
    expect(estimatedScoreFromAccuracy(2)).toBe(100)
  })
})

describe('evidence gate', () => {
  test('requires a meaningful number of attempts before claiming a level', () => {
    // Guards the product rule: a level invented from two questions is worse
    // than no level, because the student will believe it.
    expect(MIN_ATTEMPTS_FOR_LEVEL).toBeGreaterThanOrEqual(10)
  })
})
