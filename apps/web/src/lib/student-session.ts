import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from '@aprendo/convex/api'
import type { Id } from '@aprendo/convex/dataModel'

export interface ActiveStudentSession {
  studentId: Id<'students'>
  email: string
}

export function useCurrentStudent() {
  const result = useQuery(convexQuery(api.auth.getCurrentStudent, {}))

  const session: ActiveStudentSession | null =
    result.data == null
      ? null
      : { studentId: result.data._id, email: result.data.email }

  return {
    session,
    isReady: !result.isPending,
    isLoading: result.isPending,
  }
}
