import { describe, expect, it } from 'vitest'
import { safeNext, welcomeReturn } from '../lib/safe-next'

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

describe('welcomeReturn', () => {
  it('goes back to where the student was', () => {
    expect(welcomeReturn('/path')).toBe('/path')
  })

  // The guard can record `/diagnostic` itself while the route is changing.
  it('never sends a placed student back to the diagnostic', () => {
    expect(welcomeReturn('/diagnostic')).toBe('/today')
    expect(welcomeReturn('/diagnostic?x=1')).toBe('/today')
  })

  it('falls back to Hoy, and refuses other sites', () => {
    expect(welcomeReturn(undefined)).toBe('/today')
    expect(welcomeReturn('//evil.example')).toBe('/app')
  })
})
