import { convexQuery } from '@convex-dev/react-query'
import { api } from '@aprendo/convex/api'
import type { SessionKind } from '@aprendo/convex/sessionKinds'

function hasValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function studentQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.students.getStudent, 'skip')
  }

  return convexQuery(api.students.getStudent, {
    studentId: studentId as never,
  })
}

export function studentAppStateQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.students.getStudentAppState, 'skip')
  }

  return convexQuery(api.students.getStudentAppState, {
    studentId: studentId as never,
  })
}

/** Full session detail (questions + attempts) for any session kind. */
export function sessionQuery(sessionId: string | null | undefined) {
  if (!hasValue(sessionId)) {
    return convexQuery(api.sessions.getSession, 'skip')
  }

  return convexQuery(api.sessions.getSession, {
    sessionId: sessionId as never,
  })
}

export function activeSessionQuery(
  studentId: string | null | undefined,
  kind?: SessionKind,
) {
  if (!hasValue(studentId)) {
    return convexQuery(api.sessions.getActiveSession, 'skip')
  }

  return convexQuery(api.sessions.getActiveSession, {
    studentId: studentId as never,
    ...(kind != null ? { kind } : {}),
  })
}

export function sessionHistoryQuery(
  studentId: string | null | undefined,
  options?: { kind?: SessionKind; limit?: number },
) {
  if (!hasValue(studentId)) {
    return convexQuery(api.sessions.listSessions, 'skip')
  }

  return convexQuery(api.sessions.listSessions, {
    studentId: studentId as never,
    ...(options?.kind != null ? { kind: options.kind } : {}),
    ...(options?.limit != null ? { limit: options.limit } : {}),
  })
}

export function latestDiagnosticQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.sessions.getLatestDiagnostic, 'skip')
  }

  return convexQuery(api.sessions.getLatestDiagnostic, {
    studentId: studentId as never,
  })
}

export function practiceTutorThreadQuery(
  practiceSessionId: string | null | undefined,
  studentId: string | null | undefined,
) {
  if (!hasValue(practiceSessionId) || !hasValue(studentId)) {
    return convexQuery(api.tutor.getPracticeTutorThread, 'skip')
  }

  return convexQuery(api.tutor.getPracticeTutorThread, {
    practiceSessionId: practiceSessionId as never,
    studentId: studentId as never,
  })
}

export function studentProgressQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.progress.getStudentProgress, 'skip')
  }

  return convexQuery(api.progress.getStudentProgress, {
    studentId: studentId as never,
  })
}

/** Improvement-over-time signals: weekly accuracy trend + activity totals. */
export function progressTrendsQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.progress.getProgressTrends, 'skip')
  }

  return convexQuery(api.progress.getProgressTrends, {
    studentId: studentId as never,
  })
}

/** This week's AI coach summary (null until requested/generated). */
export function coachSummaryQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.coach.getWeeklyCoachSummary, 'skip')
  }

  return convexQuery(api.coach.getWeeklyCoachSummary, {
    studentId: studentId as never,
  })
}

/** Count of previously-missed questions due for spaced review (repaso). */
export function reviewQueueQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.sessions.getReviewQueue, 'skip')
  }

  return convexQuery(api.sessions.getReviewQueue, {
    studentId: studentId as never,
  })
}

/** "Hoy" dashboard signals (streak + weekly activity) derived from attempts. */
export function todayDashboardQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.today.getTodayDashboard, 'skip')
  }

  return convexQuery(api.today.getTodayDashboard, {
    studentId: studentId as never,
  })
}

/** Navigable ICFES syllabus: taxonomy + question counts + per-node mastery. */
export function syllabusQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.syllabus.getSyllabus, 'skip')
  }

  return convexQuery(api.syllabus.getSyllabus, {
    studentId: studentId as never,
  })
}

/**
 * Study calendar + lifetime totals for the history page.
 *
 * The paginated session list is not here: it uses `usePaginatedQuery` against
 * `api.history.listHistory` directly, because Convex pagination has its own hook.
 */
export function activitySummaryQuery(
  studentId: string | null | undefined,
  weeks?: number,
) {
  if (!hasValue(studentId)) {
    return convexQuery(api.history.getActivitySummary, 'skip')
  }

  return convexQuery(api.history.getActivitySummary, {
    studentId: studentId as never,
    ...(weeks == null ? {} : { weeks }),
  })
}

/** Ordered learning path for one area: subtopic nodes + the area's ICFES level. */
export function learningPathQuery(
  studentId: string | null | undefined,
  subjectId: string | null | undefined,
) {
  if (!hasValue(studentId) || !hasValue(subjectId)) {
    return convexQuery(api.path.getLearningPath, 'skip')
  }

  return convexQuery(api.path.getLearningPath, {
    studentId: studentId as never,
    subjectId,
  })
}

/** The five ICFES areas with the student's current level, for the path picker. */
export function pathSubjectsQuery(studentId: string | null | undefined) {
  if (!hasValue(studentId)) {
    return convexQuery(api.path.listPathSubjects, 'skip')
  }

  return convexQuery(api.path.listPathSubjects, {
    studentId: studentId as never,
  })
}

/** Cached AI concept lesson for a subtopic (null until requested/generated). */
export function conceptLessonQuery(subtopicId: string | null | undefined) {
  if (!hasValue(subtopicId)) {
    return convexQuery(api.lessons.getConceptLesson, 'skip')
  }

  return convexQuery(api.lessons.getConceptLesson, { subtopicId })
}
