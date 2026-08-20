import { describe, expect, test } from 'bun:test'
import {
  getNationalPercentileAtOrBelow,
  getNationalShare,
  getSubjectNationalResults,
} from '../src/national'
import { LEVELLED_SUBJECT_IDS, getSubjectLevels } from '../src/levels'

describe('national results contract', () => {
  test('covers the same five areas as the levels contract', () => {
    for (const subjectId of LEVELLED_SUBJECT_IDS) {
      expect(getSubjectNationalResults(subjectId)).not.toBeUndefined()
    }
  })

  // The whole point of the contract is that it lines up with the level bands.
  // A share tagged with a band that does not exist would silently never match.
  test('every recorded share names a band that exists in that subject', () => {
    for (const subjectId of LEVELLED_SUBJECT_IDS) {
      const bandIds = getSubjectLevels(subjectId)!.bands.map((band) => band.id)
      for (const share of getSubjectNationalResults(subjectId)!.shares) {
        expect(bandIds).toContain(share.bandId)
      }
    }
  })

  test('shares are plausible percentages', () => {
    for (const subjectId of LEVELLED_SUBJECT_IDS) {
      for (const share of getSubjectNationalResults(subjectId)!.shares) {
        expect(share.percent).toBeGreaterThan(0)
        expect(share.percent).toBeLessThanOrEqual(100)
        expect(share.source.length).toBeGreaterThan(0)
      }
    }
  })

  test('a subject marked complete must actually sum to 100 across all its bands', () => {
    for (const subjectId of LEVELLED_SUBJECT_IDS) {
      const subject = getSubjectNationalResults(subjectId)!
      if (!subject.complete) continue

      const bandIds = getSubjectLevels(subjectId)!.bands.map((band) => band.id)
      expect(subject.shares.map((share) => share.bandId).sort()).toEqual([...bandIds].sort())
      const total = subject.shares.reduce((sum, share) => sum + share.percent, 0)
      expect(total).toBeGreaterThanOrEqual(99)
      expect(total).toBeLessThanOrEqual(101)
    }
  })
})

describe('getNationalShare', () => {
  test('returns a share the report states in prose', () => {
    const share = getNationalShare('lectura_critica', '2')
    expect(share?.percent).toBe(48)
    expect(share?.year).toBe(2024)
  })

  test('returns null for a band the report does not pin down', () => {
    expect(getNationalShare('lectura_critica', '4')).toBeNull()
    expect(getNationalShare('sociales_ciudadanas', '1')).toBeNull()
  })

  test('returns null for an unknown subject', () => {
    expect(getNationalShare('filosofia', '1')).toBeNull()
  })
})

describe('getNationalPercentileAtOrBelow', () => {
  // This is the guard that matters: with partial data, summing what exists
  // would flatter the student ("ahead of 48%") using a country that is missing
  // three of its four levels.
  test('refuses to derive a percentile from an incomplete distribution', () => {
    expect(
      getNationalPercentileAtOrBelow({
        subjectId: 'lectura_critica',
        bandId: '2',
        orderedBandIds: ['1', '2', '3', '4'],
      }),
    ).toBeNull()
  })

  test('returns null for an unknown subject or band', () => {
    expect(
      getNationalPercentileAtOrBelow({
        subjectId: 'filosofia',
        bandId: '1',
        orderedBandIds: ['1'],
      }),
    ).toBeNull()
    expect(
      getNationalPercentileAtOrBelow({
        subjectId: 'lectura_critica',
        bandId: 'Z',
        orderedBandIds: ['1', '2', '3', '4'],
      }),
    ).toBeNull()
  })
})
