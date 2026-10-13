import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { api } from '@aprendo/convex/api'
import { Wordmark } from '../components/BrandMark.tsx'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

type JoinSearch = { codigo?: string }

export const Route = createFileRoute('/join')({
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    codigo: typeof search.codigo === 'string' ? search.codigo : undefined,
  }),
  component: JoinPage,
})

/**
 * "Unirme a un curso": the code the teacher shares (or the link that carries
 * it). Seats and the school's license are checked by the server; whatever it
 * refuses comes back as a sentence the student can act on.
 */
function JoinPage() {
  const session = useSignedIn()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [code, setCode] = useState(search.codigo ?? '')
  const joinClassGroup = useConvexMutation(api.schools.joinClassGroup)
  const mutation = useMutation({
    mutationFn: () => joinClassGroup({ inviteCode: code }),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
    },
  })
  if (session == null) return <FullScreenLoader />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="auth-page">
      <div className="auth-sheet sheet">
        <Link to="/app" className="no-underline">
          <Wordmark />
        </Link>
        {mutation.isSuccess ? (
          <div className="mt-8">
            <h1 className="page-title">Ya estás en {mutation.data.classGroupName}</h1>
            <p className="page-lede">
              {mutation.data.schoolName} ahora ve tu nivel por área para acompañarte. Nadie más que tú
              responde por tu cuenta.
            </p>
            <button type="button" className="btn-primary mt-6" onClick={() => void navigate({ to: '/app' })}>
              Seguir
            </button>
          </div>
        ) : (
          <form className="mt-8" onSubmit={submit}>
            <h1 className="page-title">Unirme a un curso</h1>
            <p className="page-lede">Escribe el código que te dio tu docente. Son 8 letras y números.</p>
            <label className="field mt-6">
              <span>Código del curso</span>
              <input
                className="input invite-code-input"
                required
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={12}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </label>
            {mutation.error ? (
              <p role="alert" className="mt-3 text-sm text-[var(--danger-text)]">
                {readConvexError(mutation.error, 'No pudimos unirte al curso. Intenta de nuevo.')}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary" disabled={mutation.isPending || code.trim().length === 0}>
                {mutation.isPending ? 'Uniéndote…' : 'Unirme'}
              </button>
              <Link to="/app" className="btn-ghost no-underline">
                Ahora no
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
