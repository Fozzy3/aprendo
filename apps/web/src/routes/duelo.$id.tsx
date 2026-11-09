import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { MarkdownBlock } from '../components/MarkdownBlock.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { duelOutcome, useMsLeft } from '../lib/duel-display.ts'
import { formatClock } from '../lib/result-display.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

export const Route = createFileRoute('/duelo/$id')({
  component: DuelPlayerPage,
})

type PlayerView = FunctionReturnType<typeof api.duels.getDuelPlayerView>

/** A student's phone during the duel (F60). The account is enough: no placement is asked. */
function DuelPlayerPage() {
  const { id } = Route.useParams()
  const session = useSignedIn()
  if (session == null) return <FullScreenLoader />
  return <DuelPlayer duelId={id} studentId={session.studentId} />
}

function DuelPlayer({ duelId, studentId }: { duelId: string; studentId: string }) {
  const ids = { duelId: duelId as never, studentId: studentId as never }
  const view = useQuery(convexQuery(api.duels.getDuelPlayerView, ids))
  const join = useMutation({ mutationFn: useConvexMutation(api.duels.joinDuel) })
  const msLeft = useMsLeft(view.data?.endsAt)

  if (view.isPending) return <FullScreenLoader />
  if (view.isError || view.data == null) {
    return (
      <main className="duel-page">
        <div className="duel-sheet">
          <h1 className="duel-title">Este duelo no está disponible</h1>
          <p>{readConvexError(view.error, 'Puede que sea de otro curso.')}</p>
          <Link to="/today" className="btn-primary no-underline">Volver a Hoy</Link>
        </div>
      </main>
    )
  }

  const data = view.data
  const isOver = data.status === 'finished' || msLeft === 0

  return (
    <main className="duel-page">
      <header className="duel-top">
        {data.teams.map((team, index) => (
          <div key={team.name} className={`duel-top-team${index === data.teamIndex ? ' is-mine' : ''}`}>
            <span className="duel-top-name">{team.name}</span>
            <span className="duel-top-score">{team.score}</span>
          </div>
        ))}
      </header>

      <div className="duel-sheet">
        {isOver ? (
          <>
            <h1 className="duel-title">{duelOutcome(data.teams)}</h1>
            <Link to="/today" className="btn-primary no-underline">Volver a Hoy</Link>
          </>
        ) : data.teamIndex == null ? (
          <>
            <h1 className="duel-title">Duelo en vivo</h1>
            <button
              type="button"
              className="btn-primary"
              disabled={join.isPending}
              onClick={() => join.mutate(ids)}
            >
              Entrar al duelo
            </button>
            {join.error != null ? (
              <p role="alert" className="notice is-danger">{readConvexError(join.error, 'No pudiste entrar. Inténtalo otra vez.')}</p>
            ) : null}
          </>
        ) : data.question != null ? (
          <DuelQuestion key={data.question.index} ids={ids} question={data.question} answered={data.answered} msLeft={msLeft} />
        ) : (
          <>
            <h1 className="duel-title">Estás en {data.teams[data.teamIndex]!.name}</h1>
            <p>Tu profe empieza en un momento.</p>
          </>
        )}
      </div>
    </main>
  )
}

function DuelQuestion({
  ids,
  question,
  answered,
  msLeft,
}: {
  ids: { duelId: never; studentId: never }
  question: NonNullable<PlayerView['question']>
  answered: PlayerView['answered']
  msLeft: number | null
}) {
  const [chosen, setChosen] = useState<string | null>(null)
  const answer = useMutation({ mutationFn: useConvexMutation(api.duels.answerDuel) })
  const locked = answered != null || answer.isPending

  return (
    <>
      <p className="duel-progress">
        <span>Pregunta {question.index + 1} de {question.total}</span>
        {msLeft != null ? <span>{formatClock(msLeft)}</span> : null}
      </p>
      <div className="duel-question"><MarkdownBlock markdown={question.bodyMarkdown} /></div>
      <div className="duel-answers">
        {question.options.map((option) => {
          const state = option.label !== chosen || answered == null ? '' : answered.isCorrect ? ' is-correct' : ' is-incorrect'
          return (
            <button
              key={option.label}
              type="button"
              className={`option-card${option.label === chosen ? ' is-selected' : ''}${state}`}
              disabled={locked}
              onClick={() => {
                setChosen(option.label)
                answer.mutate({ ...ids, questionIndex: question.index, selectedOption: option.label })
              }}
            >
              <span className="option-label">{option.label}</span>
              <MarkdownBlock markdown={option.bodyMarkdown} />
            </button>
          )
        })}
      </div>
      {answered != null ? (
        <p role="status" className="duel-feedback">
          {answered.isCorrect ? '¡Punto para tu equipo!' : 'Esta no era. Viene otra.'}
        </p>
      ) : null}
      {answer.error != null ? (
        <p role="alert" className="notice is-danger">{readConvexError(answer.error, 'No se guardó tu respuesta.')}</p>
      ) : null}
    </>
  )
}
