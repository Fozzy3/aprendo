import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import BrandMark from './BrandMark.tsx'
import ThemeToggle from './ThemeToggle.tsx'
import { authClient } from '../lib/auth-client.ts'
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
  { to: '/today', label: 'Hoy', sections: ['today'] },
  { to: '/path', label: 'Ruta', sections: ['path', 'syllabus'] },
  { to: '/practice', label: 'Práctica', sections: ['practice'] },
  { to: '/progress', label: 'Progreso', sections: ['progress', 'history'] },
] as const satisfies ReadonlyArray<{
  to: string
  label: string
  sections: ReadonlyArray<StudentSection>
}>

export function StudentAppShell({
  session,
  activeSection,
  topBarSupplement,
  mainClassName,
  children,
}: {
  session: ActiveStudentSession
  activeSection: StudentSection
  topBarSupplement?: React.ReactNode
  mainClassName?: string
  children: React.ReactNode
}) {
  const navigate = useNavigate()
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

  return (
    <div className="student-shell">
      <header className="student-topbar">
        <div className="student-topbar-inner">
          <Link
            to="/"
            className="student-brand no-underline"
          >
            <div className="student-brand-mark">
              <BrandMark />
            </div>
            <div className="student-brand-copy">
              <span className="student-brand-title">Aprendo</span>
              <span className="student-brand-subtitle">Preparación Saber 11</span>
            </div>
          </Link>

          <nav className="student-topnav" aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => {
              const isActive = (item.sections as ReadonlyArray<StudentSection>).includes(
                activeSection,
              )
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={`student-topnav-item ${isActive ? 'is-active' : ''}`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="student-topbar-actions">
            <div className="student-session-identity">
              <span className="student-session-label">Sesion</span>
              <strong>{session.email}</strong>
            </div>
            {topBarSupplement}
            <ThemeToggle />
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

      <main className={['student-shell-main', mainClassName].filter(Boolean).join(' ')}>
        {children}
      </main>
    </div>
  )
}
