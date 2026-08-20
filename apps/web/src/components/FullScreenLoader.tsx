/** Centered full-screen loading state used by student routes while the guard resolves. */
export function FullScreenLoader({ message = 'Cargando…' }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <p className="text-sm text-[var(--text-tertiary)]">{message}</p>
    </div>
  )
}
