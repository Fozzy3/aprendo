import { describe, expect, it } from 'vitest'
import { shouldReloadForNewDeploy } from '../lib/stale-deploy.ts'

describe('shouldReloadForNewDeploy', () => {
  it('reloads the first time a code file of an old deploy is missing', () => {
    expect(shouldReloadForNewDeploy(null, 1_000_000)).toBe(true)
  })

  it('does not reload again right after a reload, so a truly missing file cannot loop', () => {
    expect(shouldReloadForNewDeploy(1_000_000, 1_005_000)).toBe(false)
  })

  it('reloads again for a later deploy', () => {
    expect(shouldReloadForNewDeploy(1_000_000, 1_000_000 + 60_000)).toBe(true)
  })
})
