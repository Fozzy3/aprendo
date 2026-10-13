import { describe, expect, it } from 'vitest'
import { safeNext } from '../lib/safe-next'

describe('safeNext', () => {
  it('keeps a path inside the app, with its query', () => {
    expect(safeNext('/join?codigo=ABCD2345')).toBe('/join?codigo=ABCD2345')
  })

  it('refuses anything that could leave the site', () => {
    expect(safeNext('https://evil.example')).toBe('/app')
    expect(safeNext('//evil.example')).toBe('/app')
    expect(safeNext('/\\evil.example')).toBe('/app')
    expect(safeNext(undefined)).toBe('/app')
  })
})
