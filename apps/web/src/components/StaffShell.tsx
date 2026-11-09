import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Wordmark } from './BrandMark.tsx'
import { RoleSwitcher, type AccountRole } from './RoleSwitcher.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { mySchoolsQuery } from '../lib/student-queries.ts'
import { useSignOut } from '../lib/use-sign-out.ts'

/**
 * The frame for teachers and school admins: desktop first, the wordmark and the
 * school, and two sections (Cursos for everyone on staff, Colegio for the
 * school admin).
 */
export function StaffShell({
  active,
  role = 'teacher',
  nav,
  home = '/teacher',
  children,
}: {
  /** None on pages outside the sections, such as Cuenta. */
  active?: 'classes' | 'school'
  /** Which side of the account this page is, so the switcher offers the others. */
  role?: AccountRole
  /** A side with its own sections (/admin) replaces the teacher's. */
  nav?: React.ReactNode
  home?: '/teacher' | '/admin'
  children: React.ReactNode
}) {
  const schoolsQuery = useQuery(mySchoolsQuery)
  const schools = schoolsQuery.data ?? []
  const administers = schools.some((school) => school.role === 'org_admin')
  const schoolNames = [...new Set(schools.filter((school) => school.role !== 'student').map((school) => school.name))]
  const { signOut, isSigningOut } = useSignOut()

  return (
    <div className="staff-shell">
      <header className="student-topbar">
        <div className="student-topbar-inner">
          <Link to={home} className="school-label no-underline">
            <Wordmark />
            {schoolNames.length > 0 ? (
              <span className="school-label-card">
                <span className="school-label-lines">
                  <span className="school-label-school">{schoolNames.join(' · ')}</span>
                  <span className="school-label-meta">{home === '/admin' ? 'Equipo Aprendo' : 'Panel docente'}</span>
                </span>
              </span>
            ) : null}
          </Link>

          <nav className="student-topnav" aria-label={home === '/admin' ? 'Equipo Aprendo' : 'Panel docente'}>
            {nav ?? <Link
              to="/teacher"
              className={`student-topnav-item${active === 'classes' ? ' is-active' : ''}`}
              aria-current={active === 'classes' ? 'page' : undefined}
            >
              Cursos
            </Link>}
            {nav == null && administers ? (
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
            <RoleSwitcher current={role} />
            <ThemeToggle />
            <Link to="/cuenta" className="btn-ghost text-xs no-underline">
              Cuenta
            </Link>
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
