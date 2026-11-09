/**
 * One glyph per subtopic, a single stroke path on a 24×24 grid, so all 33
 * stickers read as one set. Round caps turn a zero-length `h.01` into a dot.
 */
export const STICKER_GLYPHS: Record<string, string> = {
  'lectura_critica.literal_comprehension.word_phrase_meaning': 'M3 19 8 5l5 14M5 14h6M21 12v7M21 15.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  'lectura_critica.literal_comprehension.explicit_details': 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 21 21',
  'lectura_critica.structure_cohesion_multimodal.text_structure_parts': 'M5 3h14v18H5zM8 8h8M8 12h8M8 16h5',
  'lectura_critica.structure_cohesion_multimodal.logical_links_connectors': 'M9 15l6-6M10 6l1.5-1.5a4.2 4.2 0 0 1 6 6L16 12M14 18l-1.5 1.5a4.2 4.2 0 0 1-6-6L8 12',
  'lectura_critica.voices_perspective.voices_speakers': 'M3 4h12v9H8l-3 3v-3H3zM18 8h3v9h-2v3l-3-3h-5',
  'lectura_critica.critical_evaluation.validity_implications': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6',
  'lectura_critica.critical_evaluation.evaluative_content_bias': 'M12 4v16M7 20h10M5 7h14M5 7l-3 7h6zM19 7l-3 7h6z',
  'lectura_critica.context_intertextuality.contextualization': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3.5 3 3.5 15 0 18M12 3c-3.5 3-3.5 15 0 18',

  'matematicas.number_proportionality.ratios_proportions_percent': 'M19 5 5 19M7.5 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  'matematicas.algebra_equations.equations_inequalities': 'M3 9h7M3 14h7M14 6l7 12M21 6l-7 12',
  'matematicas.functions_variation.functions_graphs': 'M4 4v16h16M7 16c3-8 6-9 12-10',
  'matematicas.geometry_measurement.plane_geometry': 'M12 4 21 20H3zM12 20v-5',
  'matematicas.geometry_measurement.perimeter_area_volume': 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  'matematicas.data_statistics_chance.tables_graphs_interpretation': 'M4 20h16M7 20v-7M12 20V6M17 20v-10',
  'matematicas.data_statistics_chance.probability_counting': 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h.01M15.5 15.5h.01M12 12h.01',
  'matematicas.modeling_verification.modeling_word_problems': 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',

  'ciencias_naturales.biology_component.ecology_evolution_biodiversity': 'M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19l8-8',
  'ciencias_naturales.physics_component.motion_forces_dynamics': 'M3 8h7M3 12h5M3 16h7M13 6l7 6-7 6z',
  'ciencias_naturales.physics_component.energy_heat_transformations': 'M12 3c3 4 6 6.5 6 11a6 6 0 0 1-12 0c0-2.5 1.5-4 3-5 0 2 1 3 2 3 .7-3-.5-6 1-9z',
  'ciencias_naturales.chemistry_component.chemical_changes_reactions': 'M10 3h4M11 3v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19l-6-10V3M8 15h8',
  'ciencias_naturales.science_tech_society.environment_sustainability': 'M12 21v-6M12 15c-4 0-7-2-7-5s2-4 3-4c.5-2 2-3 4-3s3.5 1 4 3c1 0 3 1 3 4s-3 5-7 5z',
  'ciencias_naturales.scientific_skills.data_interpretation_conclusions': 'M8 3h8v3H8zM6 5H4v16h16V5h-2M8 14l3 3 5-6',

  'sociales_ciudadanas.history_temporality.historical_causality_consequences': 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9',
  'sociales_ciudadanas.state_democracy_participation.social_rule_of_law_constitution': 'M3 10 12 4l9 6zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  'sociales_ciudadanas.state_democracy_participation.state_branches_accountability': 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5.5 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18.5 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10.5 7.5 7 16.5M13.5 7.5l3.5 9M8.5 19h7',
  'sociales_ciudadanas.sources_perspectives_argumentation.primary_secondary_sources': 'M8 3h11v14H8zM5 7v14h11M11 8h5M11 12h5',
  'sociales_ciudadanas.sources_perspectives_argumentation.actor_group_perspectives': 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.7-3.5 3-5 6-5s5.3 1.5 6 5M16 5.2a3 3 0 0 1 0 5.6M18 15.5c1.6.8 2.6 2.4 3 4.5',
  'sociales_ciudadanas.systems_thinking_decisions.cross_dimension_relations': 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 10V4M12 20v-6M6.8 9l3.5 2M13.7 13l3.5 2M6.8 15l3.5-2M13.7 11l3.5-2',

  'ingles.lexis.vocab_definitions': 'M12 6c-2-2-5-2-8-2v15c3 0 6 0 8 2 2-2 5-2 8-2V4c-3 0-6 0-8 2zM12 6v15',
  'ingles.grammar_language_use.verb_tenses_forms': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  'ingles.pragmatics_functions.notices_instructions_signage': 'M12 3v18M5 5h12l3 3-3 3H5zM9 21h6',
  'ingles.reading_literal.explicit_info_paraphrase': 'M4 12c0-3 1.5-5 4-6M4 12h5v6H4zM13 12c0-3 1.5-5 4-6M13 12h5v6h-5z',
  'ingles.reading_inferential.inferences_conclusions': 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
}
