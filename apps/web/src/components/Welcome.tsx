import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import { getAllSubjectThemes } from '../lib/subject-theme.ts'
import { ExamCountdown } from './ExamCountdown.tsx'
import { FirstWeekCommit } from './FirstWeek.tsx'

const DIAGNOSTIC = SESSION_KIND_CONFIG.diagnostic
const DIAGNOSTIC_MINUTES = (DIAGNOSTIC.timeLimitMs ?? 0) / 60_000

type StepId = 'hello' | 'how' | 'plan'

const STEP_TITLES: Record<StepId, string> = {
  hello: 'Te damos la bienvenida a Aprendo',
  how: 'Así funciona',
  plan: 'Tu primera semana',
}

const FLOW = [
  {
    title: 'Diagnóstico general',
    text: `${getConfiguredQuestionCount(DIAGNOSTIC)} preguntas de las cinco áreas, sin ayuda y con ${DIAGNOSTIC_MINUTES} minutos. Así conocemos tu punto de partida.`,
  },
  { title: 'Tu plan de hoy', text: 'Cada día te decimos qué practicar y por qué, empezando por donde más puedes subir.' },
  { title: 'Revisión con tutor', text: 'Al terminar ves en qué fallaste, y un tutor te guía con preguntas hasta entenderlo.' },
]

/**
 * First-run welcome, shown once before the first diagnostic: what the exam
 * covers, how Aprendo works, and (signed in) the first week's commitment.
 *
 * Steps crossfade with the native View Transitions API; browsers without it
 * just swap the step.
 */
export function Welcome({ studentId, onDone }: { studentId?: string; onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const steps: StepId[] = studentId == null ? ['hello', 'how'] : ['hello', 'how', 'plan']
  const step = steps[index]!
  const isLast = index === steps.length - 1

  useEffect(() => {
    titleRef.current?.focus()
  }, [index])

  const crossfade = (update: () => void) => {
    if (typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => flushSync(update))
    } else {
      update()
    }
  }

  return (
    <section className="welcome">
      <div className="welcome-progress" role="img" aria-label={`Paso ${index + 1} de ${steps.length}`}>
        {steps.map((id, i) => (
          <span key={id} className={i <= index ? 'is-done' : undefined} />
        ))}
      </div>

      <h1 ref={titleRef} tabIndex={-1} className="page-title">
        {STEP_TITLES[step]}
      </h1>

      {step === 'hello' ? (
        <>
          <p className="page-lede">
            Aquí te preparas para el Saber 11 con preguntas tipo ICFES. Cada sesión apunta a lo que más te sube
            el puntaje.
          </p>
          <ul className="welcome-areas" aria-label="Las cinco áreas del examen">
            {getAllSubjectThemes().map((subject) => (
              <li key={subject.id} style={{ '--subject-color': subject.color } as CSSProperties}>
                <span aria-hidden="true" className="subject-dot" />
                {subject.label}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {step === 'how' ? (
        <ol className="welcome-steps">
          {FLOW.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {step === 'plan' && studentId != null ? (
        <>
          <FirstWeekCommit studentId={studentId} />
          <ExamCountdown studentId={studentId} examDate={null} plan={null} />
        </>
      ) : null}

      <div className="welcome-footer">
        {!isLast ? (
          <button type="button" className="btn-ghost" onClick={onDone}>
            Saltar
          </button>
        ) : <span />}
        <button
          type="button"
          className="btn-primary"
          // Leaving the welcome is the page's own fade; only the steps crossfade.
          onClick={isLast ? onDone : () => crossfade(() => setIndex(index + 1))}
        >
          {isLast ? 'Empezar mi diagnóstico' : 'Siguiente'}
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </section>
  )
}
