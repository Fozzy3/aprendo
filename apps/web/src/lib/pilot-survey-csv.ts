import {
  NOT_USED,
  NOT_USED_LABEL,
  PILOT_SURVEY_QUESTIONS,
  type SurveyAnswer,
  type SurveyQuestion,
} from '@aprendo/convex/pilotSurveyQuestions'

/** Quoted when it must be; a leading =, +, - or @ is kept as text so a spreadsheet never runs it. */
function cell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

function answerText(question: SurveyQuestion, value: SurveyAnswer | undefined) {
  if (value == null) return ''
  const label = (id: string) => question.options?.find((option) => option.id === id)?.label ?? id
  if (Array.isArray(value)) return value.map(label).join('; ')
  if (value === NOT_USED && question.kind === 'scale5_or_na') return NOT_USED_LABEL
  return question.options == null ? String(value) : label(String(value))
}

/**
 * The pilot survey as a spreadsheet: one row per response, one column per
 * question, options in words. The BOM lets Excel read the accents.
 */
export function pilotSurveyCsv(responses: { submittedAt: number; answers: Record<string, SurveyAnswer> }[]) {
  const header = ['Fecha', ...PILOT_SURVEY_QUESTIONS.map((question, index) => `${index + 1}. ${question.text}`)]
  const rows = responses.map((response) => [
    new Date(response.submittedAt).toISOString(),
    ...PILOT_SURVEY_QUESTIONS.map((question) => answerText(question, response.answers[question.id])),
  ])
  return `﻿${[header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}`
}
