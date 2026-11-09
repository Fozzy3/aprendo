import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Wordmark } from './BrandMark.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

/** The close of every public page. */
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <span>Aprendo · preparación para el Saber 11. No estamos afiliados al ICFES.</span>
      <nav aria-label="Legal">
        <Link to="/terminos">Términos</Link>
        <Link to="/privacidad">Tratamiento de datos</Link>
      </nav>
    </footer>
  )
}

/** The sign-in screens: one ruled sheet on the desk, the wordmark at its head. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-sheet sheet fade-in">
        <div className="auth-sheet-head">
          <Link to="/" className="no-underline">
            <Wordmark subtitle="Saber 11" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="mt-8">{children}</div>
        <p className="auth-legal">
          Al usar Aprendo aceptas los <Link to="/terminos">términos</Link> y la{' '}
          <Link to="/privacidad">política de tratamiento de datos</Link>.
        </p>
      </div>
      <PublicFooter />
    </div>
  )
}

/** A legal text: a page on the desk, its date in the margin. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="public-desk">
      <header className="public-bar">
        <Link to="/" className="no-underline">
          <Wordmark subtitle="Saber 11" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="ruled-page">
        <aside className="ruled-page-margin" aria-label="Datos del documento">
          <dl className="margin-facts">
            <div>
              <dt>Última actualización</dt>
              <dd>{updated}</dd>
            </div>
          </dl>
        </aside>
        <article className="ruled-page-body legal">
          <h1 className="page-title">{title}</h1>
          {children}
        </article>
      </main>
      <PublicFooter />
    </div>
  )
}
