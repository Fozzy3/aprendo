import { useConvexMutation } from '@convex-dev/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react'
import { useCallback, useState } from 'react'
import { api } from '@aprendo/convex/api'
import type { Id } from '@aprendo/convex/dataModel'
import {
  MAX_TEXT_LENGTH,
  NOT_USED,
  NOT_USED_LABEL,
  PILOT_SURVEY_QUESTIONS,
  type SurveyAnswer,
  type SurveyAnswers,
  type SurveyQuestion,
} from '@aprendo/convex/pilotSurveyQuestions'
import { readConvexError } from '../lib/convex-error.ts'
import { motionTokens } from '../lib/motion-tokens.ts'

const QUESTIONS = PILOT_SURVEY_QUESTIONS
const SCALE = { scale5: [1, 2, 3, 4, 5], scale5_or_na: [1, 2, 3, 4, 5], nps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
const ENDS = {
  scale5: ['1 = nada', '5 = mucho'],
  scale5_or_na: ['1 = nada', '5 = mucho'],
  nps: ['0 = nada probable', '10 = muy probable'],
}

const isAnswered = (value: SurveyAnswer | undefined) =>
  value != null && (Array.isArray(value) ? value.length > 0 : typeof value !== 'string' || value.trim() !== '')

type Draft = { name: string; studentCode: string; answers: SurveyAnswers }

/** What gets sent: free text trimmed, and nothing for what was left blank. */
const toSubmit = (answers: SurveyAnswers): SurveyAnswers =>
  Object.fromEntries(Object.entries(answers).flatMap(([id, value]) =>
    isAnswered(value) ? [[id, typeof value === 'string' ? value.trim() : value]] : []))

/** Same step motion as the welcome (`Welcome.tsx`): slide by direction, blocks stagger. */
function stepVariants() {
  const t = motionTokens()
  return {
    t,
    step: {
      enter: (dir: number) => ({ opacity: 0, transform: `translateX(${dir * 24}px)` }),
      center: {
        opacity: 1,
        transform: 'translateX(0px)',
        transition: { duration: t.step, ease: t.ease, staggerChildren: t.stagger },
      },
      exit: (dir: number) => ({
        opacity: 0,
        transform: `translateX(${dir * -24}px)`,
        transition: { duration: t.quick, ease: t.ease },
      }),
    },
    item: {
      enter: { opacity: 0, transform: 'translateY(8px)' },
      center: { opacity: 1, transform: 'translateY(0px)', transition: { duration: t.step, ease: t.ease } },
    },
  } satisfies { t: unknown; step: Variants; item: Variants }
}

/**
 * The pilot survey, one question per screen (`/encuesta`), after a first screen
 * with the student's name and code. Those and the six scales are required; the
 * rest can be skipped. Sent once at the end; a failed send keeps
 * the student on the last question with every answer.
 */
export function PilotSurvey({ studentId, answered: answeredBefore = false }: { studentId: Id<'students'> | string; answered?: boolean }) {
  const submit = useConvexMutation(api.pilotSurvey.submit)
  // Page -1 asks who is answering; 0 onwards are the questions.
  const [[index, direction], setPage] = useState<[number, 1 | -1]>([-1, 1])
  // A draft in this browser, so a reload or a closed tab doesn't lose the answers; cleared once sent.
  const draftKey = `aprendo:encuesta:${studentId}`
  const [draft, setDraftState] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) ?? 'null') as Partial<Draft> | null
      return { name: saved?.name ?? '', studentCode: saved?.studentCode ?? '', answers: saved?.answers ?? {} }
    } catch {
      return { name: '', studentCode: '', answers: {} }
    }
  })
  const setDraft = (update: (current: Draft) => Draft) => setDraftState((current) => {
    const next = update(current)
    try {
      localStorage.setItem(draftKey, JSON.stringify(next))
    } catch {
      // Storage blocked: the answers still live in memory until sent.
    }
    return next
  })
  const answers = draft.answers
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const { t, step, item } = stepVariants()

  // Each question takes focus as it arrives, so a screen reader hears it.
  const focusTitle = useCallback((title: HTMLHeadingElement | null) => title?.focus(), [])

  // `done` first: the live `getMine` turning true right after sending must not change the screen.
  if (done) return <SurveyDone title="Gracias por contarnos" />
  if (answeredBefore) return <SurveyDone title="Ya la respondiste, gracias" />

  const question = index >= 0 ? QUESTIONS[index]! : null
  const value = question == null ? undefined : answers[question.id]
  const answered = question == null ? draft.name.trim() !== '' && draft.studentCode.trim() !== '' : isAnswered(value)
  const required = question == null || question.required === true
  const isLast = index === QUESTIONS.length - 1
  const set = (next: SurveyAnswer) => question != null
    && setDraft((current) => ({ ...current, answers: { ...current.answers, [question.id]: next } }))

  const go = (delta: 1 | -1) => {
    setError(null)
    setPage([index + delta, delta])
  }

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      await submit({ studentId: studentId as Id<'students'>, name: draft.name, studentCode: draft.studentCode, answers: toSubmit(answers) })
      try {
        localStorage.removeItem(draftKey)
      } catch {
        // Storage blocked: nothing was saved.
      }
      setDone(true)
    } catch (caught) {
      setError(readConvexError(caught, 'No pudimos enviar tus respuestas. Intenta de nuevo.'))
    } finally {
      setBusy(false)
    }
  }

  const skips = !answered && !required && !isLast
  const label = isLast ? (busy ? 'Enviando…' : 'Enviar') : skips ? 'Saltar' : 'Siguiente'

  return (
    <MotionConfig reducedMotion="user">
      <section className="welcome survey" aria-labelledby="survey-title">
        <div
          className="welcome-progress"
          role="progressbar"
          aria-label="Tu avance"
          aria-valuemin={0}
          aria-valuemax={QUESTIONS.length}
          aria-valuenow={index + 1}
          aria-valuetext={question == null ? 'Tus datos' : `Pregunta ${index + 1} de ${QUESTIONS.length}`}
        >
          <motion.span
            className="welcome-progress-fill"
            initial={false}
            animate={{ transform: `scaleX(${(index + 1) / QUESTIONS.length})` }}
            transition={{ type: 'spring', bounce: 0, duration: t.spring }}
          />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={question?.id ?? 'who'}
            className="welcome-step"
            custom={direction}
            variants={step}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <motion.h1 id="survey-title" ref={focusTitle} tabIndex={-1} className="survey-question" variants={item}>
              {question?.text ?? '¿Quién responde?'}
            </motion.h1>
            <motion.div variants={item}>
              {question == null ? (
                <div className="grid gap-3">
                  <label className="field">
                    <span>Nombre completo</span>
                    <input
                      className="input"
                      autoComplete="name"
                      maxLength={120}
                      value={draft.name}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Código de estudiante</span>
                    <input
                      className="input"
                      autoComplete="off"
                      maxLength={40}
                      value={draft.studentCode}
                      onChange={(event) => setDraft((current) => ({ ...current, studentCode: event.target.value }))}
                    />
                  </label>
                </div>
              ) : (
                <Answer question={question} value={value} onChange={set} />
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {error != null ? <p role="alert" className="notice is-danger">{error}</p> : null}

        <div className="welcome-footer">
          {index > -1 ? (
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => go(-1)}>
              <ArrowLeft size={16} aria-hidden /> Atrás
            </button>
          ) : <span />}
          <button
            type="button"
            className={skips ? 'btn-secondary' : 'btn-primary'}
            disabled={busy || (required && !answered)}
            onClick={() => (isLast ? void send() : go(1))}
          >
            {label}
            {skips ? null : <ArrowRight size={16} aria-hidden />}
          </button>
        </div>
      </section>
    </MotionConfig>
  )
}

function Answer({ question, value, onChange }: {
  question: SurveyQuestion
  value: SurveyAnswer | undefined
  onChange: (value: SurveyAnswer) => void
}) {
  const name = `survey-${question.id}`

  if (question.kind === 'text') {
    return (
      <textarea
        className="input survey-text"
        aria-labelledby="survey-title"
        rows={5}
        maxLength={MAX_TEXT_LENGTH}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (question.kind === 'single' || question.kind === 'multi') {
    const picked = Array.isArray(value) ? value : []
    const toggle = (id: string) => onChange(picked.includes(id) ? picked.filter((entry) => entry !== id) : [...picked, id])
    return (
      <fieldset className="welcome-choices is-stacked" aria-labelledby="survey-title">
        {question.kind === 'multi' ? <p className="welcome-note">Puedes marcar varias.</p> : null}
        {question.options?.map((option) => (
          <label key={option.id} className="welcome-choice">
            {question.kind === 'multi' ? (
              <input type="checkbox" checked={picked.includes(option.id)} onChange={() => toggle(option.id)} />
            ) : (
              <input type="radio" name={name} checked={value === option.id} onChange={() => onChange(option.id)} />
            )}
            <span><strong>{option.label}</strong></span>
          </label>
        ))}
      </fieldset>
    )
  }

  const [low, high] = ENDS[question.kind]
  return (
    <fieldset className="survey-scale" aria-labelledby="survey-title" aria-describedby={`${name}-ends`}>
      <div className={`survey-points${question.kind === 'nps' ? ' is-nps' : ''}`}>
        {SCALE[question.kind].map((point) => (
          <label key={point} className="welcome-choice survey-point">
            <input type="radio" name={name} value={point} checked={value === point} onChange={() => onChange(point)} />
            <span>{point}</span>
          </label>
        ))}
      </div>
      <p id={`${name}-ends`} className="survey-ends">
        <span>{low}</span>
        <span>{high}</span>
      </p>
      {question.kind === 'scale5_or_na' ? (
        <label className="welcome-choice">
          <input type="radio" name={name} value={NOT_USED} checked={value === NOT_USED} onChange={() => onChange(NOT_USED)} />
          <span><strong>{NOT_USED_LABEL}</strong></span>
        </label>
      ) : null}
    </fieldset>
  )
}

/** The end of the survey, and what it shows once it was answered. */
function SurveyDone({ title }: { title: string }) {
  const { t, step, item } = stepVariants()
  const focusTitle = useCallback((heading: HTMLHeadingElement | null) => heading?.focus(), [])
  return (
    <MotionConfig reducedMotion="user">
      <motion.section
        className="welcome survey"
        aria-labelledby="survey-title"
        custom={1}
        variants={step}
        initial="enter"
        animate="center"
      >
        <motion.span
          className="survey-done-icon"
          aria-hidden
          initial={{ opacity: 0, transform: 'scale(0.25)', filter: 'blur(4px)' }}
          animate={{ opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' }}
          transition={{ type: 'spring', bounce: 0, duration: t.spring, delay: t.step }}
        >
          <Check size={24} strokeWidth={3} />
        </motion.span>
        <motion.h1 id="survey-title" ref={focusTitle} tabIndex={-1} className="page-title" variants={item}>
          {title}
        </motion.h1>
        <motion.div variants={item}>
          <Link to="/today" className="btn-primary no-underline">Volver a Hoy</Link>
        </motion.div>
      </motion.section>
    </MotionConfig>
  )
}
