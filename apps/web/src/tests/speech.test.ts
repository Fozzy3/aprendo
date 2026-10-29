import { describe, expect, it } from 'vitest'
import { speakableText } from '../lib/speech'

describe('speakableText', () => {
  it('reads simple math as words, not symbols', () => {
    expect(speakableText('Despeja: $x^2 + 3 = \\frac{a}{b}$')).toBe('Despeja: x al cuadrado más 3 igual a a sobre b')
    expect(speakableText('$2 \\cdot 3$ y $\\sqrt{9}$')).toBe('2 por 3 y raíz de 9')
  })

  it('drops markdown marks and keeps the words', () => {
    expect(speakableText('**Ojo:** la opción `B` es la trampa.\n\n- Primero, lee.')).toBe('Ojo: la opción B es la trampa. Primero, lee.')
  })
})
