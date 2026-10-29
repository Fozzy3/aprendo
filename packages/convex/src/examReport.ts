/**
 * What a finished nivelación or simulacro tells the student.
 *
 * Builders only: `sessions.ts` reads the rows, these turn them into the result
 * screens. Every number comes from the formulas the rest of the app already
 * uses (area score from `levels.ts`, sitting scores from `simulacroForm.ts`, the
 * 0-500 estimate from `globalScore.ts`), so a report never disagrees with
 * Progreso about the same sitting. Callers pass only completed sessions: these
 * functions see correctness and must never run on an open one.
 */
import { summarizeConfidence, type ConfidenceLevel } from './confidence'
import { REQUIRED_SUBJECT_IDS, estimateGlobalScore } from './globalScore'
import { MIN_ATTEMPTS_FOR_LEVEL, estimatedScoreFromAccuracy, getLevelForScore } from './levels'
import { averagePace, slowestQuestions } from './pacing'
import { getSimulacroSubjectTargets } from './sessionKinds'
import { scoreSimulacroSubjects } from './simulacroForm'
import { competencyBreakdown } from './taxonomy'

/** One served question of a completed session, as the reports need it. */
export type ReportItem = {
  sessionId: string
  sessionQuestionId: string
  position: number
  subjectId: string
  subtopicId: string | null
  /** The official ICFES competencia, when the question is tagged with one (F35). */
  competencia?: string | null
  /** Null when left blank — scored as wrong, like ICFES scores it. */
  isCorrect: boolean | null
  confidence?: ConfidenceLevel
  flagged: boolean
  timeMs: number | null
  officialMs: number
}

type SubjectScore = {
  subjectId: string
  correctCount: number
  answeredCount: number
  questionCount: number
}

/** Correct over served per subtopic, weakest first; at equal accuracy, more misses first. */
export function subtopicBreakdown(items: ReportItem[]) {
  const bySubtopic = new Map<string, { subtopicId: string; correctCount: number; questionCount: number }>()
  for (const item of items) {
    if (item.subtopicId == null) continue
    const entry = bySubtopic.get(item.subtopicId) ?? { subtopicId: item.subtopicId, correctCount: 0, questionCount: 0 }
    entry.questionCount += 1
    if (item.isCorrect === true) entry.correctCount += 1
    bySubtopic.set(item.subtopicId, entry)
  }
  const misses = (entry: { correctCount: number; questionCount: number }) =>
    entry.questionCount - entry.correctCount
  return [...bySubtopic.values()].sort(
    (a, b) =>
      a.correctCount / a.questionCount - b.correctCount / b.questionCount
      || misses(b) - misses(a)
      || a.subtopicId.localeCompare(b.subtopicId),
  )
}

/**
 * Whether this session is the student's first completed placement — the one
 * that unlocked the app. A legacy diagnostic counts as a placement too, like
 * the gate in `sessions.hasCompletedPlacement`.
 */
export function isFirstPlacement(
  sessions: { _id: string; kind: string; status: string; startedAt: number; completedAt?: number }[],
  sessionId: string,
): boolean {
  const first = sessions
    .filter((session) =>
      session.status === 'completed' && (session.kind === 'nivelacion' || session.kind === 'diagnostic'))
    .sort((a, b) => (a.completedAt ?? a.startedAt) - (b.completedAt ?? b.startedAt))[0]
  return first?._id === sessionId
}

/**
 * The level reveal after a nivelación: the area score as Progreso records the
 * placement, its ICFES level with the official descriptor and the next level's
 * ("para subir a Nivel N+1…"), and the two subtopics that cost the most.
 */
export function buildNivelacionResult(args: {
  subjectId: string
  summary: { accuracy: number; answeredCount: number }
  items: ReportItem[]
  isFirstPlacement: boolean
}) {
  const score = estimatedScoreFromAccuracy(args.summary.accuracy)
  return {
    subjectId: args.subjectId,
    score,
    /** `band` and `nextBand` carry `labelEs` and `descriptorEs`; null for an unknown area. */
    level: getLevelForScore(args.subjectId, score),
    weakestSubtopics: subtopicBreakdown(args.items)
      .filter((entry) => entry.correctCount < entry.questionCount)
      .slice(0, 2),
    /** Below the evidence floor the level is provisional ("sin nivel aún" in Progreso). */
    hasEnoughEvidence: args.summary.answeredCount >= MIN_ATTEMPTS_FOR_LEVEL,
    isFirstPlacement: args.isFirstPlacement,
  }
}

type SimulacroSitting = {
  _id: string
  kind: string
  status: string
  startedAt: number
  completedAt?: number
  subjectId?: string
  simulacroSessionNumber?: number
}

/**
 * The completed sittings that make up the exam `target` belongs to, the
 * sitting numbers still missing, and the completed sittings of the previous
 * comparable exam.
 *
 * Sittings are not linked in the data, so an exam is a Sesión 1 plus the
 * Sesión 2 sittings started after it and before the next Sesión 1 — the same
 * pairing `selectSimulacroForm` uses to keep Sesión 2 from repeating Sesión 1.
 * A per-area simulacro is an exam of its own, compared with the previous one of
 * the same area.
 */
export function resolveSimulacroExam<S extends SimulacroSitting>(
  sessions: S[],
  target: S,
): { sittings: S[]; missingSessionNumbers: number[]; previous: S[] } {
  const byStart = sessions
    .filter((session) => session.kind === 'simulacro')
    .sort((a, b) => a.startedAt - b.startedAt)
  const isCompleted = (session: S) => session.status === 'completed'

  if (target.subjectId != null) {
    const previous = byStart
      .filter((session) =>
        session.subjectId === target.subjectId && isCompleted(session) && session.startedAt < target.startedAt)
      .at(-1)
    return { sittings: [target], missingSessionNumbers: [], previous: previous == null ? [] : [previous] }
  }

  // A full sitting stored without a number is Sesión 1, as every simulacro read treats it.
  const sittingNumber = (session: S) => session.simulacroSessionNumber ?? 1
  const exams: S[][] = []
  for (const session of byStart.filter((candidate) => candidate.subjectId == null)) {
    const current = exams.at(-1)
    const first = current?.[0]
    if (sittingNumber(session) === 2 && current != null && first != null && sittingNumber(first) === 1) {
      current.push(session)
    } else {
      exams.push([session])
    }
  }
  const examIndex = exams.findIndex((exam) => exam.some((session) => session._id === target._id))
  // The latest completed sitting of each number; the target stands for its own.
  const completedSittings = (exam: S[]) =>
    [1, 2]
      .map((number) =>
        sittingNumber(target) === number && exam.includes(target)
          ? target
          : exam.filter((session) => sittingNumber(session) === number && isCompleted(session)).at(-1))
      .filter((session): session is S => session != null)

  const sittings = completedSittings(exams[examIndex] ?? [target])
  const previous = exams
    .slice(0, Math.max(0, examIndex))
    .map(completedSittings)
    .filter((exam) => exam.length > 0)
    .at(-1) ?? []
  return {
    sittings,
    missingSessionNumbers: [1, 2].filter(
      (number) => !sittings.some((session) => sittingNumber(session) === number),
    ),
    previous,
  }
}

/** Area scores of a set of sittings, only for the areas they actually served. */
function scoreSittings(sittings: SubjectScore[][]) {
  const served = new Set(sittings.flat().map((score) => score.subjectId))
  return scoreSimulacroSubjects(
    getSimulacroSubjectTargets().filter((target) => served.has(target.subjectId)),
    sittings,
  )
}

/** The 0-500 estimate, with all served items as its evidence (a blank is a graded miss). */
function globalFor(scores: ReturnType<typeof scoreSittings>) {
  return estimateGlobalScore(
    scores.map((score) => ({
      subjectId: score.subjectId,
      score: score.score,
      attemptCount: score.questionCount,
    })),
  )
}

/**
 * The post-simulacro report: per area the score, ICFES level, correct over
 * served, pace against the official clock, subtopics weakest first, flagged
 * misses, confidence calibration and the change since the previous comparable
 * simulacro; overall the 0-500 estimate with its band once every area was
 * served, or what is still missing.
 *
 * `sittings` and `previousSittings` are the `summary.subjectScores` of each
 * completed sitting; `items` are every served question of `sittings`.
 */
export function buildSimulacroReport(args: {
  sittings: SubjectScore[][]
  previousSittings: SubjectScore[][] | null
  items: ReportItem[]
  missingSessionNumbers: number[]
}) {
  const scores = scoreSittings(args.sittings)
  const previousScores = args.previousSittings == null ? [] : scoreSittings(args.previousSittings)
  const previousBySubject = new Map(previousScores.map((score) => [score.subjectId, score.score]))

  const areas = scores.map((score) => {
    const items = args.items.filter((item) => item.subjectId === score.subjectId)
    const flagged = items.filter((item) => item.flagged)
    const previous = previousBySubject.get(score.subjectId)
    return {
      ...score,
      level: getLevelForScore(score.subjectId, score.score),
      pace: averagePace(items),
      subtopics: subtopicBreakdown(items),
      competencias: competencyBreakdown(
        items.map((item) => ({ subjectId: item.subjectId, competencia: item.competencia ?? null, isCorrect: item.isCorrect === true })),
      ),
      flaggedCount: flagged.length,
      flaggedWrongCount: flagged.filter((item) => item.isCorrect !== true).length,
      confidence: summarizeConfidence(items),
      deltaVsPrevious: previous == null ? null : score.score - previous,
    }
  })

  const global = globalFor(scores)
  const previousGlobal = args.previousSittings == null ? null : globalFor(previousScores)
  const served = new Set(scores.map((score) => score.subjectId))
  return {
    areas,
    global,
    globalDeltaVsPrevious:
      global == null || previousGlobal == null ? null : global.score - previousGlobal.score,
    missingSessionNumbers: args.missingSessionNumbers,
    missingSubjectIds: REQUIRED_SUBJECT_IDS.filter((subjectId) => !served.has(subjectId)),
    slowestQuestions: slowestQuestions(args.items, 5),
  }
}
