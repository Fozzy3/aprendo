import { convexQuery } from '@convex-dev/react-query'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { api } from '@aprendo/convex/api'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { StudentAppShell } from '../components/StudentAppShell.tsx'
import { toast } from '../components/Toast.tsx'
import { authClient } from '../lib/auth-client.ts'
import { mySchoolsQuery, studentAppStateQuery } from '../lib/student-queries.ts'
import type { ActiveStudentSession } from '../lib/student-session.ts'
import { useSignOut } from '../lib/use-sign-out.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

export const Route = createFileRoute('/cuenta')({
  component: AccountPage,
})

const ROLE_LABEL = { student: 'Estudiante', teacher: 'Docente', org_admin: 'Administra el colegio' } as const
// Same floor as `minPasswordLength` in packages/convex/src/auth.ts.
const MIN_PASSWORD_LENGTH = 8

/**
 * The account, for every role and inside that role's shell: who you are, the
 * schools that can see your level, a copy of your data, and deleting everything
 * (Ley 1581). Deleting asks for the password, so a phone left unlocked is not
 * enough.
 */
function AccountPage() {
  const session = useSignedIn()
  const schoolsQuery = useQuery({ ...mySchoolsQuery, enabled: session != null })
  const appStateQuery = useQuery({ ...studentAppStateQuery(session?.studentId), enabled: session != null })
  if (session == null) return <FullScreenLoader />

  const schools = schoolsQuery.data ?? []
  const page = (
    <div className="page-sheet cuenta fade-in">
      <h1 className="page-title">Tu cuenta</h1>
      <p className="page-lede">{session.email}</p>
      <NameForm currentName={session.name} />
      <PasswordForm />
      <SchoolsSection schools={schools} />
      <ExportData studentId={session.studentId} />
      <SignOut />
      <DeleteAccount />
    </div>
  )

  return appStateQuery.data?.isStaff === true || schools.some((school) => school.role !== 'student') ? (
    <StaffShell>{page}</StaffShell>
  ) : (
    <StudentAppShell session={session} activeSection="progress">
      {page}
    </StudentAppShell>
  )
}

function NameForm({ currentName }: { currentName: string | null }) {
  const [name, setName] = useState(currentName ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const trimmed = name.trim()

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSaving(true)
    const { error } = await authClient.updateUser({ name: trimmed })
    setIsSaving(false)
    if (error) {
      setErrorMessage('No pudimos guardar tu nombre. Intenta de nuevo.')
      return
    }
    toast('Guardamos tu nombre.')
  }

  return (
    <section className="ruled-section" aria-labelledby="cuenta-name-title">
      <h2 id="cuenta-name-title" className="section-title">Tu nombre</h2>
      <form className="grid gap-3" onSubmit={(event) => void save(event)}>
        <label className="field">
          <span>Como aparece para tu docente</span>
          <input className="input" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {errorMessage ? (
          <p role="alert" className="m-0 text-sm text-[var(--danger-text)]">{errorMessage}</p>
        ) : null}
        <div>
          <button
            type="submit"
            className="btn-secondary"
            disabled={isSaving || trimmed.length === 0 || trimmed === (currentName ?? '')}
          >
            {isSaving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </section>
  )
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    setErrorMessage(null)
    setIsSaving(true)
    const { error } = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
    setIsSaving(false)
    if (error) {
      setErrorMessage(
        error.code === 'INVALID_PASSWORD' ? 'La contraseña actual no coincide.' : 'No pudimos cambiar la contraseña. Intenta de nuevo.',
      )
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    toast('Cambiamos tu contraseña.')
  }

  return (
    <section className="ruled-section" aria-labelledby="cuenta-password-title">
      <h2 id="cuenta-password-title" className="section-title">Contraseña</h2>
      <form className="grid gap-3" onSubmit={(event) => void save(event)}>
        <label className="field">
          <span>Contraseña actual</span>
          <input
            type="password"
            className="input"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Contraseña nueva</span>
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        {errorMessage ? (
          <p role="alert" className="m-0 text-sm text-[var(--danger-text)]">{errorMessage}</p>
        ) : null}
        <div>
          <button type="submit" className="btn-secondary" disabled={isSaving}>
            {isSaving ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </section>
  )
}

function SchoolsSection({
  schools,
}: {
  schools: { orgId: string; name: string; role: keyof typeof ROLE_LABEL; classGroups: { name: string }[] }[]
}) {
  return (
    <section className="ruled-section" aria-labelledby="cuenta-schools-title">
      <h2 id="cuenta-schools-title" className="section-title">Colegios</h2>
      {schools.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          No estás en ningún colegio. <Link to="/join">Unirme a un curso</Link>
        </p>
      ) : (
        <ul className="ruled-list">
          {schools.map((school) => (
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
  )
}

function downloadJson(fileName: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** The access `/privacidad` promises: every row keyed by the student, as a file. */
function ExportData({ studentId }: { studentId: ActiveStudentSession['studentId'] }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'idle' | 'working' | 'failed'>('idle')

  const exportData = async () => {
    setStatus('working')
    try {
      // staleTime 0: `convexQuery` is Infinity, and nothing keeps this one live.
      const data = await queryClient.fetchQuery({
        ...convexQuery(api.accountExport.exportMyData, { studentId }),
        staleTime: 0,
      })
      downloadJson(`aprendo-mis-datos-${new Date().toISOString().slice(0, 10)}.json`, data)
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <section className="ruled-section" aria-labelledby="cuenta-export-title">
      <h2 id="cuenta-export-title" className="section-title">Tus datos</h2>
      <p className="text-sm text-[var(--text-secondary)]">Un archivo con todo lo que Aprendo guarda sobre ti.</p>
      {status === 'failed' ? (
        <p role="alert" className="text-sm text-[var(--danger-text)]">No pudimos preparar el archivo. Intenta de nuevo.</p>
      ) : null}
      <button type="button" className="btn-secondary" disabled={status === 'working'} onClick={() => void exportData()}>
        {status === 'working' ? 'Preparando…' : 'Descargar mis datos'}
      </button>
    </section>
  )
}

function SignOut() {
  const { signOut, isSigningOut } = useSignOut()
  return (
    <section className="ruled-section" aria-labelledby="cuenta-signout-title">
      <h2 id="cuenta-signout-title" className="section-title">Sesión</h2>
      <button type="button" className="btn-secondary" disabled={isSigningOut} onClick={() => void signOut()}>
        {isSigningOut ? 'Saliendo…' : 'Salir'}
      </button>
    </section>
  )
}

function DeleteAccount() {
  const [password, setPassword] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
    <section className="ruled-section" aria-labelledby="cuenta-delete-title">
      <h2 id="cuenta-delete-title" className="section-title">Eliminar la cuenta</h2>
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
  )
}
