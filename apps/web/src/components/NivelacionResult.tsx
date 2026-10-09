import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, ListChecks } from 'lucide-react'
import type { CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { Mascot } from './Mascot.tsx'
import { PageLoader } from './FullScreenLoader.tsx'
import { PracticeSubtopicButton } from './PracticeSubtopicButton.tsx'
import { celebrationFor, previousPlacementIndex } from '../lib/result-display.ts'
import { sessionHistoryQuery, studentAppStateQuery } from '../lib/student-queries.ts'
import { getAllSubjectThemes, getSubjectTheme } from '../lib/subject-theme.ts'
import { getSubtopicLabel } from '../lib/taxonomy.ts'

/**
 * The level reveal after a nivelación — the first time the product tells the
 * student something about themselves. Level with the official descriptor, what
 * the next level can do, the two subtopics that cost the most with a way into
 * each, and the areas still to level. Preliminary results say so.
 */
export function NivelacionResult({
  session,
  studentId,
}: {
  session: { _id: string; subjectId?: string; startedAt: number }
  studentId: string
}) {
  const resultQuery = useQuery(
    convexQuery(api.sessions.getNivelacionResult, { sessionId: session._id as never }),
  )
  const appStateQuery = useQuery(studentAppStateQuery(studentId))
  const historyQuery = useQuery(sessionHistoryQuery(studentId, { kind: 'nivelacion' }))

  if (resultQuery.isPending || historyQuery.isPending || appStateQuery.isPending) {
    return <PageLoader message="Calculando tu nivel…" />
  }

  const result = resultQuery.data
  const reviewLink = (
    <Link
      to="/practice/$sessionId/review"
      params={{ sessionId: session._id }}
      search={{ pregunta: 1 }}
      className="btn-primary w-full justify-center no-underline sm:w-auto"
    >
      <ListChecks size={16} aria-hidden /> Revisar pregunta por pregunta
    </Link>
  )

  if (result == null) {
    return (
      <div className="fade-in mx-auto w-[min(40rem,calc(100%-2rem))] py-10 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          No pudimos calcular el nivel de esta nivelación.
        </p>
        <div className="mt-4">{reviewLink}</div>
      </div>
    )
  }

  const theme = getSubjectTheme(result.subjectId)
  const level = result.level
  const previousIndex = previousPlacementIndex(historyQuery.data ?? [], {
    _id: session._id,
    subjectId: result.subjectId,
    startedAt: session.startedAt,
  })
  const celebration = celebrationFor({
    isFirstPlacement: result.isFirstPlacement,
    hasEnoughEvidence: result.hasEnoughEvidence,
    levelIndex: level?.index ?? null,
    previousIndex,
  })
  const headline =
    celebration === 'first'
      ? '¡Ya tienes tu primer nivel!'
      : celebration === 'level_up'
        ? `¡Subiste de nivel en ${theme.label}!`
        : `Tu nivel en ${theme.label}`

  const placed = appStateQuery.data?.placedSubjectIds ?? []
  const pendingSubjects = getAllSubjectThemes().filter(
    (subject) => subject.id !== result.subjectId && !placed.includes(subject.id),
  )

  return (
    <div className="fade-in mx-auto w-[min(40rem,calc(100%-2rem))] py-6 sm:py-10">
      <header className="flex items-end gap-3">
        {celebration != null ? <Mascot mood="happy" size="md" className="shrink-0" /> : null}
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
            <span
              aria-hidden
              className="subject-dot subject-dot-lg"
              style={{ '--subject-color': theme.color } as CSSProperties}
            />
            Nivelación de {theme.label}
          </p>
          <h1 className="mt-1 text-balance font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            {headline}
          </h1>
        </div>
      </header>

      <section className="card mt-5 p-5" aria-label="Tu nivel">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-4xl font-bold tracking-tight text-[var(--text-primary)]">
            {level?.band.labelEs ?? 'Sin nivel'}
          </p>
          <p className="text-sm text-[var(--text-tertiary)] tabular-nums">
            <strong className="text-2xl font-bold text-[var(--text-primary)]">{result.score}</strong>/100
          </p>
        </div>

        {level != null ? (
          <>
            <div
              className="mt-3 flex gap-1"
              role="img"
              aria-label={`${level.band.labelEs}: nivel ${level.index} de ${level.bandCount}`}
            >
              {Array.from({ length: level.bandCount }, (_, position) => (
                <span
                  key={position}
                  className="h-2 flex-1 rounded-full"
                  style={{ background: position < level.index ? theme.color : 'var(--bg-inset)' }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-tertiary)] tabular-nums">
              {level.index} de {level.bandCount} niveles ICFES
              {previousIndex != null && previousIndex !== level.index
                ? ` · antes estabas en el ${previousIndex}`
                : ''}
            </p>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-[var(--text-primary)]">
              {level.band.descriptorEs}
            </p>
          </>
        ) : null}

        {!result.hasEnoughEvidence ? (
          <p className="review-state review-state-warn">
            <strong>Estimación preliminar</strong>
            <span>
              Respondiste menos de 12 preguntas, así que este nivel puede cambiar. Nivela de nuevo
              esta área cuando quieras para confirmarlo.
            </span>
          </p>
        ) : null}
      </section>

      {level?.nextBand != null ? (
        <section className="card-inset mt-3 p-4">
          <h2 className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm font-bold text-[var(--text-primary)]">
            Para llegar a {level.nextBand.labelEs}
            {level.pointsToNextBand != null ? (
              <span className="text-xs font-semibold text-[var(--text-tertiary)] tabular-nums">
                te faltan {level.pointsToNextBand} puntos
              </span>
            ) : null}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
            {level.nextBand.descriptorEs}
          </p>
        </section>
      ) : level != null ? (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Estás en el nivel más alto de esta área. Ahora toca sostenerlo.
        </p>
      ) : null}

      {result.weakestSubtopics.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">Por dónde empezar</h2>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            Los temas que más te costaron en esta nivelación.
          </p>
          <ul className="mt-3 grid list-none gap-2 p-0">
            {result.weakestSubtopics.map((subtopic) => (
              <li key={subtopic.subtopicId} className="card p-4">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {getSubtopicLabel(subtopic.subtopicId)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)] tabular-nums">
                  Acertaste {subtopic.correctCount} de {subtopic.questionCount}
                </p>
                <div className="mt-3 flex flex-wrap items-start gap-2">
                  <Link
                    to="/lesson/$subtopicId"
                    params={{ subtopicId: subtopic.subtopicId }}
                    className="btn-secondary no-underline"
                  >
                    <BookOpen size={14} aria-hidden /> Ver la lección
                  </Link>
                  <PracticeSubtopicButton studentId={studentId} subtopicId={subtopic.subtopicId} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        {pendingSubjects.length > 0 ? (
          <>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Nivela la siguiente área
            </h2>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              Con las cinco áreas medidas te damos tu puntaje global estimado.
            </p>
            <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
              {pendingSubjects.map((subject) => (
                <li key={subject.id} className="chip">
                  <span
                    aria-hidden
                    className="subject-dot"
                    style={{ '--subject-color': subject.color } as CSSProperties}
                  />
                  {subject.label}
                </li>
              ))}
            </ul>
            <Link to="/diagnostic" className="btn-secondary mt-3 no-underline">
              Elegir la siguiente área <ArrowRight size={14} aria-hidden />
            </Link>
          </>
        ) : (
          <Link to="/today" className="btn-secondary no-underline">
            Ir a mi plan de hoy <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </section>

      <div className="mt-8 border-t border-[var(--border)] pt-5">{reviewLink}</div>
    </div>
  )
}
