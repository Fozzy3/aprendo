import taxonomyContract from '../../../../docs/taxonomy.v1.json'

const subjectLabelById = new Map(
  taxonomyContract.subjects.map((subject) => [subject.id, subject.label_es]),
)

const subtopicLabelById = new Map(
  taxonomyContract.subjects.flatMap((subject) =>
    subject.categories.flatMap((category) =>
      category.subtopics.map((subtopic) => [subtopic.id, subtopic.label_es] as const),
    ),
  ),
)

const subjectIdBySubtopicId = new Map(
  taxonomyContract.subjects.flatMap((subject) =>
    subject.categories.flatMap((category) =>
      category.subtopics.map((subtopic) => [subtopic.id, subject.id] as const),
    ),
  ),
)

export const subjectIds = taxonomyContract.subjects.map((subject) => subject.id)

/** The parent subject id for a subtopic, or null if the subtopic is unknown. */
export function getSubjectIdForSubtopic(subtopicId: string): string | null {
  return subjectIdBySubtopicId.get(subtopicId) ?? null
}

export function getSubjectLabel(subjectId: string) {
  return subjectLabelById.get(subjectId) ?? subjectId
}

export function getSubtopicLabel(subtopicId: string) {
  return subtopicLabelById.get(subtopicId) ?? subtopicId
}
