/**
 * Where a question comes from, shown under it. ICFES items are credited with
 * their booklet (its terms ask for attribution); questions Aprendo wrote with
 * AI say so, because they have not been through an exam.
 */
export const AI_UPLOAD_SLUG = 'ai-generated'

export function questionSource(upload: { slug: string; fileName: string } | null) {
  if (upload?.slug === AI_UPLOAD_SLUG) {
    return { kind: 'aprendo' as const, label: 'Pregunta de práctica escrita por Aprendo con IA' }
  }
  const booklet = upload?.fileName.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim()
  return { kind: 'icfes' as const, label: booklet ? `ICFES · ${booklet}` : 'ICFES' }
}
