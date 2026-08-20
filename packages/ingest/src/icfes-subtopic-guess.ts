/**
 * Subtopic tagging without a model.
 *
 * The booklets print the subject and the answer but never the subtopic, and a
 * question needs one to be selectable at all (`hasUsableMetadata`). This scores
 * the wording against a keyword table per subtopic — crude next to the model
 * tagger, and honest about it: anything below the confidence bar is marked
 * `practice_only` so a shaky tag can never move a student's placement.
 *
 * The failure mode this avoids is worse than a missing tag: force every
 * question into the subject's first subtopic and the mastery numbers, the
 * recommendation engine and the learning path all quietly describe a student
 * who does not exist.
 */

export interface SubtopicGuess {
  categoryId: string
  subtopicId: string
  /** 0-1. Below `CONFIDENT_AT` the caller should keep the question out of placement. */
  confidence: number
}

/** Tags at or above this are trusted enough to measure a student with. */
export const CONFIDENT_AT = 0.45

interface Rule {
  categoryId: string
  subtopicId: string
  /** Terms that suggest this subtopic. Matched case- and accent-insensitively. */
  terms: string[]
}

const RULES: Record<string, Rule[]> = {
  lectura_critica: [
    { categoryId: 'lectura_critica.literal_comprehension', subtopicId: 'lectura_critica.literal_comprehension.word_phrase_meaning',
      terms: ['significa', 'significado', 'expresion', 'palabra', 'termino', 'sinonimo', 'sentido de la frase'] },
    { categoryId: 'lectura_critica.literal_comprehension', subtopicId: 'lectura_critica.literal_comprehension.explicit_details',
      terms: ['segun el texto', 'de acuerdo con el texto', 'el texto afirma', 'el texto menciona', 'que dice el texto'] },
    { categoryId: 'lectura_critica.structure_cohesion_multimodal', subtopicId: 'lectura_critica.structure_cohesion_multimodal.text_structure_parts',
      terms: ['estructura', 'parrafo', 'titulo', 'funcion de', 'organiza', 'seccion'] },
    { categoryId: 'lectura_critica.structure_cohesion_multimodal', subtopicId: 'lectura_critica.structure_cohesion_multimodal.logical_links_connectors',
      terms: ['conector', 'sin embargo', 'por lo tanto', 'relacion logica', 'contraste', 'causa'] },
    { categoryId: 'lectura_critica.voices_perspective', subtopicId: 'lectura_critica.voices_perspective.voices_speakers',
      terms: ['el autor', 'narrador', 'quien habla', 'enunciador', 'voz', 'cita'] },
    { categoryId: 'lectura_critica.critical_evaluation', subtopicId: 'lectura_critica.critical_evaluation.validity_implications',
      terms: ['se puede inferir', 'implica', 'valido', 'argumento', 'premisa', 'conclusion', 'debilita', 'refuta'] },
    { categoryId: 'lectura_critica.critical_evaluation', subtopicId: 'lectura_critica.critical_evaluation.evaluative_content_bias',
      terms: ['opinion', 'valoracion', 'sesgo', 'ironia', 'intencion', 'punto de vista', 'critica'] },
    { categoryId: 'lectura_critica.context_intertextuality', subtopicId: 'lectura_critica.context_intertextuality.contextualization',
      terms: ['contexto', 'epoca', 'historico', 'cultural', 'publicado', 'destinatario', 'contextos'] },
  ],
  matematicas: [
    { categoryId: 'matematicas.number_proportionality', subtopicId: 'matematicas.number_proportionality.ratios_proportions_percent',
      terms: ['porcentaje', 'proporcion', 'razon', 'descuento', 'interes', 'por ciento', 'regla de tres'] },
    { categoryId: 'matematicas.algebra_equations', subtopicId: 'matematicas.algebra_equations.equations_inequalities',
      terms: ['ecuacion', 'inecuacion', 'despejar', 'incognita', 'sistema de ecuaciones', 'expresion algebraica'] },
    { categoryId: 'matematicas.functions_variation', subtopicId: 'matematicas.functions_variation.functions_graphs',
      terms: ['funcion', 'grafica de', 'pendiente', 'variacion', 'crece', 'decrece', 'dominio'] },
    { categoryId: 'matematicas.geometry_measurement', subtopicId: 'matematicas.geometry_measurement.plane_geometry',
      terms: ['angulo', 'triangulo', 'circulo', 'paralelo', 'perpendicular', 'semejanza', 'poligono'] },
    { categoryId: 'matematicas.geometry_measurement', subtopicId: 'matematicas.geometry_measurement.perimeter_area_volume',
      terms: ['area', 'perimetro', 'volumen', 'superficie', 'capacidad', 'cilindro', 'esfera', 'cubo'] },
    { categoryId: 'matematicas.data_statistics_chance', subtopicId: 'matematicas.data_statistics_chance.tables_graphs_interpretation',
      terms: ['tabla', 'grafico', 'diagrama de barras', 'promedio', 'media', 'mediana', 'moda', 'datos'] },
    { categoryId: 'matematicas.data_statistics_chance', subtopicId: 'matematicas.data_statistics_chance.probability_counting',
      terms: ['probabilidad', 'azar', 'combinaciones', 'permutacion', 'al azar', 'posibilidades'] },
    { categoryId: 'matematicas.modeling_verification', subtopicId: 'matematicas.modeling_verification.modeling_word_problems',
      terms: ['procedimiento', 'estima', 'modelo', 'representa la situacion', 'es incorrecto', 'validar'] },
  ],
  ciencias_naturales: [
    { categoryId: 'ciencias_naturales.biology_component', subtopicId: 'ciencias_naturales.biology_component.ecology_evolution_biodiversity',
      terms: ['ecosistema', 'especie', 'evolucion', 'poblacion', 'organismo', 'celula', 'gen', 'biodiversidad', 'cadena alimenticia'] },
    { categoryId: 'ciencias_naturales.physics_component', subtopicId: 'ciencias_naturales.physics_component.motion_forces_dynamics',
      terms: ['fuerza', 'velocidad', 'aceleracion', 'movimiento', 'masa', 'newton', 'friccion', 'trayectoria'] },
    { categoryId: 'ciencias_naturales.physics_component', subtopicId: 'ciencias_naturales.physics_component.energy_heat_transformations',
      terms: ['energia', 'calor', 'temperatura', 'trabajo', 'potencia', 'conduccion', 'termico'] },
    { categoryId: 'ciencias_naturales.chemistry_component', subtopicId: 'ciencias_naturales.chemistry_component.chemical_changes_reactions',
      terms: ['reaccion', 'molecula', 'atomo', 'enlace', 'acido', 'base', 'ph', 'compuesto', 'solucion quimica'] },
    { categoryId: 'ciencias_naturales.science_tech_society', subtopicId: 'ciencias_naturales.science_tech_society.environment_sustainability',
      terms: ['ambiente', 'contaminacion', 'residuo', 'sostenible', 'recurso natural', 'impacto ambiental'] },
    { categoryId: 'ciencias_naturales.scientific_skills', subtopicId: 'ciencias_naturales.scientific_skills.data_interpretation_conclusions',
      terms: ['experimento', 'hipotesis', 'variable', 'concluir', 'medicion', 'resultado del estudio', 'investigador'] },
  ],
  sociales_ciudadanas: [
    { categoryId: 'sociales_ciudadanas.history_temporality', subtopicId: 'sociales_ciudadanas.history_temporality.historical_causality_consequences',
      terms: ['siglo', 'historico', 'colonia', 'independencia', 'guerra', 'periodo', 'consecuencia historica'] },
    { categoryId: 'sociales_ciudadanas.state_democracy_participation', subtopicId: 'sociales_ciudadanas.state_democracy_participation.social_rule_of_law_constitution',
      terms: ['constitucion', 'derecho', 'tutela', 'estado social', 'deber', 'ley', 'norma'] },
    { categoryId: 'sociales_ciudadanas.state_democracy_participation', subtopicId: 'sociales_ciudadanas.state_democracy_participation.state_branches_accountability',
      terms: ['rama', 'congreso', 'alcalde', 'gobierno', 'eleccion', 'voto', 'control ciudadano', 'institucion'] },
    { categoryId: 'sociales_ciudadanas.sources_perspectives_argumentation', subtopicId: 'sociales_ciudadanas.sources_perspectives_argumentation.primary_secondary_sources',
      terms: ['fuente', 'documento', 'testimonio', 'historiador', 'evidencia'] },
    { categoryId: 'sociales_ciudadanas.sources_perspectives_argumentation', subtopicId: 'sociales_ciudadanas.sources_perspectives_argumentation.actor_group_perspectives',
      terms: ['afirma', 'sostiene', 'una persona', 'opinion', 'postura', 'argumenta', 'grupo', 'punto de vista'] },
    { categoryId: 'sociales_ciudadanas.systems_thinking_decisions', subtopicId: 'sociales_ciudadanas.systems_thinking_decisions.cross_dimension_relations',
      terms: ['dimension', 'problema social', 'solucion', 'consecuencia', 'decision', 'politica publica', 'conflicto'] },
  ],
}

/** Strip accents and case so "función" and "funcion" score the same. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function guessSubtopic(subjectId: string, text: string): SubtopicGuess | null {
  const rules = RULES[subjectId]
  if (rules == null || rules.length === 0) return null

  const haystack = normalise(text)
  let best: { rule: Rule; hits: number } | null = null

  for (const rule of rules) {
    let hits = 0
    for (const term of rule.terms) {
      if (haystack.includes(normalise(term))) hits += 1
    }
    if (hits > 0 && (best == null || hits > best.hits)) best = { rule, hits }
  }

  if (best == null) {
    // No signal at all. Fall back to the subject's first subtopic at zero
    // confidence so the question is still storable and re-taggable, but the
    // caller will keep it out of anything that measures the student.
    const fallback = rules[0]!
    return { categoryId: fallback.categoryId, subtopicId: fallback.subtopicId, confidence: 0 }
  }

  // Two independent term hits is the bar for trusting a keyword tag; one hit is
  // as likely to be an incidental word as a topic signal.
  const confidence = Math.min(1, best.hits / 3)
  return {
    categoryId: best.rule.categoryId,
    subtopicId: best.rule.subtopicId,
    confidence,
  }
}
