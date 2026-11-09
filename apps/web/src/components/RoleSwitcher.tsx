import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '@aprendo/convex/api'
import { studentAppStateQuery } from '../lib/student-queries.ts'
import { useCurrentStudent } from '../lib/student-session.ts'

type AppState = NonNullable<FunctionReturnType<typeof api.students.getStudentAppState>>
export type AccountRole = AppState['roles'][number]

const LINK_CLASS = 'btn-ghost text-xs no-underline'

/** For an account with more than one side: a link to each one it is not on. */
export function RoleSwitcher({ current }: { current: AccountRole }) {
  const { session } = useCurrentStudent()
  const appState = useQuery({ ...studentAppStateQuery(session?.studentId), enabled: session != null })
  return (appState.data?.roles ?? [])
    .filter((role) => role !== current)
    .map((role) => {
      if (role === 'student') return <Link key={role} to="/today" className={LINK_CLASS}>Modo estudiante</Link>
      if (role === 'teacher') return <Link key={role} to="/teacher" className={LINK_CLASS}>Panel docente</Link>
      if (role === 'admin') return <Link key={role} to="/admin" className={LINK_CLASS}>Equipo Aprendo</Link>
      return <Link key={role} to="/admin" search={{ tab: 'audit' }} className={LINK_CLASS}>Auditoría</Link>
    })
}
