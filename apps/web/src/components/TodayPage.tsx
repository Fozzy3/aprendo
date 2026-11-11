import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpen, CalendarDays, Check, ChevronRight, Flame, Hourglass, Repeat, Shield, Target, Zap } from 'lucide-react'
import type { CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KIND_CONFIG } from '@aprendo/convex/sessionKinds'
import type { StudyTask, StudyTaskAction } from '@aprendo/convex/studyPlan'
import { readConvexError } from '../lib/convex-error.ts'
import {
  activeSessionQuery,
  mySchoolsQuery,
  pathSubjectsQuery,
  todayDashboardQuery,
} from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { areaRows, taskSessionArgs, taskTarget } from '../lib/today-display.ts'
import { ActiveDuelBanner } from './ActiveDuelBanner.tsx'
import { PageLoader } from './FullScreenLoader.tsx'
import { FirstWeek } from './FirstWeek.tsx'
import { TeacherAssignments } from './TeacherAssignments.tsx'

type Task = Pick<StudyTask, 'id' | 'kind' | 'title' | 'reason' | 'minutes' | 'action'>
type Launch = ReturnType<typeof taskSessionArgs>

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

  const { plan, streakDays, shields, xp, firstWeek, examPlan } = dashboard.data
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

  return (
    <div className="hoy fade-in">
      <header className="hoy-head">
        <h1 className="hoy-title">{firstName === '' ? 'Hoy' : `Hola, ${firstName}`}</h1>
        <ul className="hoy-status" aria-label="Tu semana">
          <li><Flame size={16} aria-hidden /> {streakDays > 0 ? `Racha de ${plural(streakDays, 'día', 'días')}` : 'Empieza tu racha hoy'}</li>
          <li><Zap size={16} aria-hidden /> {xp.today} XP hoy</li>
          {shields > 0 ? <li><Shield size={16} aria-hidden /> {plural(shields, 'escudo', 'escudos')}</li> : null}
          {plan.hero.missionComplete ? <li className="is-done"><Check size={16} aria-hidden /> Meta del día cumplida</li> : null}
          {daysToExam != null ? <li><CalendarDays size={16} aria-hidden /> {daysToExam === 0 ? 'El examen es hoy' : `Examen en ${plural(daysToExam, 'día', 'días')}`}</li> : null}
        </ul>
      </header>

      <div className="hoy-grid">
        <div className="hoy-main">
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
            ) : (
              <NextCard task={next} busy={launch.isPending} onStart={() => start(next)} />
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

          <TeacherAssignments studentId={studentId} />
        </div>

        <aside className="hoy-side">
          {firstWeek.active ? <FirstWeek studentId={studentId} firstWeek={firstWeek} /> : null}

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

/** The one big step: its title, why it, and the yellow button. */
function NextCard({ task, busy, onStart }: { task: Task; busy: boolean; onStart: () => void }) {
  const target = taskTarget(task)
  const label = GO_LABEL[target.type]
  return (
    <div className="next-card">
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
