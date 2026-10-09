/**
 * What a session may disclose, and until when it accepts answers.
 *
 * Nivelación and simulacros produce every level and score Aprendo shows, so the
 * key must stay sealed until the sitting is over — Saber 11 gives no feedback
 * during the exam either. Pure on purpose: `sessions.ts` applies these rules,
 * the tests pin them.
 */
import { SESSION_KIND_CONFIG, type FeedbackMode, type SessionKind } from './sessionKinds'

/**
 * Answers and explanations are only disclosed once the session is complete. An
 * abandoned session stays sealed: the student never finished it.
 */
export function canRevealAnswers(session: { status: string }) {
  return session.status === 'completed'
}

/**
 * The question as the solve screen may see it. Beyond the key itself:
 * distractor rationales exist for every WRONG option, so the missing label is
 * the key; an answer-step error can quote the model's output; and the Elo
 * difficulty tells how others fared on the item.
 */
export function sealQuestion<T extends object>(question: T): T {
  return {
    ...question,
    answerCorrectOption: undefined,
    answerSolutionMarkdown: undefined,
    answerDistractorRationales: undefined,
    answerErrorMessage: undefined,
    difficultyRating: undefined,
    difficultyAttemptCount: undefined,
    difficultyUpdatedAt: undefined,
  }
}

/**
 * The attempt without its grade. Answers can be changed until the end, so a
 * visible `isCorrect` would let a student try options until one comes back true.
 */
export function sealAttempt<T extends object>(attempt: T): T {
  return { ...attempt, isCorrect: undefined }
}

/**
 * Whether a question of `session` may show its key. The bank is shared, so a
 * practice completed while a timed exam runs could otherwise hand over the key
 * of an item the student is still answering there. `liveExamQuestionIds` are
 * the questions of the student's live timed exams.
 */
export function canRevealQuestion(
  session: { status: string },
  questionId: string,
  liveExamQuestionIds: ReadonlySet<string>,
) {
  return canRevealAnswers(session) && !liveExamQuestionIds.has(questionId)
}

/**
 * Whether an open session keeps its questions sealed in every other session:
 * any kind that discloses nothing before the end (exams and the reto), timed or
 * not, until it is completed or its clock runs out. The bank is shared, so a
 * practice that grades one of them would hand over the key mid-sitting. The
 * tutor gate is narrower on purpose (`llmBudget.isLiveTimedExam`).
 */
export function sealsItsQuestions(
  session: { kind: SessionKind; status: string; expiresAt?: number },
  now: number,
) {
  return session.status === 'in_progress'
    && !SESSION_KIND_CONFIG[session.kind].allowsImmediateFeedback
    && !isPastDeadline(session, now)
}

/**
 * Whether another session may take this question while the student's timed
 * exam runs: not one the exam asks, nor one sharing its text — a group leaves
 * whole. Grading it elsewhere (a summary, "N correctas", the review queue)
 * would tell the key one option at a time.
 */
export function isOutsideLiveExam(
  question: { _id: string; groupId?: string },
  live: { questionIds: ReadonlySet<string>; groupIds: ReadonlySet<string> },
) {
  return !live.questionIds.has(question._id) && (question.groupId == null || !live.groupIds.has(question.groupId))
}

/**
 * Whether a session may be scored now. A practice opened before an exam began
 * can hold its items; scoring it grades them, so it waits for the exam to end.
 * `otherLiveExamQuestionIds` excludes the session's own questions.
 */
export function canSettleSession(questionIds: readonly string[], otherLiveExamQuestionIds: ReadonlySet<string>) {
  return !questionIds.some((questionId) => otherLiveExamQuestionIds.has(questionId))
}

/**
 * Whether a session discloses each answer as soon as the student checks it
 * ("Ver respuesta al responder"). The kind decides, not only the stored mode:
 * an exam or a reto never does, whatever a forged mode says.
 */
export function canCheckAnswers(session: { kind: SessionKind; feedbackMode?: FeedbackMode }) {
  return session.feedbackMode === 'inmediata' && SESSION_KIND_CONFIG[session.kind].allowsImmediateFeedback
}

/**
 * Whether one question of `session` may show its key: every question once the
 * session is completed (`canRevealQuestion`), or, while an immediate-feedback
 * practice is open, the questions already checked — their answer is locked, so
 * the key can no longer be traded for a changed answer. A live exam's items stay
 * sealed either way.
 */
export function canRevealSessionQuestion(
  session: { status: string; kind: SessionKind; feedbackMode?: FeedbackMode },
  attempt: { checkedAt?: number } | null | undefined,
  questionId: string,
  liveExamQuestionIds: ReadonlySet<string>,
) {
  if (canRevealQuestion(session, questionId, liveExamQuestionIds)) return true
  return canCheckAnswers(session)
    && attempt?.checkedAt != null
    && !liveExamQuestionIds.has(questionId)
}

/** Absorbs network latency and small clock skew between the device and the server. */
export const ANSWER_GRACE_MS = 60_000

/**
 * How late the time-out completion may arrive and still be scored. A phone that
 * loses signal as the clock ends queues it until it reconnects; a completion
 * hours later is a student who left, and scoring it would turn 2 answers out of
 * 15 into their placement. Answers are still cut at `ANSWER_GRACE_MS`.
 */
export const COMPLETION_GRACE_MS = 5 * 60_000

/** Whether a timed session's clock ran out (untimed sessions never do). */
export function isPastDeadline(
  session: { expiresAt?: number },
  now: number,
  graceMs = ANSWER_GRACE_MS,
) {
  return session.expiresAt != null && now > session.expiresAt + graceMs
}

/**
 * The attempts that may count outside their own session: those of completed
 * sessions. An open sitting's grades are sealed, so any count built from them —
 * the review queue, "N correctas", weekly accuracy — leaks them one changed
 * answer at a time. An abandoned session never finished: not evidence either.
 */
export function settledAttempts<A extends { sessionId: string }>(
  attempts: A[],
  sessions: { _id: string; status: string }[],
): A[] {
  const completedIds = new Set(sessions.filter(canRevealAnswers).map((session) => session._id))
  return attempts.filter((attempt) => completedIds.has(attempt.sessionId))
}
