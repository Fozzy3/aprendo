import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { api } from '@aprendo/convex/api'
import { EmptyState } from '../components/EmptyState.tsx'
import { FullScreenLoader, PageLoader } from '../components/FullScreenLoader.tsx'
import { MarkdownBlock } from '../components/MarkdownBlock.tsx'
import { StaffShell } from '../components/StaffShell.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { duelOutcome, useMsLeft } from '../lib/duel-display.ts'
import { formatClock } from '../lib/result-display.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

export const Route = createFileRoute('/teacher/duelo/$id')({
  component: DuelHostPage,
})

/**
 * The projector (F60): team scores, the question and how many have answered.
 * Never a name, and the key of a question only once it is closed.
 */
function DuelHostPage() {
  const { id } = Route.useParams()
  const session = useSignedIn()
  const view = useQuery({ ...convexQuery(api.duels.getDuelHostView, { duelId: id as never }), enabled: session != null })
  const begin = useMutation({ mutationFn: useConvexMutation(api.duels.beginDuel) })
  const next = useMutation({ mutationFn: useConvexMutation(api.duels.nextDuelQuestion) })
  const finish = useMutation({ mutationFn: useConvexMutation(api.duels.finishDuel) })
  const msLeft = useMsLeft(view.data?.endsAt)
  if (session == null) return <FullScreenLoader />

  const data = view.data
  const isOver = data != null && (data.status === 'finished' || msLeft === 0)
  const playerCount = (data?.teams ?? []).reduce((sum, team) => sum + team.size, 0)
  const duelId = { duelId: id as never }
  const error = begin.error ?? next.error ?? finish.error

  return (
    <StaffShell active="classes">
      <div className="report-actions">
        {data != null ? (
          <Link to="/teacher/$classGroupId" params={{ classGroupId: data.classGroupId }} className="back-link no-underline">
            <ArrowLeft size={14} aria-hidden /> Volver al curso
          </Link>
        ) : null}
      </div>

      {view.isPending ? (
        <PageLoader message="Abriendo el duelo…" />
      ) : view.isError || data == null ? (
        <EmptyState title="No pudimos abrir este duelo">
          {readConvexError(view.error, 'Solo lo ven los docentes del curso.')}
        </EmptyState>
      ) : (
        <div className="page-sheet duel-host">
          <header className="section-head">
            <h1 className="page-title m-0">
              {isOver ? duelOutcome(data.teams) : data.status === 'lobby' ? 'Entren al duelo desde Hoy' : `Pregunta ${(data.question?.index ?? 0) + 1} de ${data.question?.total ?? 0}`}
            </h1>
            {!isOver && msLeft != null ? <span className="duel-clock">{formatClock(msLeft)}</span> : null}
          </header>

          <dl className="duel-board">
            {data.teams.map((team) => (
              <div key={team.name}>
                <dt>{team.name}{data.status === 'lobby' ? ` · ${team.size} ${team.size === 1 ? 'estudiante' : 'estudiantes'}` : ''}</dt>
                <dd className="duel-team-score">{team.score}</dd>
              </div>
            ))}
          </dl>

          {!isOver && data.question != null ? (
            <>
              <div className="duel-stem"><MarkdownBlock markdown={data.question.bodyMarkdown} /></div>
              <ul className="duel-options">
                {data.question.options.map((option) => (
                  <li key={option.label}>
                    <strong>{option.label}</strong> <MarkdownBlock markdown={option.bodyMarkdown} />
                  </li>
                ))}
              </ul>
              <p className="m-0 text-sm text-[var(--text-secondary)]">
                {data.answeredCount} de {playerCount} respondieron
                {data.closedQuestion != null ? ` · La pregunta anterior era la ${data.closedQuestion.correctOption}` : ''}
              </p>
            </>
          ) : null}

          {!isOver ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {data.status === 'lobby' ? (
                <button type="button" className="btn-primary" disabled={begin.isPending || playerCount < 2} onClick={() => begin.mutate(duelId)}>
                  Empezar
                </button>
              ) : (
                <button type="button" className="btn-primary" disabled={next.isPending} onClick={() => next.mutate(duelId)}>
                  {(data.question?.index ?? 0) + 1 >= (data.question?.total ?? 0) ? 'Ver resultado' : 'Siguiente pregunta'}
                </button>
              )}
              <button type="button" className="btn-ghost" disabled={finish.isPending} onClick={() => finish.mutate(duelId)}>
                Terminar el duelo
              </button>
            </div>
          ) : null}

          {error != null ? (
            <p role="alert" className="notice is-danger mt-3">{readConvexError(error, 'No se pudo avanzar el duelo.')}</p>
          ) : null}
        </div>
      )}
    </StaffShell>
  )
}
