import { Link } from '@tanstack/react-router'
import { BookOpen, House, Trophy, UserRound } from 'lucide-react'
import { RoleSwitcher } from './RoleSwitcher.tsx'
import { SchoolLabel } from './SchoolLabel.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import type { ActiveStudentSession } from '../lib/student-session.ts'
import { useSignOut } from '../lib/use-sign-out.ts'

type StudentSection = 'today' | 'path' | 'syllabus' | 'practice' | 'progress'

/** The four tabs. A lesson (`syllabus`) belongs to Aprende. */
const NAV_ITEMS = [
  { to: '/today', label: 'Hoy', icon: House, sections: ['today'] },
  { to: '/path', label: 'Aprende', icon: BookOpen, sections: ['path', 'syllabus'] },
  { to: '/practice', label: 'Retos', icon: Trophy, sections: ['practice'] },
  { to: '/progress', label: 'Yo', icon: UserRound, sections: ['progress'] },
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
  hideTabs = false,
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
  /** Before the first placement there is nowhere else to go yet. */
  hideTabs?: boolean
  children: React.ReactNode
}) {
  const { signOut, isSigningOut } = useSignOut()
  const showTabs = !immersive && !hideTabs

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    (item.sections as ReadonlyArray<StudentSection>).includes(activeSection)

  return (
    <div className={`student-shell${immersive ? ' is-immersive' : ''}${hideTabs ? ' has-no-tabs' : ''}`}>
      <header className="student-topbar">
        <div className="student-topbar-inner">
          <SchoolLabel studentName={session.name} subtitle="Saber 11" />

          {showTabs ? (
            <nav className="student-topnav" aria-label="Navegación principal">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={isActive(item) ? 'page' : undefined}
                    className={`student-topnav-item ${isActive(item) ? 'is-active' : ''}`}
                  >
                    <Icon size={17} strokeWidth={2.25} aria-hidden />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          ) : null}

          <div className="student-topbar-actions">
            {immersive ? null : <RoleSwitcher current="student" />}
            {topBarSupplement}
            {/* Phones reach these from Yo; CSS hides them there while the tabs exist. */}
            <div className="student-topbar-account">
              <ThemeToggle />
              <Link to="/cuenta" className="btn-ghost text-xs no-underline">
                Cuenta
              </Link>
              <button
                type="button"
                disabled={isSigningOut}
                onClick={() => { void signOut() }}
                className="btn-ghost text-xs"
              >
                {isSigningOut ? 'Saliendo…' : 'Salir'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="student-shell-main">
        {children}
      </main>

      {/* Phones only (CSS): the same four tabs, moved to where the thumb
          already is. The top nav is hidden at that width, so assistive tech
          never meets two copies. */}
      {showTabs ? (
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
                  <Icon size={24} strokeWidth={2} />
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      ) : null}
    </div>
  )
}
