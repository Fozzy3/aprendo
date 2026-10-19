import { describe, expect, it } from 'vitest'
import { cleanTutorReply } from '../lib/tutor-reply'

describe('cleanTutorReply', () => {
  it('drops a demo pasted as an html code block', () => {
    expect(cleanTutorReply('Mira esto:\n```html\n<div>hola</div>\n```\nListo.')).toBe('Mira esto:\n\nListo.')
  })

  it('drops a block that is still streaming', () => {
    expect(cleanTutorReply('Te lo muestro.\n```html\n<!DOCTYPE html><html><body>')).toBe('Te lo muestro.')
  })

  it('drops a whole document written as text', () => {
    expect(cleanTutorReply('Aquí va:\n<!DOCTYPE html>\n<html><style>body{}</style></html>\nPruébalo.')).toBe(
      'Aquí va:\n\nPruébalo.',
    )
    expect(cleanTutorReply('Aquí va: <html lang="es"><body>sin cerrar')).toBe('Aquí va:')
  })

  it('leaves math and comparisons alone', () => {
    const reply = 'Si $x<y$ y $y > 2$, entonces a > b. Usa ```python\nprint(1)\n``` si quieres.'
    expect(cleanTutorReply(reply)).toBe(reply)
  })
})
