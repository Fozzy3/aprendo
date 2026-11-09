import { convexQuery, useConvexMutation } from '@convex-dev/react-query'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Shield } from 'lucide-react'
import type { CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KIND_CONFIG } from '@aprendo/convex/sessionKinds'
import type { StudyTaskAction } from '@aprendo/convex/studyPlan'
import { hoyPage } from '../lib/album-view.ts'
import { readConvexError } from '../lib/convex-error.ts'
import {
  activeSessionQuery,
  mySchoolsQuery,
  todayDashboardQuery,
} from '../lib/student-queries.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { taskSessionArgs } from '../lib/today-display.ts'
import { ActiveDuelBanner } from './ActiveDuelBanner.tsx'
import { PageLoader } from './FullScreenLoader.tsx'
import { FirstWeek } from './FirstWeek.tsx'
import { StickerAlbum } from './StickerAlbum.tsx'
import { TeacherAssignments } from './TeacherAssignments.tsx'

function days(count: number) {
  return `${count} ${count === 1 ? 'día' : 'días'}`
}

/**
 * Hoy: the page of the area the student is working on, the one sticker it asks
 * for, and one yellow button that goes and gets it. Everything else a student
 * might want lives one tab away (Aprende, Retos, Yo).
 */
export function TodayPage({ studentId }: { studentId: string }) {
  const navigate = useNavigate()
  const dashboard = useQuery({ ...todayDashboardQuery(studentId), enabled: true })
  const album = useQuery(convexQuery(api.today.getStickerAlbum, { studentId: studentId as never }))
  const active = useQuery({ ...activeSessionQuery(studentId), enabled: true })
  const schools = useQuery(mySchoolsQuery)

  const createSession = useConvexMutation(api.sessions.createSession)
  type Launch = Omit<Parameters<typeof createSession>[0], 'studentId'>
  const launch = useMutation({
    mutationFn: (args: Launch) => createSession({ studentId: studentId as never, ...args }),
    onSuccess: (sessionId) => navigate({ to: '/practice/$sessionId', params: { sessionId } }),
  })

  if (dashboard.isError || album.isError) {
    return (
      <div className="hoy-error" role="alert">
        <h1 className="page-title">No pudimos abrir tu álbum</h1>
        <p className="page-lede">{readConvexError(dashboard.error ?? album.error, 'Intenta recargar en un momento.')}</p>
        <Link to="/practice" className="btn-primary no-underline">Ir a Retos</Link>
      </div>
    )
  }

  if (dashboard.data == null || album.data == null) return <PageLoader message="Abriendo tu álbum…" />

  const { plan, streakDays, shields, xp, firstWeek } = dashboard.data
  const { subject, next } = hoyPage(album.data, plan.nextSubtopics)
  const { hero } = plan
  const openSession = active.data ?? null
  const isBusy = launch.isPending

  const heroArgs: Launch = next != null
    ? { kind: 'topic', subtopicId: next.subtopicId, questionLimit: hero.questionCount }
    : taskSessionArgs(hero.action as Extract<StudyTaskAction, { type: 'session' }>)
  const heroTitle = next != null ? `Te falta ${next.label}` : 'Practica hoy'
  const heroLine = `${next != null ? 'Consíguela · ' : ''}${hero.questionCount} preguntas · ${hero.minutes} min`

  return (
    <div className="hoy fade-in" style={{ '--field': getSubjectTheme(subject.subjectId).color } as CSSProperties}>
      <section className="hoy-field" aria-labelledby="hoy-area">
        <ActiveDuelBanner studentId={studentId} />
        <h1 id="hoy-area" className="hoy-area">{subject.label}</h1>
        <p className="hoy-count">
          {subject.earnedCount} de {subject.stickers.length} láminas
          {streakDays > 0 ? ` · racha de ${days(streakDays)}` : ''}
        </p>

        <StickerAlbum stickers={subject.stickers} nextId={next?.subtopicId ?? null} />

        <p className="hoy-stats">
          <span>{xp.today} XP hoy</span>
          <span>{xp.thisWeek} XP esta semana</span>
          {shields > 0 ? (
            <span className="hoy-shields" aria-label={`${shields} ${shields === 1 ? 'escudo' : 'escudos'} para tu racha`}>
              <Shield size={15} strokeWidth={2.4} aria-hidden /> {shields}
            </span>
          ) : null}
        </p>

        {openSession != null ? (
          <Link
            to="/practice/$sessionId"
            params={{ sessionId: openSession._id }}
            className="btn-primary hoy-go no-underline"
          >
            <span>Sigue donde ibas</span>
            <small>{SESSION_KIND_CONFIG[openSession.kind].labelEs} · {openSession.questionCount} preguntas</small>
          </Link>
        ) : hero.missionComplete ? (
          <div className="hoy-done">
            <p className="hoy-done-title">Misión cumplida</p>
            {next != null ? (
              <button type="button" className="hoy-more" disabled={isBusy} onClick={() => launch.mutate(heroArgs)}>
                {isBusy ? 'Preparando…' : `Sigue con ${next.label}`}
              </button>
            ) : null}
          </div>
        ) : (
          <button type="button" className="btn-primary hoy-go" disabled={isBusy} onClick={() => launch.mutate(heroArgs)}>
            <span>{isBusy ? 'Preparando…' : heroTitle}</span>
            <small>{heroLine}</small>
          </button>
        )}

        {launch.error != null ? (
          <p role="alert" className="hoy-launch-error">
            {readConvexError(launch.error, 'No se pudo empezar. Intenta de nuevo.')}
          </p>
        ) : null}
      </section>

      <aside className="hoy-side">
        <TeacherAssignments studentId={studentId} />
        {firstWeek.active ? <FirstWeek studentId={studentId} firstWeek={firstWeek} /> : null}
        {schools.data != null && schools.data.length === 0 ? (
          <Link to="/join" className="task no-underline">
            <span className="task-text">
              <b>Unirme a mi curso</b>
              <span>Con el código de tu profe</span>
            </span>
          </Link>
        ) : null}
      </aside>
    </div>
  )
}
