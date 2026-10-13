import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { PencilLine, Route as RouteIcon, Sun, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { SchoolLabel } from './SchoolLabel.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { authClient } from '../lib/auth-client.ts'
import { mySchoolsQuery } from '../lib/student-queries.ts'
import type { ActiveStudentSession } from '../lib/student-session.ts'

type StudentSection =
  | 'today'
  | 'path'
  | 'syllabus'
  | 'practice'
  | 'progress'
  | 'history'

/**
 * Four nav items, six sections. Temario lives *under* Ruta (the path is the
 * recommended route, the syllabus is the full map behind it) and Historial lives
 * under Progreso, so both stay one tap away without growing the top bar.
 */
const NAV_ITEMS = [
  { to: '/today', label: 'Hoy', icon: Sun, sections: ['today'] },
  { to: '/path', label: 'Ruta', icon: RouteIcon, sections: ['path', 'syllabus'] },
  { to: '/practice', label: 'Práctica', icon: PencilLine, sections: ['practice'] },
  { to: '/progress', label: 'Progreso', icon: TrendingUp, sections: ['progress', 'history'] },
] as const satisfies ReadonlyArray<{
  to: string
  label: string
  icon: unknown
  sections: ReadonlyArray<StudentSection>
}>

export function StudentAppShell({
  session,
  activeSection,
  topBarSupplement,
  immersive = false,
  children,
}: {
  session: ActiveStudentSession
  activeSection: StudentSection
  topBarSupplement?: React.ReactNode
  /**
   * Solve and review: the page owns the whole viewport (flex down to 100dvh,
   * never a hard-coded header height) and the section nav is gone. On a phone
   * the header goes too — both screens carry their own way out.
   */
  immersive?: boolean
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const schoolsQuery = useQuery(mySchoolsQuery)
  const teaches = (schoolsQuery.data ?? []).some((school) => school.role !== 'student')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const handleSignOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      if (typeof window !== 'undefined') {
        window.location.assign('/')
      } else {
        await navigate({ to: '/' })
      }
    }
  }

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    (item.sections as ReadonlyArray<StudentSection>).includes(activeSection)

  return (
    <div className={`student-shell${immersive ? ' is-immersive' : ''}`}>
      <header className="student-topbar">
        <div className="student-topbar-inner">
          <SchoolLabel studentName={session.name} subtitle="Saber 11" />

          {immersive ? null : (
            <nav className="student-topnav" aria-label="Navegación principal">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={isActive(item) ? 'page' : undefined}
                  className={`student-topnav-item ${isActive(item) ? 'is-active' : ''}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="student-topbar-actions">
            {teaches && !immersive ? (
              <Link to="/teacher" className="btn-ghost text-xs no-underline">
                Panel docente
              </Link>
            ) : null}
            {topBarSupplement}
            <ThemeToggle />
            <Link to="/cuenta" className="btn-ghost text-xs no-underline">
              Cuenta
            </Link>
            <button
              type="button"
              disabled={isSigningOut}
              onClick={() => { void handleSignOut() }}
              className="btn-ghost text-xs"
            >
              {isSigningOut ? 'Saliendo…' : 'Salir'}
            </button>
          </div>
        </div>
      </header>

      <main className="student-shell-main">
        {children}
      </main>

      {/* Phones only (CSS): the same four sections, moved to where the thumb
          already is. The top nav is hidden at that width, so assistive tech
          never meets two copies. */}
      {immersive ? null : (
        <nav className="student-tabbar" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive(item) ? 'page' : undefined}
                className={`student-tabbar-item${isActive(item) ? ' is-active' : ''}`}
              >
                <span className="student-tabbar-icon" aria-hidden>
                  <Icon size={19} strokeWidth={2.25} />
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
