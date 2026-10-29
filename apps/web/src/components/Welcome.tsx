import { ArrowRight, Gauge, MessageCircleQuestion, Sun, Target, Timer, TrendingUp } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

type Step = { title: string; lede?: string; points?: { icon: ReactNode; title: string; text: string }[] }

const STEPS: Step[] = [
  {
    title: 'Bienvenido a Aprendo',
    lede: 'Aquí te preparas para el Saber 11 con preguntas tipo ICFES. Cada sesión apunta a lo que más te sube el puntaje.',
  },
  {
    title: 'Así funciona',
    points: [
      { icon: <Gauge size={18} aria-hidden />, title: 'Nivelación', text: '15 preguntas por área, sin ayuda. Así conocemos tu nivel real.' },
      { icon: <Sun size={18} aria-hidden />, title: 'Tu plan de hoy', text: 'Cada día te decimos qué practicar, empezando por tus temas más débiles.' },
      { icon: <MessageCircleQuestion size={18} aria-hidden />, title: 'Revisión con tutor', text: 'Al terminar ves en qué fallaste y un tutor te explica por qué.' },
    ],
  },
  {
    title: 'Lo que vas a lograr',
    points: [
      { icon: <Target size={18} aria-hidden />, title: 'Saber dónde estás', text: 'Tu puntaje estimado y tu nivel en cada una de las cinco áreas.' },
      { icon: <TrendingUp size={18} aria-hidden />, title: 'Subir en tus puntos débiles', text: 'Práctica que se ajusta a lo que fallas, no a lo que ya sabes.' },
      { icon: <Timer size={18} aria-hidden />, title: 'Llegar entrenado', text: 'Simulacros con reloj, como el día del examen.' },
    ],
  },
]

/**
 * First-run welcome, shown once before the first nivelación.
 *
 * Steps crossfade with the native View Transitions API (fade out, fade in);
 * browsers without it just swap the step.
 */
export function Welcome({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const step = STEPS[index]!
  const isLast = index === STEPS.length - 1

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
      <h1 ref={titleRef} tabIndex={-1} className="page-title">
        {step.title}
      </h1>
      {step.lede != null ? <p className="page-lede">{step.lede}</p> : null}
      {step.points != null ? (
        <ul className="welcome-points">
          {step.points.map((point) => (
            <li key={point.title}>
              {point.icon}
              <span>
                <strong>{point.title}</strong> {point.text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="welcome-footer">
        <div className="welcome-dots" role="img" aria-label={`Paso ${index + 1} de ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s.title} className={i === index ? 'is-current' : undefined} />
          ))}
        </div>
        <div className="timed-intro-actions">
          {!isLast ? (
            <button type="button" className="btn-ghost" onClick={onDone}>
              Saltar
            </button>
          ) : null}
          <button
            type="button"
            className="btn-primary"
            // Leaving the welcome is the page's own fade; only the steps crossfade.
            onClick={isLast ? onDone : () => crossfade(() => setIndex(index + 1))}
          >
            {isLast ? 'Empezar mi nivelación' : 'Siguiente'}
            <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    </section>
  )
}
