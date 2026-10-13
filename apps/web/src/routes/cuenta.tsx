import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { authClient } from '../lib/auth-client.ts'
import { mySchoolsQuery } from '../lib/student-queries.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'
import { AuthFrame } from './login.tsx'

export const Route = createFileRoute('/cuenta')({
  component: AccountPage,
})

const ROLE_LABEL = { student: 'Estudiante', teacher: 'Docente', org_admin: 'Administra el colegio' } as const

/**
 * The account: who you are, the schools that can see your level, and deleting
 * everything (Ley 1581). Deleting asks for the password, so a phone left
 * unlocked is not enough.
 */
function AccountPage() {
  const session = useSignedIn()
  const schoolsQuery = useQuery({ ...mySchoolsQuery, enabled: session != null })
  const [password, setPassword] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  if (session == null) return <FullScreenLoader />

  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsDeleting(true)
    const { error } = await authClient.deleteUser({ password })
    setIsDeleting(false)
    if (error) {
      setErrorMessage(
        error.code === 'INVALID_PASSWORD' ? 'La contraseña no coincide.' : 'No pudimos eliminar la cuenta. Intenta de nuevo.',
      )
      return
    }
    window.location.assign('/')
  }

  return (
    <AuthFrame>
      <h1 className="page-title">Tu cuenta</h1>
      <dl className="margin-facts">
        {session.name != null ? (
          <div>
            <dt>Nombre</dt>
            <dd>{session.name}</dd>
          </div>
        ) : null}
        <div>
          <dt>Correo</dt>
          <dd>{session.email}</dd>
        </div>
      </dl>

      <section className="ruled-section mt-6">
        <h2 className="section-title">Colegios</h2>
        {(schoolsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            No estás en ningún colegio. <Link to="/join">Unirme a un curso</Link>
          </p>
        ) : (
          <ul className="ruled-list">
            {(schoolsQuery.data ?? []).map((school) => (
              <li key={school.orgId} className="ruled-row">
                <span className="ruled-row-main">
                  <span className="font-semibold">{school.name}</span>
                  <span className="ruled-row-note">
                    {ROLE_LABEL[school.role]}
                    {school.classGroups.length > 0 ? ` · ${school.classGroups.map((group) => group.name).join(', ')}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ruled-section">
        <h2 className="section-title">Eliminar la cuenta</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Se borran para siempre tus respuestas, sesiones, progreso y conversaciones con el tutor, y sales de
          tus colegios. No se puede deshacer.
        </p>
        {isConfirming ? (
          <form className="mt-4 grid gap-3" onSubmit={(event) => void deleteAccount(event)}>
            <label className="field">
              <span>Escribe tu contraseña para confirmar</span>
              <input
                type="password"
                className="input"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {errorMessage ? (
              <p role="alert" className="m-0 text-sm text-[var(--danger-text)]">
                {errorMessage}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary btn-danger" disabled={isDeleting || password.length === 0}>
                {isDeleting ? 'Eliminando…' : 'Eliminar mi cuenta'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setIsConfirming(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn-secondary mt-4" onClick={() => setIsConfirming(true)}>
            Eliminar mi cuenta…
          </button>
        )}
      </section>

      <Link to="/app" className="btn-ghost mt-4 no-underline">
        Volver
      </Link>
    </AuthFrame>
  )
}
