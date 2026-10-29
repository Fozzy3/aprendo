import { SUBJECT_WEIGHTS, WEIGHT_TOTAL } from './globalScore'

/**
 * Career families and their typical admission weights (plans/meta-carrera.md).
 *
 * Colombian public universities admit by a per-program weighting of the five
 * areas, not by the global score: the same 300 is worth more to Derecho with a
 * strong Lectura than with a strong Matemáticas. These are *typical* profiles,
 * each taken from one real program of the UIS table (Acuerdo 222 de 2014,
 * "Criterios de admisión", 2022). Universities set and change their own: the UI
 * says "típico" and the global score stays the official one.
 */
type Weights = Record<string, number>

const weights = (ciencias: number, lectura: number, matematicas: number, sociales: number, ingles: number): Weights => ({
  ciencias_naturales: ciencias,
  lectura_critica: lectura,
  matematicas,
  sociales_ciudadanas: sociales,
  ingles,
})

export const CAREER_FAMILIES: { id: string; label: string; examples: string; weights: Weights | null; source: string }[] = [
  { id: 'salud', label: 'Salud', examples: 'Medicina, Enfermería, Fisioterapia, Nutrición', weights: weights(30, 25, 20, 15, 10), source: 'UIS · Medicina' },
  { id: 'ingenierias', label: 'Ingenierías y tecnología', examples: 'Civil, Sistemas, Industrial, Mecánica, Electrónica', weights: weights(30, 20, 30, 10, 10), source: 'UIS · Ingeniería Civil' },
  { id: 'ciencias_naturales', label: 'Ciencias naturales', examples: 'Biología, Química, Geología, Física', weights: weights(35, 20, 25, 10, 10), source: 'UIS · Biología' },
  { id: 'matematicas', label: 'Matemáticas y estadística', examples: 'Matemáticas, Estadística', weights: weights(10, 20, 50, 10, 10), source: 'UIS · Matemáticas' },
  { id: 'derecho', label: 'Derecho y ciencia política', examples: 'Derecho, Ciencia Política, Relaciones Internacionales', weights: weights(10, 40, 20, 20, 10), source: 'UIS · Derecho' },
  { id: 'sociales_humanas', label: 'Ciencias sociales y humanas', examples: 'Psicología, Trabajo Social, Historia, Comunicación', weights: weights(10, 35, 20, 25, 10), source: 'UIS · Historia y Archivística' },
  { id: 'economicas', label: 'Económicas y administrativas', examples: 'Economía, Administración, Contaduría', weights: weights(10, 25, 30, 25, 10), source: 'UIS · Economía' },
  { id: 'educacion', label: 'Educación (licenciaturas)', examples: 'Básica Primaria, Literatura, Música', weights: weights(22, 22, 22, 22, 12), source: 'UIS · Lic. Básica Primaria' },
  { id: 'idiomas', label: 'Idiomas', examples: 'Lenguas Extranjeras, Traducción', weights: weights(10, 25, 10, 20, 35), source: 'UIS · Lic. Lenguas Extranjeras' },
  // No program of the UIS table: the official global weights until a source exists.
  { id: 'artes', label: 'Artes y diseño', examples: 'Diseño, Artes Plásticas, Arquitectura', weights: null, source: 'Pesos oficiales del global' },
]

export function getCareerFamily(id: string | null | undefined) {
  return id == null ? null : CAREER_FAMILIES.find((family) => family.id === id) ?? null
}

/** The family's area weights out of 100, or null for an unknown id. */
export function careerWeights(id: string | null | undefined): Weights | null {
  const family = getCareerFamily(id)
  if (family == null) return null
  return family.weights
    ?? Object.fromEntries(Object.entries(SUBJECT_WEIGHTS).map(([subjectId, weight]) => [subjectId, (weight * 100) / WEIGHT_TOTAL]))
}

/** The 0-100 weighted score for the career; null without a career or with an area missing. */
export function careerScore(id: string | null | undefined, areas: { subjectId: string; score: number }[]): number | null {
  const familyWeights = careerWeights(id)
  if (familyWeights == null) return null
  let total = 0
  for (const [subjectId, weight] of Object.entries(familyWeights)) {
    const area = areas.find((entry) => entry.subjectId === subjectId)
    if (area == null) return null
    total += (weight * area.score) / 100
  }
  return Math.round(total)
}

// ── "Todavía no sé": a short RIASEC interest check (Holland), no AI ─────────
// Two activities per type, answered 0 (no me gusta), 1 (me da igual), 2 (me
// gusta). It orients, it does not diagnose: the screen says so and points to
// the school counsellor and the MEN's "Buscando carrera".
type RiasecType = 'R' | 'I' | 'A' | 'S' | 'E' | 'C'

export const INTEREST_ITEMS: { id: string; type: RiasecType; text: string }[] = [
  { id: 'r1', type: 'R', text: 'Armar o reparar aparatos' },
  { id: 'r2', type: 'R', text: 'Trabajar al aire libre con herramientas' },
  { id: 'i1', type: 'I', text: 'Entender por qué pasa un fenómeno' },
  { id: 'i2', type: 'I', text: 'Resolver acertijos de lógica' },
  { id: 'a1', type: 'A', text: 'Dibujar, diseñar o hacer música' },
  { id: 'a2', type: 'A', text: 'Escribir historias' },
  { id: 's1', type: 'S', text: 'Explicarle algo a un compañero' },
  { id: 's2', type: 'S', text: 'Ayudar a alguien con un problema' },
  { id: 'e1', type: 'E', text: 'Convencer a otros en un debate' },
  { id: 'e2', type: 'E', text: 'Organizar un negocio o un evento' },
  { id: 'c1', type: 'C', text: 'Llevar cuentas y registros en orden' },
  { id: 'c2', type: 'C', text: 'Organizar datos en tablas' },
]

const FAMILIES_BY_TYPE: Record<RiasecType, string[]> = {
  R: ['ingenierias', 'ciencias_naturales'],
  I: ['ciencias_naturales', 'matematicas', 'salud'],
  A: ['artes', 'idiomas', 'sociales_humanas'],
  S: ['educacion', 'salud', 'sociales_humanas'],
  E: ['derecho', 'economicas'],
  C: ['economicas', 'matematicas', 'ingenierias'],
}
const RIASEC_ORDER: RiasecType[] = ['R', 'I', 'A', 'S', 'E', 'C']

/** 2-3 families from the two strongest types; a family both suggest leads. Stable on ties. */
export function suggestFamilies(answers: Record<string, number>): string[] {
  const byType = new Map<RiasecType, number>(RIASEC_ORDER.map((type) => [type, 0]))
  for (const item of INTEREST_ITEMS) byType.set(item.type, byType.get(item.type)! + (answers[item.id] ?? 0))
  const topTypes = [...RIASEC_ORDER].sort((a, b) => byType.get(b)! - byType.get(a)!).slice(0, 2)
  const score = new Map<string, number>()
  for (const type of topTypes) {
    for (const familyId of FAMILIES_BY_TYPE[type]) score.set(familyId, (score.get(familyId) ?? 0) + byType.get(type)!)
  }
  const order = CAREER_FAMILIES.map((family) => family.id)
  return [...score.keys()]
    .sort((a, b) => score.get(b)! - score.get(a)! || order.indexOf(a) - order.indexOf(b))
    .slice(0, 3)
}
