import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { FullScreenLoader } from '../components/FullScreenLoader.tsx'
import { MarkdownBlock } from '../components/MarkdownBlock.tsx'
import { readConvexError } from '../lib/convex-error.ts'
import { duelOutcome, useMsLeft } from '../lib/duel-display.ts'
import { formatClock } from '../lib/result-display.ts'
import { useSignedIn } from '../lib/use-signed-in.ts'

export const Route = createFileRoute('/teacher/duelo/$id')({
  component: DuelHostPage,
})

type HostView = FunctionReturnType<typeof api.duels.getDuelHostView>

// TODO: a fixed address, drawn once into public/qr-aprendo.svg (qrcode 1.5.4,
// level M). Regenerate both if the app moves to its own domain.
const APP_ADDRESS = 'aprendo-nine.vercel.app'
const MIN_PLAYERS = 2

/**
 * The projector (F60), read from the back of the room. The lobby is the three
 * steps in, the app's QR and who joined per team; the game is the team scores,
 * the question and how many have answered. Never a name, and the key of a
 * question only once it is closed.
 */
function DuelHostPage() {
  const { id } = Route.useParams()
  const session = useSignedIn()
  const view = useQuery({ ...convexQuery(api.duels.getDuelHostView, { duelId: id as never }), enabled: session != null })
  const begin = useMutation({ mutationFn: useConvexMutation(api.duels.beginDuel) })
  const next = useMutation({ mutationFn: useConvexMutation(api.duels.nextDuelQuestion) })
  const finish = useMutation({ mutationFn: useConvexMutation(api.duels.finishDuel) })
  const msLeft = useMsLeft(view.data?.endsAt)
  if (session == null || view.isPending) return <FullScreenLoader message="Abriendo el duelo…" />

  const data = view.data
  if (view.isError || data == null) {
    return (
      <main className="duel-stage">
        <div className="duel-stage-center">
          <h1 className="duel-stage-title">No pudimos abrir este duelo</h1>
          <p className="duel-stage-note">{readConvexError(view.error, 'Solo lo ven los docentes del curso.')}</p>
          <Link to="/teacher" className="duel-stage-quiet no-underline">Tus cursos</Link>
        </div>
      </main>
    )
  }

  const isOver = data.status === 'finished' || msLeft === 0
  const playerCount = data.teams.reduce((sum, team) => sum + team.size, 0)
  const duelId = { duelId: id as never }
  const error = begin.error ?? next.error ?? finish.error
  const isLast = (data.question?.index ?? 0) + 1 >= (data.question?.total ?? 0)

  return (
    <main className="duel-stage">
      <header className="duel-stage-bar">
        <Link to="/teacher/$classGroupId" params={{ classGroupId: data.classGroupId }} className="duel-stage-back no-underline">
          <ArrowLeft size={18} aria-hidden /> {data.classGroupName === '' ? 'Volver al curso' : data.classGroupName}
        </Link>
        {!isOver && msLeft != null ? <span className="duel-stage-clock">{formatClock(msLeft)}</span> : null}
      </header>

      {isOver ? (
        <section className="duel-stage-center">
          <h1 className="duel-stage-title">{duelOutcome(data.teams)}</h1>
          <Scoreboard teams={data.teams} />
          <Link to="/teacher/$classGroupId" params={{ classGroupId: data.classGroupId }} className="duel-stage-quiet no-underline">
            Volver al curso
          </Link>
        </section>
      ) : data.status === 'lobby' ? (
        <>
          <section className="duel-lobby" aria-labelledby="duel-lobby-title">
            <div>
              <h1 id="duel-lobby-title" className="duel-stage-title">Duelo en vivo</h1>
              <ol className="duel-steps">
                {['Abre Aprendo', 'Hoy', 'Entrar'].map((step, index) => (
                  <li key={step}>
                    <span className="duel-step-number" aria-hidden>{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <figure className="duel-qr">
              <img src="/qr-aprendo.svg" alt={`Código QR de ${APP_ADDRESS}`} width={240} height={240} />
              <figcaption>
                <strong className="duel-qr-address">{APP_ADDRESS}</strong>
                {data.inviteCode !== '' ? (
                  <span className="duel-qr-code">¿Sin curso? Código <strong>{data.inviteCode}</strong></span>
                ) : null}
              </figcaption>
            </figure>
          </section>

          <div className="duel-teams">
            {data.teams.map((team) => (
              <TeamLobby key={team.name} name={team.name} size={team.size} />
            ))}
          </div>

          <footer className="duel-stage-actions">
            <button
              type="button"
              className="duel-stage-go"
              disabled={begin.isPending || playerCount < MIN_PLAYERS}
              onClick={() => begin.mutate(duelId)}
            >
              Empezar
            </button>
            {playerCount < MIN_PLAYERS ? (
              <p className="duel-stage-note" role="status">
                {MIN_PLAYERS - playerCount === 1 ? 'Falta 1 estudiante' : `Faltan ${MIN_PLAYERS - playerCount} estudiantes`}
              </p>
            ) : null}
            <button type="button" className="duel-stage-quiet" disabled={finish.isPending} onClick={() => finish.mutate(duelId)}>
              Terminar
            </button>
          </footer>
        </>
      ) : (
        <>
          <Scoreboard teams={data.teams} />
          {data.question != null ? (
            <section className="duel-stage-question" aria-label={`Pregunta ${data.question.index + 1} de ${data.question.total}`}>
              <p className="duel-stage-meta">
                <span>Pregunta {data.question.index + 1} de {data.question.total}</span>
                <span>{data.answeredCount} de {playerCount} respondieron</span>
              </p>
              <div className="duel-stem"><MarkdownBlock markdown={data.question.bodyMarkdown} /></div>
              <ul className="duel-options">
                {data.question.options.map((option) => (
                  <li key={option.label}>
                    <span className="duel-option-letter">{option.label}</span>
                    <MarkdownBlock markdown={option.bodyMarkdown} />
                  </li>
                ))}
              </ul>
              {data.closedQuestion != null ? (
                <p className="duel-stage-note">Anterior: {data.closedQuestion.correctOption}</p>
              ) : null}
            </section>
          ) : null}
          <footer className="duel-stage-actions">
            <button type="button" className="duel-stage-go" disabled={next.isPending} onClick={() => next.mutate(duelId)}>
              {isLast ? 'Ver resultado' : 'Siguiente pregunta'}
            </button>
            <button type="button" className="duel-stage-quiet" disabled={finish.isPending} onClick={() => finish.mutate(duelId)}>
              Terminar
            </button>
          </footer>
        </>
      )}

      {error != null ? (
        <p role="alert" className="notice is-danger duel-stage-error">{readConvexError(error, 'No se pudo avanzar el duelo.')}</p>
      ) : null}
    </main>
  )
}

function Scoreboard({ teams }: { teams: HostView['teams'] }) {
  return (
    <dl className="duel-scoreboard">
      {teams.map((team) => (
        <div key={team.name}>
          <dt>{team.name}</dt>
          <dd>{team.score}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A team in the lobby: its count and one dot per student; whoever joins after the page opened pops in. */
function TeamLobby({ name, size }: { name: string; size: number }) {
  const [sizeAtOpen] = useState(size)
  return (
    <section className="duel-team" aria-label={name}>
      <h2 className="duel-team-name">{name}</h2>
      <p key={size} className={`duel-team-count${size > sizeAtOpen ? ' is-new' : ''}`}>{size}</p>
      <ul className="duel-team-dots" aria-hidden>
        {Array.from({ length: Math.min(size, 40) }, (_, index) => (
          <li key={index} className={index >= sizeAtOpen ? 'is-new' : undefined} />
        ))}
      </ul>
    </section>
  )
}
