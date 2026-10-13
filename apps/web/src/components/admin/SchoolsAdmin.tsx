import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '@aprendo/convex/api'
import { readConvexError } from '../../lib/convex-error.ts'
import { dateInputValue, endOfDayFromInput } from '../../lib/date-input.ts'
import { EmptyState } from '../EmptyState.tsx'
import { PageLoader } from '../FullScreenLoader.tsx'

type Plan = 'pilot' | 'school'
const PLAN_LABEL: Record<Plan, string> = { pilot: 'Piloto', school: 'Colegio' }

/**
 * Aprendo staff only: open a school with its license and its first school
 * admin, and renew or resize licenses. Everything inside a school (teachers,
 * classes, codes) is the school admin's, in /school.
 */
export function SchoolsAdmin() {
  const organizationsQuery = useQuery(convexQuery(api.schools.listOrganizations, {}))

  return (
    <section aria-labelledby="schools-title">
      <h1 id="schools-title" className="page-title">Colegios</h1>
      <p className="page-lede">Cada colegio tiene una licencia con cupos de estudiantes y una fecha de vencimiento.</p>

      <CreateOrganizationForm />

      <div className="ruled-section">
        <h2 className="section-title">Licencias</h2>
        {organizationsQuery.isPending ? (
          <PageLoader message="Cargando colegios…" />
        ) : (organizationsQuery.data ?? []).length === 0 ? (
          <EmptyState title="Aún no hay colegios">Crea el primero con el formulario de arriba.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Colegio</th>
                  <th scope="col">Administradores</th>
                  <th scope="col">Plan</th>
                  <th scope="col" className="is-number">Cupos</th>
                  <th scope="col">Licencia</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {(organizationsQuery.data ?? []).map((organization) => (
                  <LicenseRow key={organization._id} organization={organization} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function CreateOrganizationForm() {
  const createOrganization = useConvexMutation(api.schools.createOrganization)
  const [form, setForm] = useState({ name: '', adminEmail: '', plan: 'school' as Plan, seatLimit: '40', licenseEndsAt: '' })
  const mutation = useMutation({
    mutationFn: () =>
      createOrganization({
        name: form.name,
        adminEmail: form.adminEmail,
        plan: form.plan,
        seatLimit: Number(form.seatLimit),
        licenseEndsAt: endOfDayFromInput(form.licenseEndsAt),
      }),
    onSuccess: () => setForm({ name: '', adminEmail: '', plan: 'school', seatLimit: '40', licenseEndsAt: '' }),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <form className="ruled-section form-grid" onSubmit={submit}>
      <h2 className="section-title col-span-full">Nuevo colegio</h2>
      <label className="field">
        <span>Nombre del colegio</span>
        <input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </label>
      <label className="field">
        <span>Correo del administrador del colegio</span>
        <input
          className="input"
          type="email"
          required
          value={form.adminEmail}
          onChange={(event) => setForm({ ...form, adminEmail: event.target.value })}
        />
        <small>La cuenta debe existir: la persona se registra primero en Aprendo.</small>
      </label>
      <label className="field">
        <span>Plan</span>
        <select className="input" value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value as Plan })}>
          <option value="school">{PLAN_LABEL.school}</option>
          <option value="pilot">{PLAN_LABEL.pilot}</option>
        </select>
      </label>
      <label className="field">
        <span>Cupos de estudiantes</span>
        <input
          className="input"
          type="number"
          min={1}
          step={1}
          required
          value={form.seatLimit}
          onChange={(event) => setForm({ ...form, seatLimit: event.target.value })}
        />
      </label>
      <label className="field">
        <span>Licencia vigente hasta</span>
        <input
          className="input"
          type="date"
          required
          value={form.licenseEndsAt}
          onChange={(event) => setForm({ ...form, licenseEndsAt: event.target.value })}
        />
      </label>
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creando…' : 'Crear colegio'}
        </button>
        {mutation.error ? (
          <p role="alert" className="m-0 text-sm text-[var(--danger-text)]">
            {readConvexError(mutation.error, 'No se pudo crear el colegio.')}
          </p>
        ) : mutation.isSuccess ? (
          <p role="status" className="m-0 text-sm text-[var(--success-text)]">Colegio creado.</p>
        ) : null}
      </div>
    </form>
  )
}

function LicenseRow({
  organization,
}: {
  organization: {
    _id: string
    name: string
    plan: Plan
    seatLimit: number
    seatsUsed: number
    licenseEndsAt: number
    licenseActive: boolean
    adminEmails: string[]
  }
}) {
  const updateLicense = useConvexMutation(api.schools.updateOrganizationLicense)
  const addOrgAdmin = useConvexMutation(api.schools.addOrgAdmin)
  const [isEditing, setIsEditing] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const adminMutation = useMutation({
    mutationFn: () => addOrgAdmin({ orgId: organization._id as never, email: adminEmail }),
    onSuccess: () => setAdminEmail(''),
  })
  const [draft, setDraft] = useState({
    plan: organization.plan,
    seatLimit: String(organization.seatLimit),
    licenseEndsAt: dateInputValue(organization.licenseEndsAt),
  })
  const mutation = useMutation({
    mutationFn: () =>
      updateLicense({
        orgId: organization._id as never,
        plan: draft.plan,
        seatLimit: Number(draft.seatLimit),
        licenseEndsAt: endOfDayFromInput(draft.licenseEndsAt),
      }),
    onSuccess: () => setIsEditing(false),
  })

  if (isEditing) {
    return (
      <tr>
        <th scope="row">{organization.name}</th>
        <td>
          {organization.adminEmails.join(', ')}
          <span className="mt-1 flex gap-1">
            <input
              className="input"
              type="email"
              placeholder="Otro administrador"
              aria-label="Correo de otro administrador del colegio"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={adminMutation.isPending || adminEmail.trim().length === 0}
              onClick={() => adminMutation.mutate()}
            >
              Agregar
            </button>
          </span>
          {adminMutation.error ? (
            <p role="alert" className="m-0 mt-1 text-xs text-[var(--danger-text)]">
              {readConvexError(adminMutation.error, 'No se pudo agregar.')}
            </p>
          ) : null}
        </td>
        <td>
          <select
            className="input"
            aria-label="Plan"
            value={draft.plan}
            onChange={(event) => setDraft({ ...draft, plan: event.target.value as Plan })}
          >
            <option value="school">{PLAN_LABEL.school}</option>
            <option value="pilot">{PLAN_LABEL.pilot}</option>
          </select>
        </td>
        <td className="is-number">
          <input
            className="input w-24"
            type="number"
            min={1}
            aria-label="Cupos"
            value={draft.seatLimit}
            onChange={(event) => setDraft({ ...draft, seatLimit: event.target.value })}
          />
        </td>
        <td>
          <input
            className="input"
            type="date"
            aria-label="Licencia vigente hasta"
            value={draft.licenseEndsAt}
            onChange={(event) => setDraft({ ...draft, licenseEndsAt: event.target.value })}
          />
          {mutation.error ? (
            <p role="alert" className="m-0 mt-1 text-xs text-[var(--danger-text)]">
              {readConvexError(mutation.error, 'No se pudo guardar.')}
            </p>
          ) : null}
        </td>
        <td className="whitespace-nowrap">
          <button type="button" className="btn-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            Guardar
          </button>{' '}
          <button type="button" className="btn-ghost" onClick={() => setIsEditing(false)}>
            Cancelar
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <th scope="row">{organization.name}</th>
      <td>{organization.adminEmails.join(', ') || '—'}</td>
      <td>{PLAN_LABEL[organization.plan]}</td>
      <td className="is-number">
        {organization.seatsUsed} / {organization.seatLimit}
      </td>
      <td className={organization.licenseActive ? undefined : 'text-[var(--danger-text)]'}>
        {organization.licenseActive ? 'Hasta ' : 'Venció el '}
        {new Date(organization.licenseEndsAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td>
        <button type="button" className="btn-ghost" onClick={() => setIsEditing(true)}>
          Editar
        </button>
      </td>
    </tr>
  )
}
