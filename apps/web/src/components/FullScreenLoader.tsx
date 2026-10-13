import { BrandMark } from './BrandMark.tsx'

/**
 * The two loading states this app is allowed to have.
 *
 * There used to be twenty, written twelve different ways — `Cargando…`,
 * `Preparando…`, `Cargando admin...`, `Preparando tu ruta...`, two of them with
 * three dots instead of an ellipsis — each with its own hand-rolled markup. The
 * split here is not stylistic; the two cases are genuinely different:
 *
 * - `FullScreenLoader` runs before the shell exists, once per visit: the mark
 *   and a line on blank paper.
 * - `PageLoader` runs inside a shell that is already painted, on every single
 *   navigation, so it is only a quiet line.
 */

export function FullScreenLoader({
  message = 'Un momento…',
}: {
  message?: string
}) {
  return (
    <div className="route-loader" role="status" aria-live="polite">
      <BrandMark size={28} />
      <p className="route-loader-text">{message}</p>
    </div>
  )
}

export function PageLoader({ message = 'Cargando…' }: { message?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="page-loader-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      {message}
    </div>
  )
}
