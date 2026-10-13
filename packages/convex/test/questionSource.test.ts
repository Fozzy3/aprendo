import { describe, expect, test } from 'bun:test'
import { questionSource } from '../src/questionSource'

describe('questionSource', () => {
  test('an ICFES booklet is credited by name', () => {
    expect(questionSource({ slug: 'saber-11-2019', fileName: 'Cuadernillo_Matematicas-2019.pdf' })).toEqual({
      kind: 'icfes',
      label: 'ICFES · Cuadernillo Matematicas 2019',
    })
  })

  test('a question written with AI says so', () => {
    expect(questionSource({ slug: 'ai-generated', fileName: 'ai-generated' }).kind).toBe('aprendo')
  })

  test('an unknown upload is still credited to ICFES, the only booklets the bank ingests', () => {
    expect(questionSource(null)).toEqual({ kind: 'icfes', label: 'ICFES' })
  })
})
