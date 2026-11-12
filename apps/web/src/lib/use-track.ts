import { useConvexMutation } from '@convex-dev/react-query'
import { useCallback } from 'react'
import type { FunctionArgs } from 'convex/server'
import { api } from '@aprendo/convex/api'
import type { Id } from '@aprendo/convex/dataModel'

type TrackArgs = FunctionArgs<typeof api.events.track>

/**
 * Pilot measurement (`events.track`): fire and forget. A lost event never
 * reaches the screen, and without a student it does nothing.
 */
export function useTrack(studentId: Id<'students'> | undefined) {
  const track = useConvexMutation(api.events.track)
  return useCallback(
    (name: TrackArgs['name'], props?: TrackArgs['props']) => {
      if (studentId == null) return
      Promise.resolve()
        .then(() => track({ studentId, name, props }))
        .catch(() => {})
    },
    [studentId, track],
  )
}
