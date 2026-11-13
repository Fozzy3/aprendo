import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { School, Users } from 'lucide-react'
import { Wordmark } from './BrandMark.tsx'
import { RoleSwitcher, type AccountRole } from './RoleSwitcher.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { mySchoolsQuery } from '../lib/student-queries.ts'
import { useSignOut } from '../lib/use-sign-out.ts'

/**
 * The frame for teachers and school admins: desktop first, the wordmark and the
 * school, and two sections (Cursos for everyone on staff, Colegio for the
 * school admin). On teacher screens (student look) it becomes the ink rail on
 * a computer, with the open course's tabs under Cursos.
 */
export function StaffShell({
  active,
  role = 'teacher',
  nav,
  courseNav,
  home = '/teacher',
  children,
}: {
  /** None on pages outside the sections, such as Cuenta. */
  active?: 'classes' | 'school'
  /** Which side of the account this page is, so the switcher offers the others. */
  role?: AccountRole
  /** A side with its own sections (/admin) replaces the teacher's. */
  nav?: React.ReactNode
  /** The open course and its tabs, under Cursos on the rail (CSS shows it from 1024px). */
  courseNav?: React.ReactNode
  home?: '/teacher' | '/admin'
  children: React.ReactNode
}) {
  const schoolsQuery = useQuery(mySchoolsQuery)
  const schools = schoolsQuery.data ?? []
  const administers = schools.some((school) => school.role === 'org_admin')
  const schoolNames = [...new Set(schools.filter((school) => school.role !== 'student').map((school) => school.name))]
  const { signOut, isSigningOut } = useSignOut()
  // On a course the rail marks the tab, not the section above it.
  const classesCurrent = active === 'classes' && courseNav == null

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
              className={`student-topnav-item${active === 'classes' ? ' is-active' : ''}${courseNav != null ? ' has-course' : ''}`}
              aria-current={classesCurrent ? 'page' : undefined}
            >
              <Users size={17} strokeWidth={2.25} aria-hidden />
              Cursos
            </Link>}
            {nav == null ? courseNav : null}
            {nav == null && administers ? (
              <Link
                to="/school"
                className={`student-topnav-item${active === 'school' ? ' is-active' : ''}`}
                aria-current={active === 'school' ? 'page' : undefined}
              >
                <School size={17} strokeWidth={2.25} aria-hidden />
                Colegio
              </Link>
            ) : null}
          </nav>

          <div className="student-topbar-actions">
            <RoleSwitcher current={role} />
            <div className="student-topbar-account">
              <ThemeToggle />
              <Link to="/cuenta" className="btn-ghost text-xs no-underline">
                Cuenta
              </Link>
              <button type="button" className="btn-ghost text-xs" disabled={isSigningOut} onClick={() => void signOut()}>
                {isSigningOut ? 'Saliendo…' : 'Salir'}
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="staff-main">{children}</main>
    </div>
  )
}
