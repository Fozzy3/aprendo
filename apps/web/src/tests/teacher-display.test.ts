import { describe, expect, it } from 'vitest'
import { belowShareLabel, conversationOpener, familyWeeklyMessage, guidedShareLabel, lastActivityLabel, riskLabel, studentDisplayName } from '../lib/teacher-display'
import { duelOutcome } from '../lib/duel-display'

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

describe('familyWeeklyMessage', () => {
  it('names the class and the week topics, and no student', () => {
    const message = familyWeeklyMessage({ className: '11A', topics: ['Funciones', 'Proporciones'] })
    expect(message).toContain('11A')
    expect(message).toContain('Funciones y Proporciones')
  })

  it('still reads as a message in a week with no shared topic', () => {
    expect(familyWeeklyMessage({ className: '9B', topics: [] })).toContain('9B')
  })
})

describe('guidedShareLabel', () => {
  it('stays quiet until there are enough guided paths to mean anything', () => {
    expect(guidedShareLabel({ guidedCount: 4, revealedCount: 4 })).toBeNull()
  })

  it('says how many needed the answer shown', () => {
    expect(guidedShareLabel({ guidedCount: 10, revealedCount: 4 })).toBe('4 de 10 caminos guiados (40%) necesitaron que se les mostrara la respuesta')
  })
})

describe('duelOutcome', () => {
  it('names the team that won, and says a draw is a draw', () => {
    expect(duelOutcome([{ name: 'Cóndores', score: 5 }, { name: 'Jaguares', score: 3 }])).toBe('Ganó Cóndores')
    expect(duelOutcome([{ name: 'Cóndores', score: 4 }, { name: 'Jaguares', score: 4 }])).toBe('Empate')
  })
})
