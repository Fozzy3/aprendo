import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { usePaginatedQuery } from 'convex/react'
import { Flame, Target, TrendingUp, CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { api } from '@aprendo/convex/api'
import { SESSION_KINDS, type SessionKind } from '@aprendo/convex/sessionKinds'
import { activitySummaryQuery } from '../lib/student-queries.ts'
import { getKindIcon, getKindLabel } from '../lib/session-display.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'

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
    <div className="page-container py-8">
      <header className="fade-in mb-7">
        <p className="kicker">Tu historia</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Historial de estudio
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Cada día que estudiaste — y los que no.
        </p>
      </header>

      <section className="fade-in stagger-1 mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon={<Flame size={16} />}
          label="Racha actual"
          value={stats == null ? '—' : `${stats.currentStreakDays} d`}
          hint={stats == null ? undefined : `Tu mejor racha: ${stats.longestStreakDays} d`}
        />
        <StatTile
          icon={<CalendarDays size={16} />}
          label="Días activos"
          value={stats == null ? '—' : `${stats.activeDayCount}`}
        />
        <StatTile
          icon={<Target size={16} />}
          label="Preguntas"
          value={stats == null ? '—' : `${stats.totalAnswered}`}
          hint={stats == null ? undefined : `${stats.totalCorrect} correctas`}
        />
        <StatTile
          icon={<TrendingUp size={16} />}
          label="Precisión"
          value={stats?.accuracy == null ? '—' : `${Math.round(stats.accuracy * 100)}%`}
        />
      </section>

      <section className="fade-in stagger-2 card mb-7 p-5">
        <h2 className="mb-1 text-sm font-bold text-[var(--text-primary)]">
          Últimas {CALENDAR_WEEKS} semanas
        </h2>
        <p className="mb-4 text-xs text-[var(--text-tertiary)]">
          Cada cuadro es un día. Los vacíos son días sin estudiar.
        </p>
        {summary.data == null ? (
          <div className="h-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-inset)]" />
        ) : (
          <ActivityCalendar days={summary.data.days} />
        )}
      </section>

      <section className="fade-in stagger-3">
        <div className="hub-filters mb-4">
          <FilterChip
            label="Todas"
            isActive={kindFilter === 'all'}
            onSelect={() => setKindFilter('all')}
          />
          {SESSION_KINDS.map((kind) => (
            <FilterChip
              key={kind}
              label={getKindLabel(kind)}
              isActive={kindFilter === kind}
              onSelect={() => setKindFilter(kind)}
            />
          ))}
        </div>

        {history.status === 'LoadingFirstPage' ? (
          <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-inset)]" />
        ) : history.results.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              {kindFilter === 'all'
                ? 'Todavía no has completado ninguna sesión.'
                : 'No hay sesiones de este tipo todavía.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="flex list-none flex-col gap-2 p-0">
              {history.results.map((session) => (
                <li key={session._id}>
                  <HistoryRow session={session} />
                </li>
              ))}
            </ul>
            {history.status === 'CanLoadMore' && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => history.loadMore(PAGE_SIZE)}
                >
                  Ver más
                </button>
              </div>
            )}
            {history.status === 'LoadingMore' && (
              <p className="mt-4 text-center text-xs text-[var(--text-tertiary)]">Cargando…</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-1.5 text-[var(--text-tertiary)]">
        {icon}
        <span className="text-[0.68rem] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      {hint != null && <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{hint}</p>}
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
      <div className="flex gap-1">
        {weeks.map((week) => (
          <div key={week[0]?.dayNumber} className="flex flex-col gap-1">
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
      className="h-3 w-3 rounded-[4px]"
      style={{
        background:
          intensity === 0
            ? 'var(--bg-inset)'
            : `color-mix(in srgb, var(--brand) ${INTENSITY_ALPHA[intensity]}, var(--bg-inset))`,
        border: '1px solid var(--border)',
      }}
    />
  )
}

function FilterChip({
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
      className={`hub-filter ${isActive ? 'is-active' : ''}`}
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
  const Icon = getKindIcon(session.kind)
  const subject = session.subjectId == null ? null : getSubjectTheme(session.subjectId)
  const summary = session.summary
  const isCompleted = session.status === 'completed'

  const body = (
    <>
      <span
        className="history-row-icon"
        style={subject == null ? undefined : { color: subject.color }}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[var(--text-primary)]">
          {getKindLabel(session.kind)}
          {subject != null && (
            <span className="ml-1.5 font-medium text-[var(--text-secondary)]">
              · {subject.label}
            </span>
          )}
        </span>
        <span className="block text-xs text-[var(--text-tertiary)]">
          {formatDateTime(session.startedAt)}
          {isCompleted && summary != null && ` · ${formatDuration(summary.durationMs)}`}
        </span>
      </span>
      {isCompleted && summary != null ? (
        <span className="history-row-score">
          <span className="history-row-fraction">
            {summary.correctCount}
            <span className="history-row-of">/{summary.questionCount}</span>
          </span>
          <span className="history-row-badge" data-band={accuracyBand(summary.accuracy)}>
            {Math.round(summary.accuracy * 100)}%
          </span>
        </span>
      ) : (
        <span className="chip">Sin terminar</span>
      )}
    </>
  )

  // Only completed sessions have a review to open; an unfinished one links back
  // into solving it.
  return (
    <Link
      to={isCompleted ? '/practice/$sessionId/review' : '/practice/$sessionId'}
      params={{ sessionId: session._id }}
      className="history-row no-underline"
    >
      {body}
    </Link>
  )
}

function accuracyBand(accuracy: number): 'high' | 'mid' | 'low' {
  if (accuracy >= 0.7) return 'high'
  if (accuracy >= 0.4) return 'mid'
  return 'low'
}

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
