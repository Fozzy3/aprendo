import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, ListChecks } from 'lucide-react'
import type { CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { MIN_ATTEMPTS_FOR_LEVEL } from '@aprendo/convex/levels'
import { PageLoader } from './FullScreenLoader.tsx'
import { CareerCard } from './CareerPicker.tsx'
import { PracticeSubtopicButton } from './PracticeSubtopicButton.tsx'
import { celebrationFor, previousPlacementIndex } from '../lib/result-display.ts'
import { sessionHistoryQuery, studentAppStateQuery } from '../lib/student-queries.ts'
import { getAllSubjectThemes, getSubjectTheme } from '../lib/subject-theme.ts'
import { getSubtopicLabel } from '@aprendo/convex/taxonomy'

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
      <div className="fade-in mx-auto w-[min(40rem,calc(100%-2rem))] py-10">
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
      ? `Tu primer nivel en ${theme.label}`
      : celebration === 'level_up'
        ? `Subiste de nivel en ${theme.label}`
        : `Tu nivel en ${theme.label}`

  const placed = appStateQuery.data?.placedSubjectIds ?? []
  const pendingSubjects = getAllSubjectThemes().filter(
    (subject) => subject.id !== result.subjectId && !placed.includes(subject.id),
  )

  return (
    <div className="fade-in mx-auto w-[min(40rem,calc(100%-2rem))] py-6 sm:py-10">
      <header className="ruled-page-head">
        <p className="m-0 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span
            aria-hidden
            className="subject-dot"
            style={{ '--subject-color': theme.color } as CSSProperties}
          />
          Nivelación de {theme.label}
        </p>
        <h1 className="page-title mt-1 text-balance">{headline}</h1>
      </header>

      <section className="ruled-section" aria-label="Tu nivel">
        <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="figure">{level?.band.labelEs ?? 'Sin nivel'}</span>
          <span className="text-sm text-[var(--text-secondary)] tabular-nums">
            <strong className="text-lg text-[var(--text-primary)]">{result.score}</strong> de 100
          </span>
        </p>

        {level != null ? (
          <>
            <div
              className="mt-4 flex gap-0.5"
              role="img"
              aria-label={`${level.band.labelEs}: nivel ${level.index} de ${level.bandCount}`}
            >
              {Array.from({ length: level.bandCount }, (_, position) => (
                <span
                  key={position}
                  className="h-2 flex-1"
                  style={{ background: position < level.index ? 'var(--ink)' : 'var(--bg-inset)' }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-tertiary)] tabular-nums">
              Nivel {level.index} de {level.bandCount} del ICFES
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
          <p className="notice">
            <strong className="text-[var(--text-primary)]">Estimación preliminar.</strong> Respondiste
            menos de {MIN_ATTEMPTS_FOR_LEVEL} preguntas, así que este nivel puede cambiar. Nivela de nuevo esta área cuando
            quieras para confirmarlo.
          </p>
        ) : null}
      </section>

      {level?.nextBand != null ? (
        <section className="ruled-section" aria-labelledby="nivelacion-next-title">
          <div className="section-head">
            <h2 id="nivelacion-next-title" className="section-title">
              Para llegar a {level.nextBand.labelEs}
            </h2>
            {level.pointsToNextBand != null ? (
              <span className="section-meta tabular-nums">te faltan {level.pointsToNextBand} puntos</span>
            ) : null}
          </div>
          <p className="m-0 text-sm leading-relaxed text-[var(--text-secondary)]">
            {level.nextBand.descriptorEs}
          </p>
        </section>
      ) : level != null ? (
        <section className="ruled-section">
          <p className="m-0 text-sm text-[var(--text-secondary)]">
            Estás en el nivel más alto de esta área. Ahora toca sostenerlo.
          </p>
        </section>
      ) : null}

      {result.weakestSubtopics.length > 0 ? (
        <section className="ruled-section" aria-labelledby="nivelacion-start-title">
          <h2 id="nivelacion-start-title" className="section-title">Por dónde empezar</h2>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            Los temas que más te costaron en esta nivelación.
          </p>
          <ul className="ruled-list">
            {result.weakestSubtopics.map((subtopic) => (
              <li key={subtopic.subtopicId} className="ruled-row flex-wrap">
                <span className="ruled-row-main">
                  <span className="font-semibold">{getSubtopicLabel(subtopic.subtopicId)}</span>
                  <span className="ruled-row-note tabular-nums">
                    Acertaste {subtopic.correctCount} de {subtopic.questionCount}
                  </span>
                </span>
                <span className="flex flex-wrap items-start gap-2">
                  <Link
                    to="/lesson/$subtopicId"
                    params={{ subtopicId: subtopic.subtopicId }}
                    className="btn-secondary no-underline"
                  >
                    <BookOpen size={14} aria-hidden /> Ver la lección
                  </Link>
                  <PracticeSubtopicButton studentId={studentId} subtopicId={subtopic.subtopicId} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ruled-section">
        {pendingSubjects.length > 0 ? (
          <>
            <h2 className="section-title">Nivela la siguiente área</h2>
            <p className="text-sm text-[var(--text-secondary)]">
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
            <Link to="/diagnostic" className="btn-secondary mt-4 no-underline">
              Elegir la siguiente área <ArrowRight size={14} aria-hidden />
            </Link>
          </>
        ) : (
          <Link to="/today" className="btn-secondary no-underline">
            Ir a mi plan de hoy <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </section>

      {/* Right after seeing the level: what is this score for? Never a gate. */}
      <CareerCard studentId={studentId} mode="invite" />

      <div className="border-t border-[var(--border-strong)] pt-5">{reviewLink}</div>
    </div>
  )
}
