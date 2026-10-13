import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { usePaginatedQuery } from 'convex/react'
import { useState, type CSSProperties } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KINDS, type SessionKind } from '@aprendo/convex/sessionKinds'
import { activitySummaryQuery } from '../lib/student-queries.ts'
import { getKindLabel } from '../lib/session-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { EmptyState } from './EmptyState.tsx'

const CALENDAR_WEEKS = 16
const PAGE_SIZE = 20

type KindFilter = SessionKind | 'all'

export function HistoryPage({ studentId }: { studentId: string }) {
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')

  const summary = useQuery(activitySummaryQuery(studentId, CALENDAR_WEEKS))
  const history = usePaginatedQuery(
    api.history.listHistory,
    {
      studentId: studentId as never,
      ...(kindFilter === 'all' ? {} : { kind: kindFilter }),
    },
    { initialNumItems: PAGE_SIZE },
  )

  const stats = summary.data?.stats

  return (
    <div className="ruled-page fade-in">
      <aside className="ruled-page-margin" aria-label={`Últimas ${CALENDAR_WEEKS} semanas`}>
        <p className="ruled-page-date">Últimas {CALENDAR_WEEKS} semanas</p>
        <dl className="margin-facts">
          <div>
            <dt>Días seguidos</dt>
            <dd>{stats == null ? '—' : stats.currentStreakDays}</dd>
          </div>
          <div>
            <dt>Racha más larga</dt>
            <dd>{stats == null ? '—' : `${stats.longestStreakDays} días`}</dd>
          </div>
          <div>
            <dt>Días de estudio</dt>
            <dd>{stats == null ? '—' : stats.activeDayCount}</dd>
          </div>
          <div>
            <dt>Preguntas</dt>
            <dd>
              {stats == null ? '—' : stats.totalAnswered}
              {stats != null ? (
                <span className="block text-xs font-normal text-[var(--text-tertiary)]">
                  {stats.totalCorrect} correctas
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Aciertos</dt>
            <dd>{stats?.accuracy == null ? '—' : `${Math.round(stats.accuracy * 100)}%`}</dd>
          </div>
        </dl>
      </aside>

      <div className="ruled-page-body">
        <header className="ruled-page-head">
          <h1 className="page-title">Historial de estudio</h1>
          <p className="page-lede">Cada día que estudiaste, y los que no.</p>
        </header>

        <section className="ruled-section" aria-labelledby="history-days-title">
          <div className="section-head">
            <h2 id="history-days-title" className="section-title">Días de estudio</h2>
            <span className="section-meta">Cada cuadro es un día</span>
          </div>
          {summary.data == null ? (
            <div className="h-24 bg-[var(--bg-inset)]" aria-hidden />
          ) : (
            <ActivityCalendar days={summary.data.days} />
          )}
        </section>

        <section className="ruled-section" aria-labelledby="history-sessions-title">
          <h2 id="history-sessions-title" className="section-title">Sesiones</h2>
          <nav className="tab-nav mb-4 flex-wrap" aria-label="Tipo de sesión">
            <FilterTab label="Todas" isActive={kindFilter === 'all'} onSelect={() => setKindFilter('all')} />
            {SESSION_KINDS.map((kind) => (
              <FilterTab
                key={kind}
                label={getKindLabel(kind)}
                isActive={kindFilter === kind}
                onSelect={() => setKindFilter(kind)}
              />
            ))}
          </nav>

          {history.status === 'LoadingFirstPage' ? (
            <p className="text-sm text-[var(--text-tertiary)]">Cargando…</p>
          ) : history.results.length === 0 ? (
            <EmptyState
              title={kindFilter === 'all' ? 'Tu historial está vacío' : 'Nada de este tipo todavía'}
            >
              {kindFilter === 'all'
                ? 'Cuando termines tu primera sesión, va a aparecer acá con lo que respondiste.'
                : 'Prueba con otro filtro, o haz una sesión de este tipo.'}
            </EmptyState>
          ) : (
            <>
              <ul className="ruled-list">
                {history.results.map((session) => (
                  <li key={session._id}>
                    <HistoryRow session={session} />
                  </li>
                ))}
              </ul>
              {history.status === 'CanLoadMore' && (
                <button
                  type="button"
                  className="btn-secondary mt-4"
                  onClick={() => history.loadMore(PAGE_SIZE)}
                >
                  Ver más
                </button>
              )}
              {history.status === 'LoadingMore' && (
                <p className="mt-4 text-xs text-[var(--text-tertiary)]">Cargando…</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

type ActivityDay = {
  dayNumber: number
  startMs: number
  attemptCount: number
  correctCount: number
}

/**
 * Week-per-column heatmap, hand-rolled: the repo has no chart library and this
 * is a CSS grid, not a chart.
 */
function ActivityCalendar({ days }: { days: ActivityDay[] }) {
  const weeks: ActivityDay[][] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5">
        {weeks.map((week) => (
          <div key={week[0]?.dayNumber} className="flex flex-col gap-0.5">
            {week.map((day) => (
              <CalendarCell key={day.dayNumber} day={day} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Four buckets is enough to read intensity; more shades just add noise. */
function intensityOf(attemptCount: number): number {
  if (attemptCount === 0) return 0
  if (attemptCount < 5) return 1
  if (attemptCount < 15) return 2
  return 3
}

const INTENSITY_ALPHA = ['0%', '30%', '60%', '100%']

function CalendarCell({ day }: { day: ActivityDay }) {
  const intensity = intensityOf(day.attemptCount)
  const label = new Date(day.startMs).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
  })

  return (
    <div
      title={
        day.attemptCount === 0
          ? `${label}: sin estudiar`
          : `${label}: ${day.attemptCount} preguntas, ${day.correctCount} correctas`
      }
      className="h-3 w-3"
      style={{
        background:
          intensity === 0
            ? 'var(--bg-inset)'
            : `color-mix(in srgb, var(--ink) ${INTENSITY_ALPHA[intensity]}, var(--bg-inset))`,
      }}
    />
  )
}

function FilterTab({
  label,
  isActive,
  onSelect,
}: {
  label: string
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={`tab-item${isActive ? ' is-active' : ''}`}
    >
      {label}
    </button>
  )
}

type HistorySession = {
  _id: string
  kind: SessionKind
  status: string
  startedAt: number
  completedAt?: number
  subjectId?: string
  questionCount: number
  summary?: {
    correctCount: number
    questionCount: number
    accuracy: number
    durationMs: number
  }
}

function HistoryRow({ session }: { session: HistorySession }) {
  const subject = session.subjectId == null ? null : getSubjectTheme(session.subjectId)
  const summary = session.summary
  const isCompleted = session.status === 'completed'

  // Only completed sessions have a review to open; an unfinished one links back
  // into solving it.
  return (
    <Link
      to={isCompleted ? '/practice/$sessionId/review' : '/practice/$sessionId'}
      params={{ sessionId: session._id }}
      className="ruled-row no-underline"
    >
      <span className="ruled-row-main">
        <span className="flex items-center gap-2 font-semibold">
          {subject != null ? (
            <span
              aria-hidden
              className="subject-dot"
              style={{ '--subject-color': subject.color } as CSSProperties}
            />
          ) : null}
          {getKindLabel(session.kind)}
          {subject != null && <span className="font-normal text-[var(--text-secondary)]">· {subject.label}</span>}
        </span>
        <span className="ruled-row-note">
          {formatDateTime(session.startedAt)}
          {isCompleted && summary != null && ` · ${formatDuration(summary.durationMs)}`}
        </span>
      </span>
      {isCompleted && summary != null ? (
        <span
          className={`shrink-0 text-right text-sm tabular-nums ${summary.accuracy < LOW_ACCURACY ? 'text-[var(--danger-text)]' : 'text-[var(--text-primary)]'}`}
        >
          <span className="font-semibold">
            {summary.correctCount} de {summary.questionCount}
          </span>
          <span className="block text-xs text-[var(--text-tertiary)]">{Math.round(summary.accuracy * 100)}%</span>
        </span>
      ) : (
        <span className="chip">Sin terminar</span>
      )}
    </Link>
  )
}

/** Below this a result is written in red ink, as a teacher would mark it. */
const LOW_ACCURACY = 0.4

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(durationMs: number): string {
  const minutes = Math.round(durationMs / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}
