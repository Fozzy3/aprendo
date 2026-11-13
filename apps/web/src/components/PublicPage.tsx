import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
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

/** Three days done, today next: the daily loop, drawn once for the sign-in cover. */
const COVER_WEEK = [
  { day: 'L', state: 'done' },
  { day: 'M', state: 'done' },
  { day: 'M', state: 'done' },
  { day: 'J', state: 'today' },
  { day: 'V', state: 'next' },
  { day: 'S', state: 'next' },
  { day: 'D', state: 'next' },
] as const

/**
 * The sign-in screens (student look): an ink cover with the brand and the
 * week, the form on a white card. On a phone the cover is a band the card
 * overlaps; from 900px it is the left half.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-cover">
        <div className="auth-cover-head">
          <Link to="/" className="no-underline">
            <Wordmark subtitle="Saber 11" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="auth-cover-foot" aria-hidden="true">
          <p className="auth-cover-line">Un paso cada día.</p>
          <ol className="auth-week">
            {COVER_WEEK.map(({ day, state }, index) => (
              <li key={index} className={`auth-week-day is-${state}`} style={{ '--i': index } as CSSProperties}>
                <span className="auth-week-dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : null}</span>
                {day}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="auth-main">
        <div className="auth-sheet sheet fade-in">
          {children}
          <p className="auth-legal">
            Al usar Aprendo aceptas los <Link to="/terminos">términos</Link> y la{' '}
            <Link to="/privacidad">política de tratamiento de datos</Link>.
          </p>
        </div>
        <PublicFooter />
      </div>
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
