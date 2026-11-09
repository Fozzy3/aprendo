import { Link } from '@tanstack/react-router'
import { Wordmark } from './BrandMark.tsx'

function DeadEnd({ title, children, retry }: { title: string; children: React.ReactNode; retry?: boolean }) {
  return (
    <div className="auth-page">
      <div className="auth-sheet sheet">
        <Wordmark />
        <h1 className="page-title mt-8">{title}</h1>
        <p className="page-lede">{children}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {retry === true ? (
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Reintentar
            </button>
          ) : null}
          <Link to="/app" className={`${retry === true ? 'btn-ghost' : 'btn-primary'} no-underline`}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return <DeadEnd title="No encontramos esta página">El enlace está roto o la página ya no existe.</DeadEnd>
}

export function RouteErrorPage() {
  return (
    <DeadEnd title="Algo se rompió de nuestro lado" retry>
      No perdiste nada de lo que respondiste. Intenta de nuevo en un momento.
    </DeadEnd>
  )
}
