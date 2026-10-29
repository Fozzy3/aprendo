import taxonomyContract from '../../../docs/taxonomy.v1.json'

/**
 * Shared taxonomy lookups for the backend. The taxonomy tree (subjects →
 * categories → subtopics) is traversed once here so callers don't each rebuild
 * their own maps — keeping "what is a valid subtopic and its parent subject" in
 * a single place.
 */
export interface SubtopicContext {
  subtopicId: string
  label: string
  subjectId: string
  subjectLabel: string
  categoryId: string
  categoryLabel: string
}

const subjectLabelById = new Map<string, string>()
const subtopicContextById = new Map<string, SubtopicContext>()
for (const subject of taxonomyContract.subjects) {
  subjectLabelById.set(subject.id, subject.label_es)
  for (const category of subject.categories) {
    for (const subtopic of category.subtopics) {
      subtopicContextById.set(subtopic.id, {
        subtopicId: subtopic.id,
        label: subtopic.label_es,
        subjectId: subject.id,
        subjectLabel: subject.label_es,
        categoryId: category.id,
        categoryLabel: category.label_es,
      })
    }
  }
}

export const SUBJECT_IDS = taxonomyContract.subjects.map((subject) => subject.id)

export function getSubtopicContext(subtopicId: string): SubtopicContext | undefined {
  return subtopicContextById.get(subtopicId)
}

export function getSubjectIdForSubtopic(subtopicId: string): string | undefined {
  return subtopicContextById.get(subtopicId)?.subjectId
}

export function getSubjectLabel(subjectId: string): string {
  return subjectLabelById.get(subjectId) ?? subjectId
}

export function getSubtopicLabel(subtopicId: string): string {
  return subtopicContextById.get(subtopicId)?.label ?? subtopicId
}

/**
 * The official ICFES competencias (afirmaciones in Lectura Crítica), in the
 * order the ICFES reports them. Questions carry one as the secondary dimension
 * `competencia_oficial`; schools read their results in these words (F35).
 */
const COMPETENCIA_ORDER: string[] = Object.values(taxonomyContract.secondary_dimensions.competencia_oficial.values).flat()

const COMPETENCIA_LABELS: Record<string, string> = {
  interpretacion_representacion: 'Interpretación y representación',
  formulacion_ejecucion: 'Formulación y ejecución',
  argumentacion: 'Argumentación',
  pensamiento_social: 'Pensamiento social',
  analisis_perspectivas: 'Interpretación y análisis de perspectivas',
  pensamiento_reflexivo_sistemico: 'Pensamiento reflexivo y sistémico',
  uso_comprensivo: 'Uso comprensivo del conocimiento científico',
  explicacion_fenomenos: 'Explicación de fenómenos',
  indagacion: 'Indagación',
  afirmacion_1_local: 'Identificar y entender contenidos locales',
  afirmacion_2_global: 'Comprender cómo se articulan las partes',
  afirmacion_3_critica: 'Reflexionar y evaluar',
  linguistica: 'Lingüística',
  pragmatica: 'Pragmática',
  sociolinguistica: 'Sociolingüística',
}

export function getCompetenciaLabel(competencia: string): string {
  return COMPETENCIA_LABELS[competencia] ?? competencia
}

/** The competencia a question is tagged with, when the enrichment found one. */
export function competenciaOf(question: { secondaryDimensions?: { dimension: string; value: string }[] }) {
  return question.secondaryDimensions?.find((item) => item.dimension === 'competencia_oficial')?.value ?? null
}

/** Answers per area and competencia, official order; untagged answers are left out. */
export function competencyBreakdown(answers: { subjectId: string; competencia: string | null; isCorrect: boolean }[]) {
  const rows = new Map<string, { subjectId: string; competencia: string; answered: number; correct: number }>()
  for (const answer of answers) {
    if (answer.competencia == null) continue
    const key = `${answer.subjectId}:${answer.competencia}`
    const row = rows.get(key) ?? { subjectId: answer.subjectId, competencia: answer.competencia, answered: 0, correct: 0 }
    row.answered += 1
    if (answer.isCorrect) row.correct += 1
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => COMPETENCIA_ORDER.indexOf(a.competencia) - COMPETENCIA_ORDER.indexOf(b.competencia))
}
