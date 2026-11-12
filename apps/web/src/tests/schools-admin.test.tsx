// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ queries: {} as Record<string, unknown>, calls: [] as [string, unknown][] }))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => ({ queryKey: [getFunctionName(ref), args] }),
  useConvexMutation: (ref: Parameters<typeof getFunctionName>[0]) => async (args: unknown) => {
    state.calls.push([getFunctionName(ref), args])
    return null
  },
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: { queryKey: [string] }) => state.queries[options.queryKey[0]] ?? { isPending: true, data: undefined },
  useMutation: ({ mutationFn }: { mutationFn: (variables: unknown) => Promise<unknown> }) => ({
    isPending: false,
    error: null,
    isSuccess: false,
    mutate: (variables: unknown) => void mutationFn(variables),
  }),
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const organization = (leagueEnabled: boolean) => ({
  _id: 'o1', name: 'Piloto', plan: 'pilot', seatLimit: 40, seatsUsed: 3, licenseEndsAt: Date.UTC(2027, 0, 1),
  licenseActive: true, adminEmails: ['a@x.co'], leagueEnabled,
})

let container: HTMLElement
let root: Root

beforeEach(() => {
  state.calls = []
  container = document.createElement('main')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('SchoolsAdmin', () => {
  it('turns a school’s league on and off from its row', async () => {
    state.queries['schools:listOrganizations'] = { isPending: false, data: [organization(false)] }
    const { SchoolsAdmin } = await import('../components/admin/SchoolsAdmin.tsx')
    await act(async () => root.render(<SchoolsAdmin />))
    const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Liga de Piloto"]')!
    expect(toggle.checked).toBe(false)
    await act(async () => toggle.click())
    expect(state.calls).toContainEqual(['measurement:setSchoolLeague', { orgId: 'o1', enabled: true }])

    state.queries['schools:listOrganizations'] = { isPending: false, data: [organization(true)] }
    await act(async () => root.render(<SchoolsAdmin />))
    await act(async () => container.querySelector<HTMLInputElement>('input[aria-label="Liga de Piloto"]')!.click())
    expect(state.calls).toContainEqual(['measurement:setSchoolLeague', { orgId: 'o1', enabled: false }])
  })
})
