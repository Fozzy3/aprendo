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
