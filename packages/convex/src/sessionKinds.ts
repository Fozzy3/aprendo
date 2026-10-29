/**
 * Unified session-kind configuration.
 *
 * Aprendo has several student-facing question flows (diagnostic, recommended
 * practice, topic practice, simulated exam). They are fundamentally the same
 * thing — an ordered set of questions a student solves and then reviews with
 * the tutor — so they all run on the SAME machinery (one `sessions` table, one
 * `sessions.ts` backend module, one solve screen, one review screen).
 *
 * The only thing that differs per kind is configuration: how many questions,
 * how they are selected, whether there is a time limit, whether the tutor is
 * available while solving, and whether the kind can be launched from the hub.
 *
 * This module is the single source of truth for that configuration and is
 * imported by both the Convex backend (relative import) and the web app
 * (via the `@aprendo/convex/sessionKinds` package export). Keep it free of any
 * Convex or framework imports so it stays portable and pure.
 *
 * To tune a kind, edit its entry below — nothing else needs to change.
 */

export const SESSION_KINDS = [
  'diagnostic',
  'nivelacion',
  'recommended',
  'topic',
  'simulacro',
  'repaso',
  'personalizada',
  'reto',
] as const
export type SessionKind = (typeof SESSION_KINDS)[number]

/**
 * When a practice discloses its answers: question by question ("Ver respuesta
 * al responder") or once the session is completed. Exams are always `al_final`.
 */
export const FEEDBACK_MODES = ['inmediata', 'al_final'] as const
export type FeedbackMode = (typeof FEEDBACK_MODES)[number]

/** How the question set for a session is assembled. */
export type SelectionStrategy =
  /** Even spread across all subjects (diagnostic, simulacro). */
  | 'balanced_by_subject'
  /** Fixed ICFES Saber 11 simulated-exam distribution by subject/session. */
  | 'simulacro_by_session'
  /** Rule-based selection targeting the learner's weak areas. */
  | 'recommended'
  /** Concentrated in a single requested subject. */
  | 'topic'
  /** Previously-missed questions resurfaced for spaced review. */
  | 'review_mistakes'
  /** Student-built set: area, subtopics, difficulty, source, count (see `practiceBuilder.ts`). */
  | 'custom'
  /** Khan's Mastery Challenge: 3 practiced subtopics, 2 questions each (see `mastery.ts`). */
  | 'mastery_challenge'

/** Which question-bank eligibility tiers a kind may draw from. */
export type QuestionEligibilityPool = 'diagnostic' | 'practice_only'

export interface SessionKindConfig {
  kind: SessionKind
  /** Short Spanish label shown in the UI. */
  labelEs: string
  /** One-line Spanish description for hub cards / headers. */
  taglineEs: string
  strategy: SelectionStrategy
  /** Used by `balanced_by_subject`: questions drawn per subject. */
  questionsPerSubject?: number
  /** Used by `simulacro_by_session`: official question distribution. */
  simulacroSessions?: SimulacroSessionConfig[]
  /** Used by `recommended` / `topic`: total questions in the session. */
  totalQuestions?: number
  eligibilityPools: QuestionEligibilityPool[]
  /** Time limit in ms, or `null` for an untimed session. */
  timeLimitMs: number | null
  /** Whether the tutor can assist during solve mode (review always allows it). */
  tutorInSolve: boolean
  /** Whether a completed diagnostic is required before this kind can start. */
  requiresDiagnostic: boolean
  /** Whether students can launch this kind from the practice hub. */
  launchableFromHub: boolean
  /** Whether the kind needs a `subjectId` argument (topic practice). */
  requiresSubject: boolean
  /**
   * Whether the student may choose `feedbackMode: 'inmediata'`. Never for an
   * exam or the mastery challenge: those measure, so nothing is disclosed
   * before the end (see `sessionIntegrity.canCheckAnswers`).
   */
  allowsImmediateFeedback: boolean
  /**
   * What a session gets when the launcher does not choose. Practice teaches, so
   * it corrects each answer; exams and the reto measure, so they correct at the
   * end (plans/ruta-mejora-pedagogica.md, F31).
   */
  defaultFeedbackMode: FeedbackMode
}

export interface SubjectQuestionTarget {
  subjectId: string
  questionCount: number
}

export interface SimulacroSessionConfig {
  sessionNumber: 1 | 2
  labelEs: string
  subjectTargets: SubjectQuestionTarget[]
  timeLimitMs: number
}

const MINUTE_MS = 60_000

export const SESSION_KIND_CONFIG: Record<SessionKind, SessionKindConfig> = {
  diagnostic: {
    kind: 'diagnostic',
    labelEs: 'Diagnóstico inicial',
    taglineEs: 'Medimos tu punto de partida en las cinco áreas.',
    strategy: 'balanced_by_subject',
    questionsPerSubject: 4,
    eligibilityPools: ['diagnostic'],
    timeLimitMs: null,
    tutorInSolve: false,
    requiresDiagnostic: false,
    launchableFromHub: false,
    requiresSubject: false,
    allowsImmediateFeedback: false,
    defaultFeedbackMode: 'al_final',
  },
  nivelacion: {
    kind: 'nivelacion',
    labelEs: 'Nivelación',
    taglineEs: 'Descubre tu nivel ICFES en un área, una a la vez.',
    // Reuses the `topic` strategy: it already concentrates on one subject and
    // prefers questions the student has not seen.
    strategy: 'topic',
    totalQuestions: 15,
    // Only the highest-confidence questions: this measurement is what the
    // student's level and learning path are built on.
    eligibilityPools: ['diagnostic'],
    timeLimitMs: 30 * MINUTE_MS,
    tutorInSolve: false,
    // This IS the entry point — requiring a diagnostic would be circular.
    requiresDiagnostic: false,
    launchableFromHub: true,
    requiresSubject: true,
    allowsImmediateFeedback: false,
    defaultFeedbackMode: 'al_final',
  },
  recommended: {
    kind: 'recommended',
    labelEs: 'Práctica recomendada',
    taglineEs: 'Una sesión corta enfocada en tus áreas más débiles.',
    strategy: 'recommended',
    totalQuestions: 10,
    eligibilityPools: ['diagnostic', 'practice_only'],
    timeLimitMs: null,
    tutorInSolve: true,
    requiresDiagnostic: true,
    launchableFromHub: true,
    requiresSubject: false,
    allowsImmediateFeedback: true,
    defaultFeedbackMode: 'inmediata',
  },
  topic: {
    kind: 'topic',
    labelEs: 'Práctica por tema',
    taglineEs: 'Elige una asignatura y practica preguntas de ese tema.',
    strategy: 'topic',
    totalQuestions: 10,
    eligibilityPools: ['diagnostic', 'practice_only'],
    timeLimitMs: null,
    tutorInSolve: true,
    requiresDiagnostic: true,
    launchableFromHub: true,
    requiresSubject: true,
    allowsImmediateFeedback: true,
    defaultFeedbackMode: 'inmediata',
  },
  repaso: {
    kind: 'repaso',
    labelEs: 'Repaso espaciado',
    taglineEs: 'Los temas que tocan hoy vuelven con preguntas nuevas, espaciados en el tiempo.',
    strategy: 'review_mistakes',
    totalQuestions: 10,
    eligibilityPools: ['diagnostic', 'practice_only'],
    timeLimitMs: null,
    tutorInSolve: true,
    requiresDiagnostic: true,
    launchableFromHub: true,
    requiresSubject: false,
    allowsImmediateFeedback: true,
    defaultFeedbackMode: 'inmediata',
  },
  simulacro: {
    kind: 'simulacro',
    labelEs: 'Simulacro de examen',
    taglineEs: 'Practica como en el examen real: dos sesiones con distribución ICFES.',
    strategy: 'simulacro_by_session',
    simulacroSessions: [
      {
        sessionNumber: 1,
        labelEs: 'Sesión 1',
        subjectTargets: [
          { subjectId: 'lectura_critica', questionCount: 41 },
          { subjectId: 'matematicas', questionCount: 25 },
          { subjectId: 'ciencias_naturales', questionCount: 29 },
          { subjectId: 'sociales_ciudadanas', questionCount: 25 },
        ],
        timeLimitMs: 4 * 60 * MINUTE_MS + 30 * MINUTE_MS,
      },
      {
        sessionNumber: 2,
        labelEs: 'Sesión 2',
        subjectTargets: [
          { subjectId: 'matematicas', questionCount: 25 },
          { subjectId: 'ciencias_naturales', questionCount: 29 },
          { subjectId: 'sociales_ciudadanas', questionCount: 25 },
          { subjectId: 'ingles', questionCount: 55 },
        ],
        timeLimitMs: 4 * 60 * MINUTE_MS + 30 * MINUTE_MS,
      },
    ],
    eligibilityPools: ['diagnostic', 'practice_only'],
    timeLimitMs: null,
    tutorInSolve: false,
    requiresDiagnostic: true,
    launchableFromHub: true,
    requiresSubject: false,
    allowsImmediateFeedback: false,
    defaultFeedbackMode: 'al_final',
  },
  personalizada: {
    kind: 'personalizada',
    labelEs: 'Práctica a tu medida',
    taglineEs: 'Elige área, subtemas, dificultad y cuántas preguntas.',
    strategy: 'custom',
    // The count is the student's choice (5-30, `practiceBuilder.ts`); this is
    // only what the hub shows before they choose.
    totalQuestions: 10,
    eligibilityPools: ['diagnostic', 'practice_only'],
    // Untimed unless the student asks for the clock; then the official pace
    // per question (`pacing.officialMsPerQuestion`).
    timeLimitMs: null,
    tutorInSolve: false,
    requiresDiagnostic: true,
    // Needs the builder's filters, which the generic hub card cannot ask for.
    launchableFromHub: false,
    requiresSubject: false,
    allowsImmediateFeedback: true,
    defaultFeedbackMode: 'al_final',
  },
  reto: {
    kind: 'reto',
    labelEs: 'Reto de dominio',
    taglineEs: 'Seis preguntas de tres subtemas que ya practicaste: sube o baja tu nivel.',
    strategy: 'mastery_challenge',
    totalQuestions: 6,
    eligibilityPools: ['diagnostic', 'practice_only'],
    timeLimitMs: null,
    tutorInSolve: false,
    requiresDiagnostic: true,
    launchableFromHub: true,
    requiresSubject: false,
    allowsImmediateFeedback: false,
    defaultFeedbackMode: 'al_final',
  },
}

/** Questions per teacher assignment (F40): a topic practice, or the exit ticket. */
export const ASSIGNMENT_QUESTION_COUNT = { practica: 10, tiquete: 3 } as const

export function getSessionKindConfig(kind: SessionKind): SessionKindConfig {
  return SESSION_KIND_CONFIG[kind]
}

export function getConfiguredQuestionCount(config: SessionKindConfig): number {
  if (config.totalQuestions != null) return config.totalQuestions
  if (config.questionsPerSubject != null) return config.questionsPerSubject * 5
  if (config.simulacroSessions != null) {
    return config.simulacroSessions.reduce(
      (sum, session) =>
        sum + session.subjectTargets.reduce(
          (sessionSum, target) => sessionSum + target.questionCount,
          0,
        ),
      0,
    )
  }
  return 0
}

export function getSimulacroSessionQuestionCount(session: SimulacroSessionConfig): number {
  return session.subjectTargets.reduce((sum, target) => sum + target.questionCount, 0)
}

/**
 * Official pace of the exam, used to time a single-area simulacro.
 *
 * Both official sittings are 4h30 for their question count, which works out at
 * ~2.25 minutes per question; an area-only simulacro gets the same pace so it
 * feels like the real thing rather than an arbitrary clock.
 */
export const SIMULACRO_MS_PER_QUESTION = 135_000

/** The official total for one area across both sittings, plus its time limit. */
export function getSimulacroSubjectTarget(subjectId: string) {
  const target = getSimulacroSubjectTargets().find((item) => item.subjectId === subjectId)
  if (target == null) return null
  return {
    ...target,
    timeLimitMs: target.questionCount * SIMULACRO_MS_PER_QUESTION,
  }
}

export function getSimulacroSubjectTargets(config = SESSION_KIND_CONFIG.simulacro) {
  const totals = new Map<string, number>()
  for (const session of config.simulacroSessions ?? []) {
    for (const target of session.subjectTargets) {
      totals.set(target.subjectId, (totals.get(target.subjectId) ?? 0) + target.questionCount)
    }
  }
  return [...totals.entries()]
    .map(([subjectId, questionCount]) => ({ subjectId, questionCount }))
    .sort((a, b) => a.subjectId.localeCompare(b.subjectId))
}

/** Kinds the student can start from the practice hub, in display order. */
export const LAUNCHABLE_SESSION_KINDS: SessionKind[] = SESSION_KINDS.filter(
  (kind) => SESSION_KIND_CONFIG[kind].launchableFromHub,
)

/** Whether a value is a known session kind (handy for narrowing). */
export function isSessionKind(value: string): value is SessionKind {
  return (SESSION_KINDS as readonly string[]).includes(value)
}
