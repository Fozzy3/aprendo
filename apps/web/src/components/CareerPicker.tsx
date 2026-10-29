import { useConvexMutation } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { CAREER_FAMILIES, INTEREST_ITEMS, getCareerFamily, suggestFamilies } from '@aprendo/convex/careers'
import { studentQuery } from '../lib/student-queries.ts'

const ANSWERS = [
  { value: 2, label: 'Me gusta' },
  { value: 1, label: 'Me da igual' },
  { value: 0, label: 'No me gusta' },
] as const

const BUSCANDO_CARRERA = 'https://www.mineducacion.gov.co/sistemasdeinformacion/1735/article-234959.html'

/**
 * "¿Para qué carrera es este puntaje?" (plans/meta-carrera.md): a career family,
 * or a 12-activity interest check (RIASEC) for who does not know yet. It
 * orients, never decides, and it is never a gate: `onSkip` is always there.
 */
export function CareerPicker({ onChoose, onSkip }: { onChoose: (familyId: string) => void; onSkip?: () => void }) {
  const [step, setStep] = useState<'families' | 'quiz' | 'result'>('families')
  const [answers, setAnswers] = useState<Record<string, number>>({})

  if (step === 'quiz') {
    const isComplete = INTEREST_ITEMS.every((item) => answers[item.id] != null)
    return (
      <div key="quiz" className="career-picker">
        <button type="button" className="back-link" onClick={() => setStep('families')}>
          <ArrowLeft size={14} aria-hidden /> Volver a las familias
        </button>
        <p className="text-sm text-[var(--text-secondary)]">¿Qué tanto te gusta cada actividad?</p>
        {INTEREST_ITEMS.map((item) => (
          <fieldset key={item.id} className="career-quiz-item">
            <legend>{item.text}</legend>
            {ANSWERS.map((answer) => (
              <label key={answer.value}>
                <input
                  type="radio"
                  name={item.id}
                  checked={answers[item.id] === answer.value}
                  onChange={() => setAnswers((prev) => ({ ...prev, [item.id]: answer.value }))}
                />
                {answer.label}
              </label>
            ))}
          </fieldset>
        ))}
        <button type="button" className="btn-primary" disabled={!isComplete} onClick={() => setStep('result')}>
          Ver mis familias
        </button>
      </div>
    )
  }

  if (step === 'result') {
    return (
      <div key="result" className="career-picker">
        <p className="text-sm text-[var(--text-secondary)]">Por lo que te gusta, podrías explorar:</p>
        <ul className="ruled-list">
          {suggestFamilies(answers).map((familyId) => {
            const family = getCareerFamily(familyId)!
            return (
              <li key={familyId} className="ruled-row">
                <span className="ruled-row-main">
                  <span className="font-semibold">{family.label}</span>
                  <span className="ruled-row-note">{family.examples}</span>
                </span>
                <button type="button" className="btn-secondary" onClick={() => onChoose(familyId)}>
                  Elegir {family.label}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-[var(--text-tertiary)]">
          Esto orienta, no decide. Habla también con el orientador de tu colegio y mira los programas en{' '}
          <a href={BUSCANDO_CARRERA} target="_blank" rel="noreferrer">Buscando carrera (MEN)</a>.
        </p>
        <button type="button" className="btn-ghost" onClick={() => setStep('families')}>
          Ver todas las familias
        </button>
      </div>
    )
  }

  return (
    <div key="families" className="career-picker">
      <ul className="career-families">
        {CAREER_FAMILIES.map((family) => (
          <li key={family.id}>
            <button type="button" className="career-family" onClick={() => onChoose(family.id)}>
              <span className="font-semibold">{family.label}</span>
              <span className="text-xs text-[var(--text-tertiary)]">{family.examples}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => setStep('quiz')}>
          Todavía no sé
        </button>
        {onSkip != null ? (
          <button type="button" className="btn-ghost" onClick={onSkip}>
            Ahora no
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Where the career shows up. `invite`: after a nivelación and on Hoy, only
 * while the student has none ("Ahora no" hides it for this visit). `summary`:
 * Progreso, with the weighted score and "Cambiar".
 */
export function CareerCard({
  studentId,
  mode,
  career,
}: {
  studentId: string
  mode: 'invite' | 'summary'
  /** Progreso's `globalScore.career`, for the weighted score. */
  career?: { label: string; source: string; score: number | null } | null
}) {
  const student = useQuery(studentQuery(studentId))
  const setCareer = useConvexMutation(api.students.setCareerFamily)
  const [isOpen, setIsOpen] = useState(mode === 'invite')
  const [isHidden, setIsHidden] = useState(false)
  const choose = (familyId: string) => {
    void setCareer({ studentId: studentId as never, careerFamily: familyId })
    setIsOpen(false)
  }

  if (student.data == null || isHidden) return null
  const current = getCareerFamily(student.data.careerFamily)
  if (mode === 'invite' && current != null) return null

  return (
    <section className="ruled-section" aria-labelledby={`career-${mode}-title`}>
      <h2 id={`career-${mode}-title`} className="section-title">
        {mode === 'invite' ? '¿Para qué carrera es este puntaje?' : 'Tu carrera'}
      </h2>
      {mode === 'invite' ? (
        <p className="text-sm text-[var(--text-secondary)]">
          Las universidades públicas ponderan las áreas según la carrera. Con tu carrera, tu plan pone primero lo que más te suma.
        </p>
      ) : current != null ? (
        <p className="text-sm text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">{current.label}</strong>
          {career?.score != null ? ` · ponderado típico ${career.score}/100 (${career.source})` : ' · el ponderado aparece con las cinco áreas niveladas'}
          {' · '}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setIsOpen((open) => !open)}>
            {isOpen ? 'Cerrar' : 'Cambiar'}
          </button>
        </p>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => setIsOpen(true)}>
          Elegir mi carrera
        </button>
      )}
      {isOpen ? <CareerPicker onChoose={choose} onSkip={mode === 'invite' ? () => setIsHidden(true) : undefined} /> : null}
    </section>
  )
}
