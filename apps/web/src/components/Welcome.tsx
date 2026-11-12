import { useConvexMutation } from '@convex-dev/react-query'
import { ArrowLeft, ArrowRight, Hourglass, ListChecks } from 'lucide-react'
import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion, type Variants } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import type { Doc } from '@aprendo/convex/dataModel'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import {
  DAILY_GOAL_OPTIONS,
  DEFAULT_DAILY_GOAL_QUESTIONS,
  MINUTES_PER_PRACTICE_QUESTION,
} from '@aprendo/convex/studyPlan'
import { readConvexError } from '../lib/convex-error.ts'
import { motionTokens } from '../lib/motion-tokens.ts'
import { formatTimeLimit } from '../lib/session-display.ts'
import { getAllSubjectThemes } from '../lib/subject-theme.ts'
import { useTrack } from '../lib/use-track.ts'
import { AvatarEditor } from './AvatarEditor.tsx'
import { ExamCountdown } from './ExamCountdown.tsx'
import { FirstWeekCommit } from './FirstWeek.tsx'
import { TimedSessionRules } from './TimedSessionIntro.tsx'

const DIAGNOSTIC = SESSION_KIND_CONFIG.diagnostic
const DEFAULT_DAYS = 5

type StepId = 'hello' | 'consent' | 'exam' | 'goal' | 'avatar' | 'reminders' | 'diagnostic'

/** The full welcome, and the short one for students placed before consent was asked. */
const FULL: StepId[] = ['hello', 'consent', 'exam', 'goal', 'avatar', 'reminders', 'diagnostic']
const SHORT: StepId[] = ['consent', 'goal']

const TITLES: Record<Exclude<StepId, 'hello'>, string> = {
  consent: 'Antes de empezar',
  exam: 'Tu examen',
  goal: 'Tu meta diaria',
  avatar: 'Tu personaje',
  reminders: 'Recordatorios',
  diagnostic: 'Tu diagnóstico',
}

export type WelcomeStudent = Pick<
  Doc<'students'>,
  '_id' | 'name' | 'examDate' | 'avatar' | 'nickname' | 'isMinor' | 'consentAt' | 'dailyGoalQuestions' | 'remindersOff'
>

/**
 * First run, one decision per screen: consent (required), exam date, daily
 * goal, character, reminders, then the diagnostic. Done is stored on the
 * student (`completeOnboarding`), so it never repeats on another device.
 *
 * `short` asks only consent and the daily goal. `onDone` starts the diagnostic
 * (full) or goes back to where the student was (short); full starts it before
 * marking the welcome done, so a failed start keeps the student here.
 */
export function Welcome({
  student,
  short = false,
  onDone,
}: {
  student: WelcomeStudent
  short?: boolean
  onDone: () => Promise<void> | void
}) {
  const studentId = student._id
  const steps = short ? SHORT : FULL
  const [[index, direction], setPage] = useState<[number, 1 | -1]>([0, 1])
  const step = steps[index]!
  const isLast = index === steps.length - 1
  const t = motionTokens()
  const track = useTrack(studentId)

  const recordConsent = useConvexMutation(api.students.recordConsent)
  const setDailyGoal = useConvexMutation(api.students.setDailyGoal)
  const setWeeklyGoal = useConvexMutation(api.students.setWeeklyGoal)
  const setReminders = useConvexMutation(api.students.setReminders)
  const completeOnboarding = useConvexMutation(api.students.completeOnboarding)

  const [isMinor, setIsMinor] = useState<boolean | null>(student.isMinor ?? null)
  const [accepted, setAccepted] = useState(student.consentAt != null)
  const [goal, setGoal] = useState(student.dailyGoalQuestions ?? DEFAULT_DAILY_GOAL_QUESTIONS)
  const [days, setDays] = useState(DEFAULT_DAYS)
  const [remindersOn, setRemindersOn] = useState(student.remindersOff !== true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    track('onboarding_step', short ? { step, short } : { step })
  }, [short, step, track])

  // Each step's title takes focus as it arrives, so a screen reader hears the new screen.
  const focusTitle = useCallback((title: HTMLHeadingElement | null) => title?.focus(), [])

  const go = (delta: 1 | -1) => {
    setError(null)
    setPage([index + delta, delta])
  }

  /** A failed save keeps the student on the step and says why. */
  const run = async (work: () => Promise<unknown>, fallback = 'No se pudo guardar. Intenta de nuevo.') => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (caught) {
      setError(readConvexError(caught, fallback))
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    if (short) {
      await completeOnboarding({ studentId })
      track('onboarding_done', { short })
      await onDone()
      return
    }
    await onDone()
    await completeOnboarding({ studentId })
    track('onboarding_done')
  }
  const advance = () => (isLast ? finish() : go(1))

  const next = () => {
    if (step === 'consent') {
      return run(async () => {
        await recordConsent({ studentId, isMinor: isMinor === true })
        await advance()
      })
    }
    if (step === 'goal') {
      return run(async () => {
        await Promise.all([
          setDailyGoal({ studentId, questions: goal }),
          setWeeklyGoal({ studentId, minutes: days * goal * MINUTES_PER_PRACTICE_QUESTION }),
        ])
        await advance()
      })
    }
    if (step === 'diagnostic') return run(finish, 'No pudimos iniciar el diagnóstico. Intenta de nuevo.')
    return advance()
  }

  const toggleReminders = (on: boolean) => {
    setRemindersOn(on)
    void run(() => setReminders({ studentId, off: !on }).catch((caught: unknown) => {
      setRemindersOn(!on)
      throw caught
    }))
  }

  const pickAge = (minor: boolean) => {
    // The box means something else for each answer, so it is asked again.
    if (minor !== isMinor) setAccepted(false)
    setIsMinor(minor)
  }

  const variants = {
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
    list: {
      enter: {},
      center: { transition: { staggerChildren: t.stagger, delayChildren: t.stagger * 2 } },
    },
    chip: {
      enter: { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
      center: { opacity: 1, transform: 'translateY(0px) scale(1)', transition: { duration: t.step, ease: t.ease } },
    },
  } satisfies Record<string, Variants>

  const firstName = student.name?.trim().split(/\s+/)[0]
  const title = step === 'hello' ? (firstName ? `Hola, ${firstName}` : 'Hola') : TITLES[step]
  const canContinue = step !== 'consent' || (isMinor != null && accepted)
  const skipsExam = step === 'exam' && student.examDate == null
  const label = step === 'hello'
    ? 'Empezar'
    : step === 'consent'
      ? 'Continuar'
      : skipsExam
        ? 'Ahora no'
        : step === 'diagnostic'
          ? busy ? 'Empezando…' : 'Empezar mi diagnóstico'
          : isLast ? 'Listo' : 'Siguiente'

  return (
    <MotionConfig reducedMotion="user">
      <section className="welcome" aria-labelledby="welcome-title">
        <div
          className="welcome-progress"
          role="progressbar"
          aria-label="Tu avance"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-valuetext={`Paso ${index + 1} de ${steps.length}`}
        >
          <motion.span
            className="welcome-progress-fill"
            initial={false}
            animate={{ transform: `scaleX(${(index + 1) / steps.length})` }}
            transition={{ type: 'spring', bounce: 0, duration: t.spring }}
          />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            className="welcome-step"
            custom={direction}
            variants={variants.step}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <motion.h1 id="welcome-title" ref={focusTitle} tabIndex={-1} className="page-title" variants={variants.item}>
              {title}
            </motion.h1>

            {step === 'hello' ? (
              <>
                <motion.p className="page-lede" variants={variants.item}>
                  Aquí te preparas para el Saber 11. Te hacemos unas preguntas rápidas y armamos tu plan.
                </motion.p>
                <motion.ul className="welcome-areas" aria-label="Las cinco áreas del examen" variants={variants.list}>
                  {getAllSubjectThemes().map((subject) => (
                    <motion.li
                      key={subject.id}
                      style={{ '--subject-color': subject.color } as CSSProperties}
                      variants={variants.chip}
                    >
                      <span aria-hidden="true" className="subject-dot" />
                      {subject.label}
                    </motion.li>
                  ))}
                </motion.ul>
              </>
            ) : null}

            {step === 'consent' ? (
              <>
                <motion.fieldset className="welcome-choices is-stacked" variants={variants.item}>
                  <legend>¿Cuántos años tienes?</legend>
                  <label className="welcome-choice">
                    <input type="radio" name="welcome-age" checked={isMinor === true} onChange={() => pickAge(true)} />
                    <span><strong>Tengo menos de 18</strong></span>
                  </label>
                  <label className="welcome-choice">
                    <input type="radio" name="welcome-age" checked={isMinor === false} onChange={() => pickAge(false)} />
                    <span><strong>Tengo 18 o más</strong></span>
                  </label>
                </motion.fieldset>
                {isMinor != null ? (
                  <motion.div className="welcome-consent" variants={variants.item}>
                    <label className="welcome-check">
                      <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
                      <span>
                        {isMinor ? (
                          'Mi acudiente sabe que uso Aprendo y lo autoriza.'
                        ) : (
                          <>Acepto los <LegalLinks /></>
                        )}
                      </span>
                    </label>
                    {isMinor ? <p className="welcome-note">Léelos con tu acudiente: los <LegalLinks /></p> : null}
                  </motion.div>
                ) : null}
              </>
            ) : null}

            {step === 'exam' ? (
              <motion.div variants={variants.item}>
                <ExamCountdown studentId={studentId} examDate={student.examDate ?? null} plan={null} />
                {student.examDate != null ? (
                  <p className="welcome-note" role="status">
                    Fecha guardada: {new Date(student.examDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.
                  </p>
                ) : null}
              </motion.div>
            ) : null}

            {step === 'goal' ? (
              <>
                <motion.fieldset className="welcome-choices" variants={variants.item}>
                  <legend>¿Cuántas preguntas al día?</legend>
                  {DAILY_GOAL_OPTIONS.map((questions) => (
                    <label key={questions} className="welcome-choice">
                      <input type="radio" name="welcome-goal" checked={goal === questions} onChange={() => setGoal(questions)} />
                      <span>
                        <strong>{questions} <span className="welcome-choice-unit">preguntas</span></strong>
                        <small>unos {questions * MINUTES_PER_PRACTICE_QUESTION} min</small>
                      </span>
                    </label>
                  ))}
                </motion.fieldset>
                <motion.div variants={variants.item}>
                  <FirstWeekCommit
                    studentId={studentId}
                    value={days}
                    onChange={setDays}
                    minutesPerDay={goal * MINUTES_PER_PRACTICE_QUESTION}
                  />
                </motion.div>
                <motion.p className="welcome-week" variants={variants.item}>
                  A la semana: <strong><CountUp value={goal * days} duration={t.step} /> preguntas</strong>
                </motion.p>
              </>
            ) : null}

            {step === 'avatar' ? (
              <>
                <motion.p className="page-lede" variants={variants.item}>
                  Así te ven en la liga de tu clase. Lo puedes cambiar en Yo.
                </motion.p>
                <motion.div variants={variants.item}>
                  <AvatarEditor studentId={studentId} avatar={student.avatar ?? null} nickname={student.nickname ?? null} />
                </motion.div>
              </>
            ) : null}

            {step === 'reminders' ? (
              <>
                <motion.p className="page-lede" variants={variants.item}>
                  Te escribimos cuando tu racha está por cortarse o si llevas unos días sin practicar.
                </motion.p>
                <motion.label className="welcome-switch" variants={variants.item}>
                  <span>Recordatorios por correo</span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={remindersOn}
                    onChange={(event) => toggleReminders(event.target.checked)}
                  />
                </motion.label>
              </>
            ) : null}

            {step === 'diagnostic' ? (
              <>
                <motion.p className="timed-intro-facts" variants={variants.item}>
                  <span>
                    <ListChecks size={16} aria-hidden /> {getConfiguredQuestionCount(DIAGNOSTIC)} preguntas
                  </span>
                  <span>
                    <Hourglass size={16} aria-hidden /> {formatTimeLimit(DIAGNOSTIC.timeLimitMs ?? 0)}
                  </span>
                </motion.p>
                <motion.p className="page-lede" variants={variants.item}>
                  Preguntas de las cinco áreas, sin ayuda. Con ellas vemos tu nivel y armamos tu plan.
                </motion.p>
                <motion.div variants={variants.item}>
                  <TimedSessionRules />
                </motion.div>
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>

        {error != null ? <p role="alert" className="notice is-danger">{error}</p> : null}

        <div className="welcome-footer">
          {index > 0 ? (
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => go(-1)}>
              <ArrowLeft size={16} aria-hidden /> Atrás
            </button>
          ) : <span />}
          <button
            type="button"
            className={skipsExam ? 'btn-secondary' : 'btn-primary'}
            disabled={busy || !canContinue}
            onClick={() => void next()}
          >
            {label}
            {skipsExam ? null : <ArrowRight size={16} aria-hidden />}
          </button>
        </div>
      </section>
    </MotionConfig>
  )
}

function LegalLinks() {
  return (
    <>
      <a href="/terminos" target="_blank" rel="noreferrer">términos</a> y la{' '}
      <a href="/privacidad" target="_blank" rel="noreferrer">política de privacidad</a>.
    </>
  )
}

/** The weekly total climbs to its new value; under reduced motion it just changes. */
function CountUp({ value, duration }: { value: number; duration: number }) {
  const reduceMotion = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    if (reduceMotion || from.current === value) {
      from.current = value
      setShown(value)
      return
    }
    const controls = animate(from.current, value, {
      duration,
      onUpdate: (latest) => {
        from.current = latest
        setShown(Math.round(latest))
      },
    })
    return () => controls.stop()
  }, [duration, reduceMotion, value])

  return (
    <span className="tabular-nums">
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  )
}
