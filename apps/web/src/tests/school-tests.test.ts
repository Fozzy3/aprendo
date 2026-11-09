import { describe, expect, it } from 'vitest'
import { statusNote } from '../components/SchoolTests.tsx'

const round = { hasOpened: true, questionCount: 30, doneCount: 3, targetCount: 4 } as Parameters<typeof statusNote>[0]

describe('statusNote', () => {
  it('counts who sat a recent round', () => {
    expect(statusNote(round)).toBe('3 de 4 la presentaron')
  })

  it('an older round the list did not count says only its size', () => {
    expect(statusNote({ ...round, doneCount: null, targetCount: null })).toBe('30 preguntas')
  })

  it('one not yet open says so', () => {
    expect(statusNote({ ...round, hasOpened: false })).toBe('30 preguntas, aún no abre')
  })
})
