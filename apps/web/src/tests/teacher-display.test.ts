import { describe, expect, it } from 'vitest'
import { belowShareLabel, conversationOpener, lastActivityLabel, riskLabel, studentDisplayName } from '../lib/teacher-display'

describe('conversationOpener', () => {
  it('opens on the most urgent reason, with a question rather than a verdict', () => {
    expect(conversationOpener(['sin_nivelacion', 'inactivo'])).toMatch(/nivelación/)
    expect(conversationOpener(['inactivo'])).toMatch(/\?$/)
    expect(conversationOpener([])).toBe('')
  })
})

const DAY = 86_400_000
const now = Date.UTC(2026, 9, 12, 17)

describe('lastActivityLabel', () => {
  it('names the day plainly', () => {
    expect(lastActivityLabel(now - 60_000, now)).toBe('Hoy')
    expect(lastActivityLabel(now - DAY, now)).toBe('Ayer')
    expect(lastActivityLabel(now - 5 * DAY, now)).toBe('Hace 5 días')
  })

  it('never invents activity', () => {
    expect(lastActivityLabel(null, now)).toBe('Nunca')
  })
})

describe('riskLabel', () => {
  it('says why a student needs attention, in the teacher’s words', () => {
    expect(riskLabel('sin_nivelacion')).toBe('Sin nivelación')
    expect(riskLabel('inactivo')).toBe('Más de dos semanas sin practicar')
    expect(riskLabel('nivel_bajo')).toBe('Nivel 1 en al menos un área')
  })
})

describe('studentDisplayName', () => {
  it('prefers the name and falls back to the email', () => {
    expect(studentDisplayName({ name: 'Ana Pérez', email: 'ana@x.co' })).toBe('Ana Pérez')
    expect(studentDisplayName({ name: null, email: 'ana@x.co' })).toBe('ana@x.co')
  })
})

describe('belowShareLabel', () => {
  it('reads a cycle cell as count and share, and never a percentage without evidence', () => {
    expect(belowShareLabel({ belowCount: 6, evidencedCount: 10 })).toBe('6 de 10 (60%)')
    expect(belowShareLabel({ belowCount: 0, evidencedCount: 0 })).toBe('sin evidencia')
  })
})
