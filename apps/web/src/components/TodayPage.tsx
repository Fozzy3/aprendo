import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpen, CalendarDays, Check, ChevronRight, Flame, Hourglass, MessageCircle, Repeat, Shield, Target, Zap } from 'lucide-react'
import { MotionConfig, motion } from 'motion/react'
import { useEffect, useState, type CSSProperties } from 'react'
import type { FunctionArgs } from 'convex/server'
import { api } from '@aprendo/convex/api'
import { isStreakAtRisk } from '@aprendo/convex/rewards'
import { SESSION_KIND_CONFIG } from '@aprendo/convex/sessionKinds'
import type { StudyTask, StudyTaskAction } from '@aprendo/convex/studyPlan'
import { readConvexError } from '../lib/convex-error.ts'
import { motionTokens } from '../lib/motion-tokens.ts'
import {
  activeSessionQuery,
  mySchoolsQuery,
  pathSubjectsQuery,
  todayDashboardQuery,
} from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { areaRows, comebackLaunch, taskTarget } from '../lib/today-display.ts'
import { useTrack } from '../lib/use-track.ts'
import { ActiveDuelBanner } from './ActiveDuelBanner.tsx'
import { PageLoader } from './FullScreenLoader.tsx'
import { FirstWeekCommit } from './FirstWeek.tsx'
import { LeagueStrip } from './LeagueStrip.tsx'
import { TeacherAssignments } from './TeacherAssignments.tsx'

type Task = Pick<StudyTask, 'id' | 'kind' | 'title' | 'reason' | 'minutes' | 'action'>
type Launch = Omit<FunctionArgs<typeof api.sessions.createSession>, 'studentId'>
type WeekDay = { day: number; status: 'done' | 'today' | 'open' | 'upcoming'; isToday: boolean }

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DAY_STATE = { done: 'practicaste', today: 'hoy', open: 'sin práctica', upcoming: 'por venir' } as const

/** The shield note shows once: the day it covered, remembered on this device. */
const SHIELD_SEEN_KEY = 'aprendo:escudo-visto'

function readShieldSeen() {
  try {
    return window.localStorage.getItem(SHIELD_SEEN_KEY)
  } catch {
    return null
  }
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const TASK_ICON = {
  lesson: BookOpen,
  practice: Target,
  repaso: Repeat,
  reto: Zap,
  simulacro: Hourglass,
  nivelacion: Hourglass,
} as const

const GO_LABEL = { lesson: 'Ver la lección', link: 'Ir', launch: 'Empezar' } as const

/** The area a task works on, when it names one. */
function taskSubject(action: StudyTaskAction): string | null {
  if (action.type === 'lesson') return action.subtopicId.split('.')[0] ?? null
  return action.subjectId ?? action.subtopicId?.split('.')[0] ?? null
}

/**
 * Hoy: what to do now and why, the rest of the day's plan, and how each area
 * is going, all in words. The plan is the backend's (`studyPlan.buildStudyPlan`);
 * this screen only lays it out.
 */
export function TodayPage({ studentId, name }: { studentId: string; name: string | null }) {
  const navigate = useNavigate()
  const dashboard = useQuery(todayDashboardQuery(studentId))
  const album = useQuery(convexQuery(api.today.getStickerAlbum, { studentId: studentId as never }))
  const subjects = useQuery(pathSubjectsQuery(studentId))
  const active = useQuery(activeSessionQuery(studentId))
  const schools = useQuery(mySchoolsQuery)

  const createSession = useConvexMutation(api.sessions.createSession)
  const launch = useMutation({
    mutationFn: (args: Launch) => createSession({ studentId: studentId as never, ...args }),
    onSuccess: (sessionId) => navigate({ to: '/practice/$sessionId', params: { sessionId } }),
  })
  const [shieldSeen, setShieldSeen] = useState(readShieldSeen)

  if (dashboard.isError) {
    return (
      <div className="hoy" role="alert">
        <h1 className="hoy-title">No pudimos abrir tu plan</h1>
        <p className="hoy-reason">{readConvexError(dashboard.error, 'Intenta recargar en un momento.')}</p>
        <Link to="/practice" className="btn-secondary no-underline">Ir a Retos</Link>
      </div>
    )
  }
  if (dashboard.data == null) return <PageLoader message="Armando tu plan de hoy…" />

  const { plan, streakDays, shields, xp, firstWeek, examPlan, week, shieldUsedDay, comeback, practicedToday, surveyDue } = dashboard.data
  const openSession = active.data ?? null
  const fallback: Task = {
    id: 'hero',
    kind: 'practice',
    title: 'Práctica recomendada',
    reason: `${plan.hero.questionCount} preguntas de los temas donde más puedes subir.`,
    minutes: plan.hero.minutes,
    action: plan.hero.action,
  }
  const [next = fallback, ...rest] = plan.tasks as Task[]
  const firstName = (name ?? '').trim().split(/\s+/)[0] ?? ''
  const daysToExam = examPlan != null && examPlan.daysRemaining >= 0 ? examPlan.daysRemaining : null

  const start = (task: Task) => {
    const target = taskTarget(task)
    if (target.type === 'launch') launch.mutate(target.args)
  }
  const atRisk = isStreakAtRisk({ streakDays, practicedToday, nowMs: Date.now() })
  const showShieldNote = shieldUsedDay != null && shieldSeen !== String(shieldUsedDay)
  const dismissShieldNote = () => {
    setShieldSeen(String(shieldUsedDay))
    try {
      window.localStorage.setItem(SHIELD_SEEN_KEY, String(shieldUsedDay))
    } catch {
      // Private mode: it just shows again next time.
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="hoy fade-in">
        <div className="hoy-grid">
          <div className="hoy-main">
            {/* In the main column, so on a wide screen the side column starts beside the greeting. */}
            <header className="hoy-head">
              <h1 className="hoy-title">{firstName === '' ? 'Hoy' : `Hola, ${firstName}`}</h1>
              <ul className="hoy-status" aria-label="Tu racha y tu examen">
                <li><Flame size={16} aria-hidden /> {streakDays > 0 ? `Racha de ${plural(streakDays, 'día', 'días')}` : 'Empieza tu racha hoy'}</li>
                <li><Zap size={16} aria-hidden /> {xp.today} XP hoy</li>
                {shields > 0 ? <li><Shield size={16} aria-hidden /> {plural(shields, 'escudo', 'escudos')}</li> : null}
                {daysToExam != null ? <li><CalendarDays size={16} aria-hidden /> {daysToExam === 0 ? 'El examen es hoy' : `Examen en ${plural(daysToExam, 'día', 'días')}`}</li> : null}
              </ul>
              <GoalMeter answered={plan.hero.answeredToday} goal={plan.hero.goalQuestions} />
            </header>

            {showShieldNote ? (
              <div className="hoy-note" role="status">
                <span className="hoy-note-icon" aria-hidden><Shield size={18} /></span>
                <p className="hoy-note-text">Un escudo cuidó tu racha ayer.</p>
                <button type="button" className="btn-ghost hoy-note-close" onClick={dismissShieldNote}>Entendido</button>
              </div>
            ) : null}

            <ActiveDuelBanner studentId={studentId} />

            <section className="next" aria-labelledby="hoy-next-title">
              <h2 id="hoy-next-title" className="hoy-section-title">Tu siguiente paso</h2>
              {openSession != null ? (
                <div className="next-card">
                  <p className="next-title">Sigue donde ibas</p>
                  <p className="next-reason">
                    Tienes un {SESSION_KIND_CONFIG[openSession.kind].labelEs.toLowerCase()} abierto de {plural(openSession.questionCount, 'pregunta', 'preguntas')}.
                  </p>
                  <Link to="/practice/$sessionId" params={{ sessionId: openSession._id }} className="btn-primary next-go no-underline">
                    Continuar
                  </Link>
                </div>
              ) : comeback ? (
                <div className="next-card">
                  <p className="next-title">¡Qué bueno verte! Empecemos suave</p>
                  <p className="next-reason">Cinco preguntas para retomar el ritmo.</p>
                  <button
                    type="button"
                    className="btn-primary next-go"
                    disabled={launch.isPending}
                    onClick={() => launch.mutate(comebackLaunch(plan.tasks))}
                  >
                    {launch.isPending ? 'Preparando…' : 'Empezar'}
                  </button>
                </div>
              ) : (
                <NextCard
                  task={next}
                  busy={launch.isPending}
                  onStart={() => start(next)}
                  note={atRisk
                    ? `Tu racha de ${plural(streakDays, 'día', 'días')} sigue viva: ${plan.hero.goalQuestions} preguntas la cuidan.`
                    : null}
                />
              )}
              {launch.error != null ? (
                <p role="alert" className="notice is-danger">{readConvexError(launch.error, 'No se pudo empezar. Intenta de nuevo.')}</p>
              ) : null}
            </section>

            {rest.length > 0 ? (
              <section aria-labelledby="hoy-rest-title">
                <h2 id="hoy-rest-title" className="hoy-section-title">También para hoy</h2>
                <ul className="plan-list">
                  {rest.map((task) => (
                    <li key={task.id}>
                      <TaskRow task={task} busy={launch.isPending} onStart={() => start(task)} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {surveyDue ? <SurveyCard studentId={studentId} /> : null}

            <TeacherAssignments studentId={studentId} />
          </div>

          <aside className="hoy-side">
            {/* Students placed before the welcome asked it still choose their days here. */}
            {firstWeek.active && !firstWeek.committed ? (
              <section className="first-week" aria-label="Tu primera semana"><FirstWeekCommit studentId={studentId} /></section>
            ) : null}

            <WeekStrip week={week} />

            <LeagueStrip studentId={studentId} />

            {album.data != null ? (
              <section aria-labelledby="hoy-areas-title">
                <h2 id="hoy-areas-title" className="hoy-section-title">Tus áreas</h2>
                <ul className="area-list">
                  {areaRows(album.data, subjects.data).map((area) => (
                    <li key={area.subjectId}>
                      <Link
                        to="/path"
                        search={{ area: area.subjectId }}
                        className="area-row no-underline"
                        style={{ '--area': getSubjectTheme(area.subjectId).color } as CSSProperties}
                      >
                        <span className="area-row-top">
                          <span className="area-row-name">{area.label}</span>
                          <span className="area-row-level">{area.level ?? 'Sin nivel aún'}</span>
                        </span>
                        <span className="area-bar" aria-hidden>
                          <span style={{ width: `${area.total === 0 ? 0 : (area.done / area.total) * 100}%` }} />
                        </span>
                        <span className="area-row-count">
                          {area.done} de {area.total} temas en Competente o más
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {schools.data != null && schools.data.length === 0 ? (
              <Link to="/join" className="plan-row no-underline">
                <span className="plan-row-text">
                  <b>Unirme a mi curso</b>
                  <span>Con el código de tu profe</span>
                </span>
                <ChevronRight size={20} aria-hidden />
              </Link>
            ) : null}
          </aside>
        </div>
      </div>
    </MotionConfig>
  )
}

/**
 * Answers today against the daily goal. The fill grows to where the day is;
 * the day the goal is met the check settles in once and the bar turns green.
 */
function GoalMeter({ answered, goal }: { answered: number; goal: number }) {
  const met = answered >= goal
  const t = motionTokens()
  return (
    <div className={`goal-meter${met ? ' is-met' : ''}`}>
      <p className="goal-meter-text">
        <span className="goal-meter-icon" aria-hidden>
          {met ? (
            <motion.span
              initial={{ opacity: 0, transform: 'scale(0.25)', filter: 'blur(4px)' }}
              animate={{ opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' }}
              transition={{ type: 'spring', duration: t.spring, bounce: 0.3, delay: t.step }}
            >
              <Check size={16} strokeWidth={3} />
            </motion.span>
          ) : <Target size={16} />}
        </span>
        <b>{met ? 'Meta cumplida' : 'Meta de hoy'}</b>
        <span className="goal-meter-count">{met ? `${plural(answered, 'pregunta', 'preguntas')} hoy` : `${answered} de ${goal} preguntas`}</span>
      </p>
      <span className="goal-meter-bar" aria-hidden>
        <motion.span
          initial={{ transform: 'scaleX(0)' }}
          animate={{ transform: `scaleX(${Math.min(1, answered / goal)})` }}
          transition={{ duration: t.step, ease: t.ease }}
        />
      </span>
    </div>
  )
}

/** The pilot survey, while it is due (`today.surveyDue`); counted once per visit. */
function SurveyCard({ studentId }: { studentId: string }) {
  const track = useTrack(studentId as never)
  useEffect(() => {
    track('survey_shown')
  }, [track])
  return (
    <Link to="/encuesta" className="plan-row no-underline">
      <span className="plan-row-icon" aria-hidden><MessageCircle size={20} /></span>
      <span className="plan-row-text">
        <b>Cuéntanos cómo te va (4 min)</b>
        <span>Una encuesta corta para mejorar Aprendo.</span>
      </span>
      <ChevronRight size={20} aria-hidden />
    </Link>
  )
}

/** This week, Monday to Sunday. A past day without practice is neutral, never a miss (G5). */
function WeekStrip({ week }: { week: WeekDay[] }) {
  return (
    <section className="week-strip" aria-labelledby="week-strip-title">
      <h2 id="week-strip-title" className="week-strip-title">Tu semana</h2>
      <ol>
        {week.map((entry, index) => (
          <li
            key={entry.day}
            className={`is-${entry.status}${entry.isToday ? ' is-today' : ''}`}
            aria-label={`${WEEKDAYS[index]}: ${DAY_STATE[entry.status]}`}
          >
            <span className="week-strip-dot" aria-hidden>
              {entry.status === 'done' ? <Check size={14} strokeWidth={3} /> : null}
            </span>
            <span className="week-strip-letter" aria-hidden>{WEEKDAYS[index]?.[0]}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function TaskMeta({ task }: { task: Task }) {
  const subjectId = taskSubject(task.action)
  return (
    <span className="task-meta">
      {subjectId != null ? (
        <span className="task-area" style={{ '--area': getSubjectTheme(subjectId).color } as CSSProperties}>
          {getSubjectTheme(subjectId).label}
        </span>
      ) : null}
      <span>{task.minutes >= 60 ? `${Math.round(task.minutes / 6) / 10} h` : `${task.minutes} min`}</span>
    </span>
  )
}

/** The one big step: its title, why it, and the button. `note` is the streak to look after tonight. */
function NextCard({ task, busy, onStart, note }: { task: Task; busy: boolean; onStart: () => void; note: string | null }) {
  const target = taskTarget(task)
  const label = GO_LABEL[target.type]
  return (
    <div className="next-card">
      {note != null ? <p className="next-note"><Flame size={16} aria-hidden /> {note}</p> : null}
      <p className="next-title">{task.title}</p>
      <p className="next-reason">{task.reason}</p>
      <TaskMeta task={task} />
      {target.type === 'lesson' ? (
        <Link to="/lesson/$subtopicId" params={{ subtopicId: target.subtopicId }} className="btn-primary next-go no-underline">{label}</Link>
      ) : target.type === 'link' ? (
        <Link to={target.to} className="btn-primary next-go no-underline">{label}</Link>
      ) : (
        <button type="button" className="btn-primary next-go" disabled={busy} onClick={onStart}>
          {busy ? 'Preparando…' : label}
        </button>
      )}
    </div>
  )
}

function TaskRow({ task, busy, onStart }: { task: Task; busy: boolean; onStart: () => void }) {
  const target = taskTarget(task)
  const Icon = TASK_ICON[task.kind]
  const body = (
    <>
      <span className="plan-row-icon" aria-hidden><Icon size={20} /></span>
      <span className="plan-row-text">
        <b>{task.title}</b>
        <span>{task.reason}</span>
        <TaskMeta task={task} />
      </span>
      <ChevronRight size={20} aria-hidden />
    </>
  )
  if (target.type === 'lesson') {
    return <Link to="/lesson/$subtopicId" params={{ subtopicId: target.subtopicId }} className="plan-row no-underline">{body}</Link>
  }
  if (target.type === 'link') return <Link to={target.to} className="plan-row no-underline">{body}</Link>
  return <button type="button" className="plan-row" disabled={busy} onClick={onStart}>{body}</button>
}
