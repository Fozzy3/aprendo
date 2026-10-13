import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Wordmark } from './BrandMark.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { authClient } from '../lib/auth-client.ts'
import { mySchoolsQuery } from '../lib/student-queries.ts'

/**
 * The frame for teachers and school admins: desktop first, the wordmark and the
 * school, and two sections (Cursos for everyone on staff, Colegio for the
 * school admin).
 */
export function StaffShell({
  active,
  children,
}: {
  active: 'classes' | 'school'
  children: React.ReactNode
}) {
  const schoolsQuery = useQuery(mySchoolsQuery)
  const schools = schoolsQuery.data ?? []
  const administers = schools.some((school) => school.role === 'org_admin')
  const schoolNames = [...new Set(schools.filter((school) => school.role !== 'student').map((school) => school.name))]
  const [isSigningOut, setIsSigningOut] = useState(false)

  const signOut = async () => {
    setIsSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      window.location.assign('/')
    }
  }

  return (
    <div className="staff-shell">
      <header className="student-topbar">
        <div className="student-topbar-inner">
          <Link to="/teacher" className="school-label no-underline">
            <Wordmark />
            {schoolNames.length > 0 ? (
              <span className="school-label-card">
                <span className="school-label-lines">
                  <span className="school-label-school">{schoolNames.join(' · ')}</span>
                  <span className="school-label-meta">Panel docente</span>
                </span>
              </span>
            ) : null}
          </Link>

          <nav className="student-topnav" aria-label="Panel docente">
            <Link
              to="/teacher"
              className={`student-topnav-item${active === 'classes' ? ' is-active' : ''}`}
              aria-current={active === 'classes' ? 'page' : undefined}
            >
              Cursos
            </Link>
            {administers ? (
              <Link
                to="/school"
                className={`student-topnav-item${active === 'school' ? ' is-active' : ''}`}
                aria-current={active === 'school' ? 'page' : undefined}
              >
                Colegio
              </Link>
            ) : null}
          </nav>

          <div className="student-topbar-actions">
            <ThemeToggle />
            <button type="button" className="btn-ghost text-xs" disabled={isSigningOut} onClick={() => void signOut()}>
              {isSigningOut ? 'Saliendo…' : 'Salir'}
            </button>
          </div>
        </div>
      </header>
      <main className="staff-main">{children}</main>
    </div>
  )
}
