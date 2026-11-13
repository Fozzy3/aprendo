import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { confirmDialog } from '../components/ConfirmDialog.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'
import { SchoolTests } from '../components/SchoolTests.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { CONTACT_EMAIL } from '../lib/contact.ts'
import { readConvexError } from '../lib/convex-error.ts'
import { mySchoolsQuery } from '../lib/student-queries.ts'
import { belowShareLabel, studentDisplayName } from '../lib/teacher-display.ts'
import { SCHOOL_GRADES, getSubtopicLabel } from '@aprendo/convex/taxonomy'
import { useSignedIn } from '../lib/use-signed-in.ts'

type SchoolTab = 'cursos' | 'personas' | 'pruebas' | 'institucion'
type SchoolSearch = { colegio?: string; tab?: SchoolTab }

const SCHOOL_TABS: { id: SchoolTab; label: string }[] = [
  { id: 'cursos', label: 'Cursos' },
  { id: 'personas', label: 'Personas' },
  { id: 'pruebas', label: 'Pruebas' },
  { id: 'institucion', label: 'Institución' },
]

export const Route = createFileRoute('/school')({
  validateSearch: (search: Record<string, unknown>): SchoolSearch => ({
    colegio: typeof search.colegio === 'string' ? search.colegio : undefined,
    tab: SCHOOL_TABS.find((item) => item.id === search.tab)?.id,
  }),
  component: SchoolAdminPage,
})

type SchoolAdmin = FunctionReturnType<typeof api.schools.getSchoolAdmin>

/**
 * The school admin's page, in four tabs: its classes, its people, its periodic
 * tests, and the institution itself. A person who administers two schools picks one.
 */
function SchoolAdminPage() {
  const session = useSignedIn()
  const search = Route.useSearch()
  const schoolsQuery = useQuery({ ...mySchoolsQuery, enabled: session != null })
  const administered = (schoolsQuery.data ?? []).filter((school) => school.role === 'org_admin')
  const orgId = search.colegio ?? administered[0]?.orgId ?? null
  const adminQuery = useQuery({
    ...convexQuery(api.schools.getSchoolAdmin, orgId == null ? 'skip' : { orgId: orgId as never }),
    enabled: session != null && orgId != null,
  })
  if (session == null) return <FullScreenLoader />

  return (
    <StaffShell active="school">
      {administered.length > 1 ? (
        <nav className="tab-nav mb-6" aria-label="Colegios que administras">
          {administered.map((school) => (
            <Link
              key={school.orgId}
              to="/school"
              search={{ colegio: school.orgId }}
              className={`tab-item${school.orgId === orgId ? ' is-active' : ''}`}
            >
              {school.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {schoolsQuery.isPending || (orgId != null && adminQuery.isPending) ? (
        <PageLoader message="Cargando el colegio…" />
      ) : schoolsQuery.isError ? (
        <EmptyState title="No pudimos abrir el colegio">
          {readConvexError(schoolsQuery.error, 'Inténtalo de nuevo en un momento.')}
        </EmptyState>
      ) : orgId == null ? (
        <EmptyState title="No administras ningún colegio">
          Pide acceso al equipo de Aprendo con {session.email}.
        </EmptyState>
      ) : adminQuery.isError || adminQuery.data == null ? (
        <EmptyState title="No pudimos abrir el colegio">
          {readConvexError(adminQuery.error, 'Puede que ya no lo administres.')}
        </EmptyState>
      ) : (
        <SchoolAdminBody admin={adminQuery.data} selfEmail={session.email} tab={search.tab ?? 'cursos'} colegio={search.colegio} />
      )}
    </StaffShell>
  )
}

function SchoolAdminBody({
  admin,
  selfEmail,
  tab,
  colegio,
}: {
  admin: SchoolAdmin
  selfEmail: string
  tab: SchoolTab
  colegio: string | undefined
}) {
  const { organization } = admin
  const teachers = admin.members.filter((member) => member.role !== 'student')
  const students = admin.members.filter((member) => member.role === 'student')

  return (
    <div className="ruled-page">
      <aside className="ruled-page-margin" aria-label="Licencia">
        <p className="ruled-page-date">Licencia</p>
        <dl className="margin-facts">
          <div>
            <dt>Cupos usados</dt>
            <dd>
              {admin.seatsUsed} de {organization.seatLimit}
            </dd>
          </div>
          <div>
            <dt>{organization.licenseActive ? 'Vigente hasta' : 'Venció el'}</dt>
            <dd className={organization.licenseActive ? undefined : 'text-[var(--danger-text)]'}>
              {new Date(organization.licenseEndsAt).toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </dd>
          </div>
        </dl>
      </aside>

      <div className="ruled-page-body">
        <header className="ruled-page-head">
          <h1 className="page-title">{organization.name}</h1>
          {!organization.licenseActive ? (
            <p role="status" className="notice is-danger">
              La licencia venció: nadie puede unirse. Renuévala en Institución.
            </p>
          ) : admin.seatsUsed >= organization.seatLimit ? (
            <p role="status" className="notice is-danger">
              No quedan cupos: quita estudiantes que ya no estén o pide más.
            </p>
          ) : null}
        </header>

        <nav className="tab-nav mb-6" aria-label="Secciones del colegio">
          {SCHOOL_TABS.map(({ id, label }) => (
            <Link
              key={id}
              to="/school"
              search={{ colegio, ...(id === 'cursos' ? {} : { tab: id }) }}
              className={`tab-item${id === tab ? ' is-active' : ''}`}
              aria-current={id === tab ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        {tab === 'cursos' ? (
          <ClassesSection admin={admin} teachers={teachers} />
        ) : tab === 'personas' ? (
          <>
            <TeachersSection admin={admin} teachers={teachers} selfEmail={selfEmail} />
            <StudentsSection students={students} orgId={organization._id} />
          </>
        ) : tab === 'pruebas' ? (
          <>
            <SchoolTests orgId={organization._id} />
            <CyclesSection orgId={organization._id} />
          </>
        ) : (
          <>
            <IdentitySection admin={admin} />
            <RenewalSection admin={admin} />
          </>
        )}
      </div>
    </div>
  )
}

function IdentitySection({ admin }: { admin: SchoolAdmin }) {
  const { organization } = admin
  const rename = useConvexMutation(api.schools.renameOrganization)
  const generateUploadUrl = useConvexMutation(api.schools.generateCrestUploadUrl)
  const setCrest = useConvexMutation(api.schools.setCrest)
  const [name, setName] = useState(organization.name)
  const renameMutation = useMutation({ mutationFn: () => rename({ orgId: organization._id, name }) })
  const crestMutation = useMutation({
    mutationFn: async (file: File | null) => {
      if (file == null) return setCrest({ orgId: organization._id, storageId: null })
      const uploadUrl = await generateUploadUrl({ orgId: organization._id })
      const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
      if (!response.ok) throw new Error('No se pudo subir la imagen.')
      const { storageId } = (await response.json()) as { storageId: string }
      return setCrest({ orgId: organization._id, storageId: storageId as never })
    },
  })

  return (
    <section className="ruled-section" aria-labelledby="identity-title">
      <h2 id="identity-title" className="section-title">Nombre y escudo</h2>
      <form
        className="form-grid"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          renameMutation.mutate()
        }}
      >
        <label className="field">
          <span>Nombre del colegio</span>
          <input className="input" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-secondary" disabled={renameMutation.isPending || name === organization.name}>
            Guardar nombre
          </button>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        {organization.crestUrl != null ? (
          <img src={organization.crestUrl} alt={`Escudo de ${organization.name}`} className="h-16 w-16 object-contain" />
        ) : (
          <span className="text-sm text-[var(--text-tertiary)]">Sin escudo</span>
        )}
        <label className="btn-secondary cursor-pointer">
          {organization.crestUrl != null ? 'Cambiar escudo' : 'Subir escudo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file != null) crestMutation.mutate(file)
              event.target.value = ''
            }}
          />
        </label>
        {organization.crestUrl != null ? (
          <button type="button" className="btn-ghost" onClick={() => crestMutation.mutate(null)}>
            Quitar escudo
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-[var(--text-tertiary)]">PNG, JPG, SVG o WebP · máx. 1 MB</p>
      {renameMutation.error || crestMutation.error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--danger-text)]">
          {readConvexError(renameMutation.error ?? crestMutation.error, 'No se pudo guardar.')}
        </p>
      ) : null}
    </section>
  )
}

/** Who to write to, in the place the admin looks when the license runs out. */
function RenewalSection({ admin }: { admin: SchoolAdmin }) {
  const { organization } = admin
  const subject = encodeURIComponent(`Renovación de licencia · ${organization.name}`)
  return (
    <section className="ruled-section" aria-labelledby="renewal-title">
      <h2 id="renewal-title" className="section-title">Licencia</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        {organization.licenseActive ? 'Vigente hasta' : 'Venció el'}{' '}
        {new Date(organization.licenseEndsAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.
      </p>
      {CONTACT_EMAIL != null ? (
        <a className="btn-secondary no-underline" href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}>
          Escribir para renovar
        </a>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">Renueve con su contacto en Aprendo.</p>
      )}
    </section>
  )
}

function ClassesSection({ admin, teachers }: { admin: SchoolAdmin; teachers: SchoolAdmin['members'] }) {
  const orgId = admin.organization._id
  const createClassGroup = useConvexMutation(api.schools.createClassGroup)
  const [draft, setDraft] = useState({ name: '', grade: '11' })
  const createMutation = useMutation({
    mutationFn: () => createClassGroup({ orgId, name: draft.name, grade: draft.grade }),
    onSuccess: () => setDraft({ name: '', grade: draft.grade }),
  })

  return (
    <section className="ruled-section" aria-labelledby="classes-title">
      <h2 id="classes-title" className="section-title">Cursos</h2>
      <form
        className="form-grid mb-5"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          createMutation.mutate()
        }}
      >
        <label className="field">
          <span>Nombre del curso</span>
          <input
            className="input"
            required
            placeholder="11A"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Grado</span>
          <select
            className="input"
            value={draft.grade}
            onChange={(event) => setDraft({ ...draft, grade: event.target.value })}
          >
            {SCHOOL_GRADES.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creando…' : 'Crear curso'}
          </button>
        </div>
        {createMutation.error ? (
          <p role="alert" className="col-span-full m-0 text-sm text-[var(--danger-text)]">
            {readConvexError(createMutation.error, 'No se pudo crear el curso.')}
          </p>
        ) : null}
      </form>

      {admin.classGroups.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">Aún no hay cursos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Curso</th>
                <th scope="col">Código</th>
                <th scope="col" className="is-number">Estudiantes</th>
                <th scope="col">Docentes</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {admin.classGroups.map((classGroup) => (
                <ClassRow key={classGroup._id} classGroup={classGroup} teachers={teachers} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ClassRow({
  classGroup,
  teachers,
}: {
  classGroup: SchoolAdmin['classGroups'][number]
  teachers: SchoolAdmin['members']
}) {
  const assignTeacher = useConvexMutation(api.schools.assignTeacher)
  const unassignTeacher = useConvexMutation(api.schools.unassignTeacher)
  const regenerate = useConvexMutation(api.schools.regenerateInviteCode)
  const deleteClassGroup = useConvexMutation(api.schools.deleteClassGroup)
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
  })
  const assigned = teachers.filter((teacher) => classGroup.teacherIds.includes(teacher.accountId))
  const unassigned = teachers.filter((teacher) => !classGroup.teacherIds.includes(teacher.accountId))

  return (
    <tr>
      <th scope="row">
        <Link to="/teacher/$classGroupId" params={{ classGroupId: classGroup._id }}>
          {classGroup.name}
        </Link>
        <span className="cell-note">Grado {classGroup.grade}</span>
      </th>
      <td>
        <span className="invite-code-value is-inline">{classGroup.inviteCode}</span>
        <button
          type="button"
          className="btn-ghost"
          title="Generar un código nuevo (el anterior deja de servir)"
          aria-label={`Generar un código nuevo para ${classGroup.name}`}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(() => regenerate({ classGroupId: classGroup._id }))}
        >
          <RefreshCw size={14} aria-hidden />
        </button>
      </td>
      <td className="is-number">{classGroup.studentCount}</td>
      <td>
        <ul className="m-0 list-none p-0">
          {assigned.map((teacher) => (
            <li key={teacher.accountId} className="flex items-center gap-1">
              {studentDisplayName(teacher)}
              <button
                type="button"
                className="btn-ghost px-1"
                aria-label={`Quitar a ${studentDisplayName(teacher)} de ${classGroup.name}`}
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate(() => unassignTeacher({ classGroupId: classGroup._id, accountId: teacher.accountId }))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {unassigned.length > 0 ? (
          <select
            className="input mt-1"
            aria-label={`Asignar un docente a ${classGroup.name}`}
            value=""
            disabled={mutation.isPending}
            onChange={(event) => {
              const accountId = event.target.value
              if (accountId) mutation.mutate(() => assignTeacher({ classGroupId: classGroup._id, accountId: accountId as never }))
            }}
          >
            <option value="">Asignar docente…</option>
            {unassigned.map((teacher) => (
              <option key={teacher.accountId} value={teacher.accountId}>
                {studentDisplayName(teacher)}
              </option>
            ))}
          </select>
        ) : null}
        {mutation.error ? (
          <p role="alert" className="m-0 mt-1 text-xs text-[var(--danger-text)]">
            {readConvexError(mutation.error, 'No se pudo guardar.')}
          </p>
        ) : null}
      </td>
      <td>
        <button
          type="button"
          className="btn-ghost"
          aria-label={`Eliminar el curso ${classGroup.name}`}
          title="Eliminar el curso (los estudiantes siguen en el colegio)"
          disabled={mutation.isPending}
          onClick={async () => {
            const confirmed = await confirmDialog({
              title: `¿Eliminar ${classGroup.name}?`,
              body: 'Los estudiantes siguen en el colegio y conservan su progreso.',
              confirmLabel: 'Eliminar curso',
              destructive: true,
            })
            if (confirmed) mutation.mutate(() => deleteClassGroup({ classGroupId: classGroup._id }))
          }}
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </td>
    </tr>
  )
}

function TeachersSection({
  admin,
  teachers,
  selfEmail,
}: {
  admin: SchoolAdmin
  teachers: SchoolAdmin['members']
  selfEmail: string
}) {
  const addTeacher = useConvexMutation(api.schools.addTeacher)
  const removeMember = useConvexMutation(api.schools.removeMember)
  const [email, setEmail] = useState('')
  const addMutation = useMutation({
    mutationFn: () => addTeacher({ orgId: admin.organization._id, email }),
    onSuccess: () => setEmail(''),
  })
  const removeMutation = useMutation({ mutationFn: (membershipId: string) => removeMember({ membershipId: membershipId as never }) })

  return (
    <section className="ruled-section" aria-labelledby="teachers-title">
      <h2 id="teachers-title" className="section-title">Docentes</h2>
      <form
        className="form-grid mb-5"
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          addMutation.mutate()
        }}
      >
        <label className="field">
          <span>Correo del docente</span>
          <input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <small>Debe tener cuenta en Aprendo.</small>
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-primary" disabled={addMutation.isPending}>
            Agregar docente
          </button>
        </div>
        {addMutation.error ? (
          <p role="alert" className="col-span-full m-0 text-sm text-[var(--danger-text)]">
            {readConvexError(addMutation.error, 'No se pudo agregar al docente.')}
          </p>
        ) : null}
      </form>
      <ul className="ruled-list">
        {teachers.map((teacher) => (
          <li key={teacher.membershipId} className="ruled-row">
            <span className="ruled-row-main">
              <span className="font-semibold">{studentDisplayName(teacher)}</span>
              <span className="ruled-row-note">
                {teacher.role === 'org_admin' ? 'Administrador' : 'Docente'} · {teacher.email}
              </span>
            </span>
            {teacher.email !== selfEmail ? (
              <button
                type="button"
                className="btn-ghost"
                disabled={removeMutation.isPending}
                onClick={async () => {
                  const confirmed = await confirmDialog({
                    title: `¿Quitar a ${studentDisplayName(teacher)} del colegio?`,
                    confirmLabel: 'Quitar',
                    destructive: true,
                  })
                  if (confirmed) removeMutation.mutate(teacher.membershipId)
                }}
              >
                Quitar
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {removeMutation.error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--danger-text)]">
          {readConvexError(removeMutation.error, 'No se pudo quitar.')}
        </p>
      ) : null}
    </section>
  )
}

function StudentsSection({ students, orgId }: { students: SchoolAdmin['members']; orgId: string }) {
  const removeMember = useConvexMutation(api.schools.removeMember)
  const removeMutation = useMutation({ mutationFn: (membershipId: string) => removeMember({ membershipId: membershipId as never }) })

  return (
    <section className="ruled-section" aria-labelledby="students-title">
      <div className="section-head">
        <h2 id="students-title" className="section-title">Estudiantes</h2>
        <span className="section-meta">{students.length}</span>
      </div>
      {students.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">Nadie se ha unido todavía.</p>
      ) : (
        <ul className="ruled-list">
          {students.map((student) => (
            <li key={student.membershipId} className="ruled-row">
              <span className="ruled-row-main">
                <Link
                  to="/teacher/student/$studentId"
                  params={{ studentId: student.accountId }}
                  search={{ colegio: orgId }}
                  className="font-semibold"
                >
                  {studentDisplayName(student)}
                </Link>
                {student.name != null ? <span className="ruled-row-note">{student.email}</span> : null}
              </span>
              <button
                type="button"
                className="btn-ghost"
                disabled={removeMutation.isPending}
                onClick={async () => {
                  const confirmed = await confirmDialog({
                    title: `¿Quitar a ${studentDisplayName(student)} del colegio?`,
                    body: 'Libera su cupo; su cuenta y su progreso siguen siendo suyos.',
                    confirmLabel: 'Quitar',
                    destructive: true,
                  })
                  if (confirmed) removeMutation.mutate(student.membershipId)
                }}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      {removeMutation.error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--danger-text)]">
          {readConvexError(removeMutation.error, 'No se pudo quitar.')}
        </p>
      ) : null}
    </section>
  )
}

/**
 * What each class worked on in its latest teaching cycle and how it moved
 * (F42): the school's view for the coordinator and the PMI.
 */
function CyclesSection({ orgId }: { orgId: string }) {
  const cycles = useQuery(convexQuery(api.teacher.listSchoolCycles, { orgId: orgId as never }))
  if (cycles.isError) {
    return <p role="alert" className="notice is-danger">{readConvexError(cycles.error, 'No pudimos cargar los ciclos de enseñanza.')}</p>
  }
  if (cycles.data == null || cycles.data.length === 0) return null
  return (
    <section className="ruled-section" aria-labelledby="cycles-title">
      <h2 id="cycles-title" className="section-title">Ciclos de enseñanza</h2>
      <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Curso</th>
            <th>Tema</th>
            <th className="is-number">Bajo Familiar al empezar</th>
            <th className="is-number">Hoy</th>
          </tr>
        </thead>
        <tbody>
          {cycles.data.flatMap((cycle) =>
            cycle.progress.map((row, index) => (
              <tr key={`${cycle.cycleId}-${row.subtopicId}`}>
                <td>{index === 0 ? cycle.classGroupName : ''}</td>
                <td>{getSubtopicLabel(row.subtopicId)}</td>
                <td className="is-number">{belowShareLabel(row.before)}</td>
                <td className="is-number">{belowShareLabel(row.after)}</td>
              </tr>
            )))}
        </tbody>
      </table>
      </div>
    </section>
  )
}
