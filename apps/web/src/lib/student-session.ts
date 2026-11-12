import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@aprendo/convex/api'
import type { Id } from '@aprendo/convex/dataModel'
import { authClient } from './auth-client.ts'

export interface ActiveStudentSession {
  studentId: Id<'students'>
  email: string
  name: string | null
}

export function useCurrentStudent() {
  const auth = authClient.useSession()
  const result = useQuery(convexQuery(api.auth.getCurrentStudent, {}))
  // `expectAuth` holds the Convex socket until a token arrives, so without a
  // session this query never answers and only the session read can settle it.
  const signedOut = !auth.isPending && auth.error == null && auth.data == null

  // Memoized on its fields: effects list `session` as a dependency, and a fresh
  // object every render re-ran them forever (the student guard's `navigate`).
  const student = signedOut ? null : result.data
  const studentId = student?._id
  const email = student?.email
  const name = student?.name
  const session = useMemo<ActiveStudentSession | null>(
    () => (studentId == null ? null : { studentId, email: email as string, name: name ?? null }),
    [studentId, email, name],
  )

  return {
    session,
    isReady: signedOut || !result.isPending,
    isLoading: !signedOut && result.isPending,
    /** The read failed: a null `session` then means "unknown", not signed out. */
    isError: result.isError,
  }
}
