import { Link, createFileRoute } from '@tanstack/react-router'
import { useCurrentStudent } from '../lib/student-session.ts'
import BrandMark from '../components/BrandMark.tsx'
import ThemeToggle from '../components/ThemeToggle.tsx'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const { session, isReady } = useCurrentStudent()

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      {/* Subtle top-right controls */}
      <div className="flex items-center justify-end px-6 py-4">
        <ThemeToggle />
      </div>

      {/* Centered hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-20">
        <div className="fade-in w-full max-w-lg text-center">
          {/* Logo mark */}
          <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border-accent)] bg-[var(--accent-soft)]">
            <BrandMark size={28} strokeWidth={2} />
          </div>

          <h1 className="font-display mb-3 text-5xl font-normal tracking-tight text-[var(--text-primary)] sm:text-6xl">
            Aprendo
          </h1>
          <p className="mx-auto mb-10 max-w-sm text-base leading-relaxed text-[var(--text-secondary)]">
            Prepara tu Saber 11 con diagnosticos reales, seguimiento por materia y practica personalizada.
          </p>

          <div className="flex flex-col items-center gap-3">
            {isReady && session ? (
              <>
                <Link
                  to="/app"
                  className="btn-primary px-8 py-3 text-base no-underline"
                >
                  Continuar
                </Link>
                <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                  Sesion activa: {session.email}
                </p>
                <Link
                  to="/practice"
                  className="btn-ghost text-sm no-underline"
                >
                  Ver practica guiada
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="btn-primary px-8 py-3 text-base no-underline"
                >
                  Comenzar
                </Link>
                <Link
                  to="/login"
                  className="btn-ghost text-sm no-underline"
                >
                  Ya tengo una sesion
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature hints */}
        <div className="fade-in stagger-2 mt-16 grid w-full max-w-lg gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 text-center">
            <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Diagnostico</p>
            <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">Mide tu punto de partida</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 text-center">
            <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Seguimiento</p>
            <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">Progreso por materia</p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5 text-center">
            <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">5 areas ICFES</p>
            <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">Cobertura completa</p>
          </div>
        </div>
      </main>

      {/* Minimal footer */}
      <footer className="px-6 pb-6 text-center text-xs text-[var(--text-tertiary)]">
        Aprendo &mdash; preparacion ICFES Saber 11
      </footer>
    </div>
  )
}
