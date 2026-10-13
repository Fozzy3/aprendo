import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { EmptyState } from '../components/EmptyState.tsx'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { mySchoolsQuery } from '../lib/student-queries.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

export const Route = createFileRoute('/teacher/')({
  component: TeacherHomePage,
})

/** The classes a teacher follows, grouped by school (a teacher may work in two). */
function TeacherHomePage() {
  const session = useSignedIn()
  const classesQuery = useQuery({ ...convexQuery(api.teacher.listMyClassGroups, {}), enabled: session != null })
  const schoolsQuery = useQuery({ ...mySchoolsQuery, enabled: session != null })
  if (session == null) return <FullScreenLoader />

  const classes = classesQuery.data ?? []
  const staffSchools = (schoolsQuery.data ?? []).filter((school) => school.role !== 'student')
  const bySchool = new Map<string, typeof classes>()
  for (const classGroup of classes) {
    bySchool.set(classGroup.orgName, [...(bySchool.get(classGroup.orgName) ?? []), classGroup])
  }

  return (
    <StaffShell active="classes">
      <div className="page-sheet">
        <header className="ruled-page-head">
          <h1 className="page-title">Tus cursos</h1>
          <p className="page-lede">
            Abre un curso para ver el nivel de cada estudiante por área, quién necesita apoyo y qué
            competencias le cuestan al grupo.
          </p>
        </header>

        {classesQuery.isPending || schoolsQuery.isPending ? (
          <PageLoader message="Cargando tus cursos…" />
        ) : staffSchools.length === 0 ? (
          <EmptyState
            title="Tu cuenta no es docente en ningún colegio"
            action={
              <Link to="/join" className="btn-secondary no-underline">
                Tengo un código de curso
              </Link>
            }
          >
            Si eres docente, pídele al administrador de tu colegio que te agregue con este correo:{' '}
            <strong>{session.email}</strong>. Si eres estudiante, únete con el código que te dio tu docente.
          </EmptyState>
        ) : classes.length === 0 ? (
          <EmptyState
            title="Aún no tienes cursos asignados"
            action={
              staffSchools.some((school) => school.role === 'org_admin') ? (
                <Link to="/school" className="btn-primary no-underline">
                  Crear un curso
                </Link>
              ) : undefined
            }
          >
            El administrador de tu colegio crea los cursos y te los asigna.
          </EmptyState>
        ) : (
          [...bySchool].map(([schoolName, schoolClasses]) => (
            <section key={schoolName} className="ruled-section" aria-label={schoolName}>
              {bySchool.size > 1 ? <h2 className="section-title">{schoolName}</h2> : null}
              {schoolClasses[0]?.licenseActive === false ? (
                <p role="status" className="notice is-danger">
                  La licencia de {schoolName} venció: los estudiantes no pueden unirse a cursos nuevos. Los
                  datos siguen disponibles.
                </p>
              ) : null}
              <ul className="ruled-list">
                {schoolClasses.map((classGroup) => (
                  <li key={classGroup._id}>
                    <Link
                      to="/teacher/$classGroupId"
                      params={{ classGroupId: classGroup._id }}
                      className="ruled-row no-underline"
                    >
                      <span className="ruled-row-label">Grado {classGroup.grade}</span>
                      <span className="ruled-row-main">
                        <span className="font-display text-lg font-semibold">{classGroup.name}</span>
                        <span className="ruled-row-note">
                          {classGroup.studentCount === 0
                            ? 'Sin estudiantes todavía'
                            : `${classGroup.studentCount} ${classGroup.studentCount === 1 ? 'estudiante' : 'estudiantes'}`}
                        </span>
                      </span>
                      <ArrowRight size={16} aria-hidden className="shrink-0 text-[var(--text-tertiary)]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </StaffShell>
  )
}
