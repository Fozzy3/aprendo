import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { mySchoolsQuery } from '../lib/student-queries.ts'
import { Wordmark } from './BrandMark.tsx'

/**
 * The notebook's cover label: "Colegio · Curso · Estudiante". This is where a
 * school's co-branding lives (its crest and name); Aprendo stays as the small
 * wordmark beside it. Student chrome only, so it names the school the account
 * studies at: a teacher who also studies elsewhere sees that one, and an
 * account with no student seat sees only the wordmark.
 */
export function SchoolLabel({ studentName, subtitle }: { studentName: string | null; subtitle?: string }) {
  const schoolsQuery = useQuery(mySchoolsQuery)
  const school = schoolsQuery.data?.find((entry) => entry.role === 'student') ?? null

  return (
    <Link to="/app" className="school-label no-underline" aria-label="Ir al inicio">
      <Wordmark subtitle={school == null ? subtitle : undefined} />
      {school != null ? (
        <span className="school-label-card">
          {school.crestUrl != null ? (
            <img src={school.crestUrl} alt="" className="school-label-crest" />
          ) : null}
          <span className="school-label-lines">
            <span className="school-label-school">{school.name}</span>
            <span className="school-label-meta">
              {[school.classGroups[0]?.name, studentName].filter(Boolean).join(' · ')}
            </span>
          </span>
        </span>
      ) : null}
    </Link>
  )
}
