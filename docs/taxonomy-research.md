# Production Taxonomy Design for an ICFES Saber 11 Prep Platform in Colombia

## How Saber 11 is officially structured and why it matters for tagging

Saber 11 (education media exam) is organized around **five academic tests** that are relevant to your platform—**Lectura Crítica, Matemáticas, Sociales y Ciudadanas, Ciencias Naturales, e Inglés**—and is administered in **two sessions** with a fixed number of questions per test in the standard booklet. The official orientation guide for 2026 shows, for the standard booklet, **Lectura Crítica (41 questions), Matemáticas (50 total across two sessions), Sociales y Ciudadanas (50 total), Ciencias Naturales (58 total), and Inglés (55 questions)** (the guide also includes other non-academic components like socio-economic questionnaire and climate survey that most prep platforms omit). citeturn16view0

Across those five tests, ICFES frameworks consistently separate:
- **What is being measured (competencies/skills stated as “competencias,” “afirmaciones,” “evidencias”)**  
- **What domain content is being used to elicit evidence (components/content categories, texts, contexts, item/task formats)**

That separation is central to building a production taxonomy that supports:
- **Diagnostics** (balanced coverage by competency + content)
- **Progress tracking** (stable skill/content traces over time)
- **Recommendations** (next-best practice based on weakest skill/content nodes)
- **Tutor/review flows** (explanations tied to the skill + content + representation demands)

In fact, in multiple tests, ICFES explicitly operationalizes competencies through a **Design Centered on Evidence** approach (competencia → afirmación → evidencia → task → item), which is exactly the structure that a tagging system should mirror (at least partially) for reliability and analytics. citeturn18view0turn14view0turn7view1turn8view2

### Official competency “spines” by test (high-level)

This is the short, official structure you asked for—what ICFES is explicitly measuring in each test:

- **Lectura Crítica**: one reading competency expressed in **three “afirmaciones”**:  
  1) identify/understand local content, 2) integrate parts for global meaning, 3) reflect/evaluate content (with specific evidences like vocabulary meaning, text structure, voices, intertextuality, discursive strategies, contextualization). citeturn18view0  
- **Matemáticas**: **three competencies**: **Interpretación y representación**, **Formulación y ejecución**, **Argumentación**; content is organized around major math categories (e.g., álgebra y cálculo, geometría, estadística) and **real-world vs abstract contexts**. citeturn4view0turn14view0  
- **Sociales y Ciudadanas**: **three competencies**: **Pensamiento social**, **Interpretación y análisis de perspectivas**, **Pensamiento reflexivo y sistémico**; the framework highlights source use (primary/secondary), perspective comparison, and that the exam **does not grade students’ personal opinions**, but their ability to analyze and justify. citeturn6view3turn7view1turn10view0  
- **Ciencias Naturales**: **three competencies**: **Uso comprensivo del conocimiento científico**, **Explicación de fenómenos**, **Indagación**; and **four components**: **biológico, físico, químico, CTS (ciencia, tecnología y sociedad)**. citeturn8view2turn15view2turn15view1  
- **Inglés**: aligned to **MCER/CEFR** with evaluation focused on **reading and “use of language”**, and tied to national standards; the framework explicitly references communicative competence components (linguistic, pragmatic, sociolinguistic) and describes the item/task structure. citeturn9view1turn9view3turn16view0  

Nationally, these tests are also described as aligned with Colombian quality frameworks (e.g., **Estándares Básicos de Competencias**), including **English standards** and broader standards documents that cover math/science/social foundations. citeturn11search0turn11search2turn16view0  

## Design principles for a tagging taxonomy that actually powers adaptivity

A production taxonomy for an adaptive prep platform should behave more like a **knowledge component model** (KC model) than like a curriculum outline: a small set of stable nodes that produce **useful learning signals** when students interact with items over time. KC models are widely used in adaptive learning systems because they enable measurement, analytics, and personalized sequencing when items are consistently tagged. citeturn12search12turn12search4turn12search13

Based on your constraints (LLM auto-tagging from text/images; stable over time; 3-level hierarchy; not too granular), the most practical design is:

- **Taxonomy (3-level)** = “What content/topic is this question *about* in a way you can recommend practice on?”  
- **Secondary dimensions (non-taxonomy tags)** = “What cognitive process / representation / load does the question demand?”

This split is important because:
- If you embed too much “cognitive process” into the same axis as content, you often create either (a) a cross-product explosion or (b) ambiguous tags that are hard to infer reliably per item. This is a known problem in automated classification of question cognitive levels (e.g., Bloom-based tagging often has lower reliability, especially across domains). citeturn12search3turn12search11turn12search27  
- Conversely, if you tag only content and ignore cognitive demands, adaptive recommendations become blunt: students can “know” proportions but fail whenever the same math is presented as a graph/table or embedded in a multi-step context. (This is exactly why ICFES competencies focus on interpretation, formulation, and argumentation as distinct abilities.) citeturn4view0turn14view0  
- Multi-tagging is beneficial when items genuinely involve multiple concepts, but it must be controlled; research on adaptive learner models explicitly discusses handling items tagged with multiple concepts. citeturn12search16  
- Inconsistent tagging over time becomes a real operational risk and can undermine student modeling; this has been documented in commercial contexts. citeturn12search9  

So the recommendation below: a **stable 3-level taxonomy** for content/subtopic, plus **secondary dimensions** for official competencies and item “demands.”

## Recommended three-level taxonomy for Saber 11 question tagging

The taxonomy below is designed to be:
- **Implementation-ready** (stable IDs, “origin” labels, moderate granularity)
- **LLM-friendly** (each subtopic can usually be inferred from one question + its stimulus)
- **Adaptive-learning friendly** (subtopics are actionable for practice sets + explanations)

**Conventions used below**
- **Label (ES)**: Spanish user-facing label  
- **ID/slug (EN)**: engineering identifier (stable; lowercase snake_case)  
- **Origin**:
  - **official** = exactly mirrors an official term/component from ICFES/MEN/MCER framing
  - **derived** = a stable, pragmatic refinement of official framing (recommended default)
  - **product_specific** = platform optimization beyond official frameworks

### Lectura Crítica taxonomy

**Official structure anchor**: Lectura Crítica is modeled through three afirmaciones and evidences such as vocabulary meaning, explicit events/characters, structure/function of parts, voices, relations between clauses, ideas/claims, relationships in discontinuous texts, validity/implications, intertextuality, evaluative content, discursive strategies, and contextualization. citeturn18view0turn13view1

**Recommended L2 categories and L3 subtopics (Lectura Crítica)**  
(6 L2 categories; 14 L3 subtopics)

| Level 2 category (ES / slug_en / origin) | Level 3 subtopic (ES / slug_en / origin) | Short definition (for consistent tagging) | Typical item signals / example questions |
|---|---|---|---|
| **Comprensión literal** / `literal_comprehension` / **derived** | **Significado de palabras y expresiones** / `word_phrase_meaning` / **derived** | Identify meaning of explicit word/phrase, including paraphrase, synonym, or local reference meaning. | “¿Qué significa X en el texto?” “La expresión ‘…’ implica…” |
|  | **Hechos y detalles explícitos** / `explicit_details` / **derived** | Retrieve explicit “who/what/when/where” info, including events/characters in narratives or comics. | “Según el texto, ¿quién…?” “¿Qué ocurrió primero?” citeturn18view0 |
| **Estructura, cohesión y textos discontinuos** / `structure_cohesion_multimodal` / **derived** | **Estructura y función de partes** / `text_structure_parts` / **derived** | Recognize introduction/conclusion, thesis/support, paragraph function, section purpose. | “¿Cuál es la función del párrafo 2?” “El mejor resumen…” citeturn18view0 |
|  | **Relaciones lógicas y conectores** / `logical_links_connectors` / **derived** | Identify causal/contrast/addition/condition relations signaled by connectors or sentence structure. | “La relación entre A y B es…” “Por lo tanto / sin embargo…” |
|  | **Lectura de textos discontinuos** / `discontinuous_text_relations` / **official** (matches evidence 2.5) | Determine relation among elements in tables, infographics, charts, mixed-format texts (as reading tasks, not math). | “Según la infografía, …” “La relación entre columnas indica…” citeturn18view0turn13view2 |
| **Voces y perspectiva** / `voices_perspective` / **derived** | **Identificación de voces/enunciadores** / `voices_speakers` / **official** (matches evidence 2.2) | Recognize narrator, quoted speaker, author vs character voice, stance shifts. | “¿Quién sostiene la afirmación…?” “La voz que critica…” citeturn18view0 |
|  | **Situación comunicativa y punto de vista** / `communicative_situation_pov` / **derived** | Infer intended audience, speaker position, perspective framing (still within text). | “El autor se dirige a…” “La postura del texto es…” |
| **Ideas y argumentación interna del texto** / `ideas_arguments` / **derived** | **Idea principal y tema** / `main_idea_theme` / **derived** | Identify central idea, topic, or thesis-like claim; distinguish supporting details. | “La idea central es…” “El propósito principal…” |
|  | **Afirmaciones, evidencias y conclusiones** / `claims_evidence_conclusions` / **official/derived** | Identify claims present in informative/argumentative text and how they are supported. | “¿Qué afirmación respalda…?” “¿Cuál evidencia apoya…?” citeturn18view0 |
| **Evaluación crítica del contenido** / `critical_evaluation` / **derived** | **Validez e implicaciones de enunciados** / `validity_implications` / **official** (evidence 3.1) | Judge whether an argument/statement is valid and what follows from it (implications). | “Si X, entonces…” “La conclusión válida sería…” citeturn18view0 |
|  | **Contenidos valorativos y sesgo** / `evaluative_content_bias` / **official** (evidence 3.3) | Detect evaluative language, value judgments, bias/loaded framing, tone. | “El texto valora…” “El adjetivo sugiere…” citeturn18view0 |
|  | **Estrategias discursivas y retóricas** / `discursive_rhetorical_strategies` / **official** (evidence 3.4) | Identify rhetorical tools: irony, analogy, emotional appeal, authority, etc. | “Se usa la ironía para…” “El recurso busca persuadir…” citeturn18view0 |
| **Contexto e intertextualidad** / `context_intertextuality` / **derived** | **Relaciones intertextuales** / `intertextual_links` / **official** (evidence 3.2) | Connect the text to another text/enunciation: agreement, contradiction, complement. | “Comparado con el texto B…” “Ambos coinciden en…” citeturn18view0 |
|  | **Contextualización histórica/cultural/situacional** / `contextualization` / **official** (evidence 3.5) | Use context of production (time, place, situation, cultural references) to interpret meaning. | “En el contexto de…” “La referencia cultural implica…” citeturn18view0 |

**Why this is appropriate for adaptive practice (Lectura Crítica)**  
ICFES explicitly structures reading ability as progressing from **literal → inferential → critical** and operationalizes it via evidences. citeturn18view0 The taxonomy groups those evidences into a small number of practice-ready buckets that support (a) targeted drills (e.g., connectors, voices), (b) mixed practice for transfer (e.g., critical evaluation across genres), and (c) error diagnosis (students often fail not due to topic but due to reading process). This aligns with the logic of knowledge-component-based adaptivity, where stable tags enable tracking and sequencing. citeturn12search12turn12search4

### Matemáticas taxonomy

**Official structure anchor**: The Saber 11 math framework evaluates **three competencies** (Interpretación y representación; Formulación y ejecución; Argumentación) and uses content categories (álgebra y cálculo, geometría, estadística) plus context types (personal/family, occupational, social, abstract math/science). citeturn4view0turn14view0turn5view2

**Recommended L2 categories and L3 subtopics (Matemáticas)**  
(6 L2 categories; 14 L3 subtopics)

| Level 2 category (ES / slug_en / origin) | Level 3 subtopic (ES / slug_en / origin) | Short definition | Typical item signals / example questions |
|---|---|---|---|
| **Número y proporcionalidad** / `number_proportionality` / **derived** | **Razones, proporciones y porcentajes** / `ratios_proportions_percent` / **derived** | Solve with ratios, unit rates, percent change, “regla de tres,” fraction/decimal/percent conversions. | Descuentos, impuestos, mezclas simples, escalas; “¿qué porcentaje…?” citeturn14view0 |
|  | **Operaciones y propiedades numéricas** / `numeric_operations_properties` / **derived** | Arithmetic operations and properties, order of operations, approximations, sign, magnitude comparisons. | “calcular…”, “ordenar…”, propiedades, estimación citeturn14view0 |
| **Álgebra y ecuaciones** / `algebra_equations` / **derived** | **Expresiones algebraicas** / `algebraic_expressions` / **derived** | Simplify/transform expressions, factor/distribute, equivalence. | “simplificar”, “factorizar”, “equivalente a…” citeturn14view0 |
|  | **Ecuaciones e inecuaciones** / `equations_inequalities` / **derived** | Solve linear/quadratic/simple systems or inequalities as the main tool. | “resolver para x”, “intervalo solución”, “sistema” citeturn14view0 |
| **Funciones y variación** / `functions_variation` / **derived** | **Funciones y gráficas** / `functions_graphs` / **derived** | Interpret/function behavior or graphs: slope, intercepts, domain/range qualitatively. | f(x), gráfica cartesiana, crecimiento, intersecciones citeturn14view0turn5view2 |
|  | **Tasas de cambio y variación** / `rates_of_change` / **derived** | Rate/ratio of change in contexts: speed, exchange rates, interest, “razón de cambio.” | “velocidad”, “tasa”, “interés”, pendiente implícita citeturn14view0 |
|  | **Patrones y sucesiones** / `patterns_sequences` / **derived** | Identify/extend pattern; simple sequences; rule-based growth. | “siguiente término”, “patrón”, progresión citeturn14view0 |
| **Geometría y medición** / `geometry_measurement` / **derived** | **Geometría plana** / `plane_geometry` / **derived** | Angles, triangles, similarity/congruence, classic theorems (e.g., Pitágoras, Tales) as tools. | Diagramas, triángulos, ángulos, semejanza citeturn14view0 |
|  | **Perímetro, área y volumen** / `perimeter_area_volume` / **derived** | Compute/compare measures; unit reasoning included. | “área”, “volumen”, “superficie”, unidades citeturn5view2turn14view0 |
|  | **Coordenadas y transformaciones** / `coordinates_transformations` / **derived** | Cartesian coordinates, distance/position on plane; translations/rotations/reflections/scaling. | Plano cartesiano, transformaciones, simetría citeturn14view0 |
| **Datos, estadística y azar** / `data_statistics_chance` / **derived** | **Interpretación de tablas y gráficas** / `tables_graphs_interpretation` / **derived** | Read/compare values, trends, distributions; may be purely interpretive or used for computation. | Barras, líneas, histogramas, tablas; “según la gráfica…” citeturn14view0 |
|  | **Medidas de tendencia central y dispersión** / `central_tendency_dispersion` / **derived** | Mean/median/mode, range, variability; basic correlation interpretation if present. | “media”, “mediana”, “varianza”, “percentiles” citeturn14view0 |
|  | **Probabilidad y conteo** / `probability_counting` / **derived** | Probability of events; combinations/permutations at an intuitive level; sample space reasoning. | “probabilidad”, “evento”, conteo de casos citeturn14view0turn5view2 |
| **Modelación y verificación** / `modeling_verification` / **product_specific** | **Modelación de situaciones** / `modeling_word_problems` / **derived/product_specific** | Translate a contextual situation into math representation (equation/table/function) as the core challenge. | Enunciados largos; seleccionar variable; plantear modelo citeturn14view0 |
|  | **Argumentación y validación de soluciones** / `argumentation_solution_validation` / **derived** | Check plausibility, refute/defend a method, detect error; aligns with official “Argumentación.” | “¿Cuál razonamiento es correcto?” “¿Qué error comete…?” citeturn4view0turn14view0 |

**Why this is appropriate for adaptive practice (Matemáticas)**  
ICFES distinguishes **interpretation**, **execution**, and **argumentation** as core competencies and explicitly ties items to representations and contexts. citeturn4view0turn14view0 The taxonomy maintains stable content-and-representation subtopics that can be practiced and remediated directly (e.g., proportions; plane geometry; graph interpretation), while still mapping back to official competency reporting via secondary tags (recommended below). This supports diagnostics that are both “Saber-aligned” and instructionally actionable. citeturn12search12turn12search16

### Ciencias Naturales taxonomy

**Official structure anchor**: Sciences evaluate three competencies (uso comprensivo; explicación; indagación) and four components (biológico, físico, químico, CTS). The framework also names typical concept families per component (e.g., homeostasis, heredity, ecology/evolution; kinematics/dynamics/energy/waves/electromagnetism; atom/bonds/reactions/mixtures/solubility/gases; CTS topics like deforestation/greenhouse effect/transgenics/waste). citeturn8view2turn15view2turn15view1

**Recommended L2 categories and L3 subtopics (Ciencias Naturales)**  
(5 L2 categories; 13 L3 subtopics)

| Level 2 category (ES / slug_en / origin) | Level 3 subtopic (ES / slug_en / origin) | Short definition | Typical item signals / example questions |
|---|---|---|---|
| **Componente biológico** / `biology_component` / **official** | **Homeostasis y función en organismos** / `homeostasis_organism_function` / **derived** | Systems/processes that maintain life (regulation, transport, body processes) and how parts support function. | “homeostasis”, órganos/sistemas, regulación citeturn15view2 |
|  | **Herencia, genética y reproducción** / `genetics_reproduction` / **derived** | Inheritance, reproduction, traits, basic genetics reasoning. | “herencia”, reproducción, rasgos, ADN (conceptually) citeturn15view2 |
|  | **Ecología, evolución y biodiversidad** / `ecology_evolution_biodiversity` / **derived** | Ecological relationships, adaptation/evolution, biodiversity and ecosystem dynamics. | cadenas tróficas, evolución, relaciones ecológicas citeturn15view2turn15view0 |
| **Componente físico** / `physics_component` / **official** | **Movimiento, fuerzas y dinámica** / `motion_forces_dynamics` / **derived** | Kinematics/dynamics reasoning: motion description, forces, interactions in physical systems. | “velocidad”, “aceleración”, fuerzas, dinámica citeturn15view2turn15view0 |
|  | **Energía, calor y transformaciones** / `energy_heat_transformations` / **derived** | Energy forms and transformations; thermal processes; conservation ideas in context. | energía mecánica/térmica; conservación/transformación citeturn15view0turn15view2 |
|  | **Ondas y electromagnetismo** / `waves_electromagnetism` / **derived** | Waves phenomena; electricity/magnetism; basic circuits if present. | “ondas”, “circuito”, voltaje/corriente, imantación citeturn15view0turn8view4 |
| **Componente químico** / `chemistry_component` / **official** | **Estructura y propiedades de la materia** / `matter_structure_properties` / **derived** | Atom-level structure, bonding types qualitatively, properties linked to structure. | átomo, enlaces, propiedades citeturn15view0 |
|  | **Cambios químicos y reacciones** / `chemical_changes_reactions` / **derived** | Chemical change reasoning, reaction evidence, conservation ideas, qualitative stoichiometry framing. | “reacción”, cambios químicos, conservación citeturn15view0 |
|  | **Mezclas, soluciones y gases** / `mixtures_solutions_gases` / **derived** | Separation of mixtures, solubility, gas behavior conceptually, states of matter. | separación, solubilidad, gases ideales (conceptual) citeturn15view0 |
| **Ciencia, tecnología y sociedad** / `science_tech_society` / **official** | **Ambiente y sostenibilidad** / `environment_sustainability` / **derived** | Interdisciplinary environmental issues: deforestation, greenhouse effect, waste, resource exploitation. | “deforestación”, efecto invernadero, basuras citeturn15view2 |
|  | **Impacto de la ciencia y la tecnología en la vida social** / `sci_tech_impact_society` / **official/derived** | How science/technology change living conditions; distinguishing natural vs human-made; benefit/risk reasoning. | tecnología, bienestar, herramientas, transformaciones sociales citeturn15view1turn15view2 |
| **Habilidades científicas** / `scientific_skills` / **product_specific** | **Indagación y diseño de procedimientos** / `inquiry_design` / **official/derived** | Set up questions/procedures; identify variables; choose methods; predict. | “hipótesis”, “variable”, procedimiento, predicción citeturn15view1turn8view4 |
|  | **Interpretación de datos y conclusiones** / `data_interpretation_conclusions` / **official/derived** | Organize/interpret data (tables/graphs), detect patterns/correlations, draw supported conclusions. | gráficas/tablas, patrones, correlación, conclusiones citeturn15view1turn8view4 |

**Why this is appropriate for adaptive practice (Ciencias Naturales)**  
ICFES’s own structure is already dual: **competencies (process)** × **components (content)**. citeturn15view2turn8view2 The taxonomy keeps component-based categories as the stable spine (excellent for item bank organization and practice planning) and adds a small “scientific skills” category to capture indagación/data reasoning demands for recommendations and tutor flows (students often need “how to reason from evidence” practice that cuts across biology/physics/chemistry). This is consistent with adaptive learning practice where items are tagged with multiple knowledge components and/or skills to improve learner modeling. citeturn12search12turn12search16

### Sociales y Ciudadanas taxonomy

**Official structure anchor**: The test evaluates three competencies: pensamiento social; interpretación y análisis de perspectivas; pensamiento reflexivo y sistémico. Official evidences include knowledge of Estado Social de Derecho, organization of the state, mechanisms of citizen participation; source contextualization; evaluating sources; comparing actor perspectives; and systems thinking about interventions and multi-dimensional effects. citeturn6view3turn7view1turn10view0  
The framework also emphasizes scope: in Saber 11, citizenship evaluation is limited to the **cognitive component** (not emotional/communicative) and the test does not ask for “politically correct” personal opinions. citeturn6view0turn10view0

**Recommended L2 categories and L3 subtopics (Sociales y Ciudadanas)**  
(6 L2 categories; 13 L3 subtopics)

| Level 2 category (ES / slug_en / origin) | Level 3 subtopic (ES / slug_en / origin) | Short definition | Typical item signals / example questions |
|---|---|---|---|
| **Historia y temporalidades** / `history_temporality` / **derived** | **Periodización, cambio y continuidad** / `periodization_change_continuity` / **derived** | Explain transformations/ruptures/continuities; place events into broader processes. | “cambio/continuidad”, “procesos históricos”, causas a largo plazo citeturn7view1 |
|  | **Causalidad histórica y consecuencias** / `historical_causality_consequences` / **derived** | Analyze causes, consequences, impacts of events/processes; not memorizing dates. | “causas y consecuencias”, impactos, dinámicas citeturn7view1turn6view2 |
| **Espacio, territorio y ambiente** / `space_territory_environment` / **derived** | **Lectura de mapas y organización territorial** / `maps_territorial_organization` / **derived** | Interpret spatial representations (maps, regions, borders) to support claims. | mapas, regiones, distribución espacial citeturn6view2 |
|  | **Ambiente, recursos y transformaciones del territorio** / `environment_resources_territory_change` / **derived** | Human-environment interactions, resource use, urbanization, territory management. | territorio/ambiente, uso del suelo, impactos citeturn6view2 |
| **Economía y organización social** / `economy_social_organization` / **derived** | **Conceptos económicos básicos** / `basic_economic_concepts` / **derived** | Supply/demand, production, trade, inequality, indicators at a conceptual level. | “economía”, “mercado”, pobreza/productividad citeturn6view2turn7view1 |
|  | **Estructuras sociales y desigualdad** / `social_structures_inequality` / **derived** | Roles, institutions, stratification, social dynamics shaping outcomes. | estratos, desigualdad, organización social citeturn7view1 |
| **Estado, democracia y participación** / `state_democracy_participation` / **derived** | **Estado Social de Derecho y Constitución** / `social_rule_of_law_constitution` / **official** (appears as evidence in framework) | Identify/interpret the constitutional model and its application; rights/institutions framing. | “Estado Social de Derecho”, constitución, legalidad citeturn6view3turn7view1 |
|  | **Organización del Estado y control ciudadano** / `state_branches_accountability` / **official/derived** | Branches of power, oversight bodies, participation mechanisms, accountability. | ramas del poder, organismos de control, mecanismos citeturn6view3 |
| **Derechos, convivencia y conflicto** / `rights_coexistence_conflict` / **derived** | **Derechos y ciudadanía** / `rights_citizenship` / **derived** | Rights reasoning in social situations; equality, inclusion; civic principles. | derechos, deberes, discriminación, ciudadanía citeturn6view0turn10view0 |
|  | **Conflicto, paz y convivencia** / `conflict_peace_coexistence` / **derived** | Analyze conflicts, peace processes, coexistence problems; evaluate alternatives. | conflicto armado/paz, convivencia, resolución citeturn7view1 |
| **Fuentes, perspectivas y argumentación social** / `sources_perspectives_argumentation` / **derived** | **Fuentes primarias y secundarias** / `primary_secondary_sources` / **official** | Identify type of source; contextualize; evaluate limitations/uses of a source as evidence. | “fuente”, documento, testimonio/registro vs análisis citeturn7view1turn6view3 |
|  | **Perspectivas de actores y grupos** / `actor_group_perspectives` / **official/derived** | Recognize and compare viewpoints of social actors/groups on a problem. | “posturas”, actores sociales, perspectivas citeturn7view1turn6view3 |
|  | **Argumentos, evidencia y toma de postura analítica** / `arguments_evidence_analytic_stance` / **derived** | Build/evaluate arguments without relying on personal opinion; justify with evidence. | “cuál argumento es más sólido”, “evidencia apoya…” citeturn10view0turn6view3 |
| **Pensamiento sistémico y decisiones** / `systems_thinking_decisions` / **derived** | **Relaciones entre dimensiones de un problema** / `cross_dimension_relations` / **official/derived** | Connect economic/political/cultural/geographic dimensions; multi-causal reasoning. | “relación entre dimensiones”, sistema, interacción citeturn6view3turn7view1 |
|  | **Efectos de intervenciones y consecuencias no intencionales** / `intervention_effects_tradeoffs` / **official/derived** | Evaluate plausible impacts of an intervention across dimensions and contexts. | “si se implementa X, ¿qué pasa con…?” citeturn6view3turn7view1 |

**Why this is appropriate for adaptive practice (Sociales y Ciudadanas)**  
The official competencies are cognitive processes that cut across many themes (history, economy, territory, citizenship). citeturn6view3turn10view0 For recommendation, students benefit from **theme-based remediation** (e.g., “Estado y participación”) plus **analysis tools** (sources/perspective/systemic trade-offs). That pairing enables: (a) diagnostics that show *what theme* is weak and *what reasoning mode* is weak, and (b) tutor flows that can teach “how to analyze sources” separately from “knowing state structure.” This mirrors the rationale of competency frameworks that separate skills from content while enabling alignment. citeturn12search2turn12search6

### Inglés taxonomy

**Official structure anchor**: ICFES explicitly states the English test is designed with MCER levels and evaluates **reading and use of language**. It describes communicative competence components (linguistic, pragmatic, sociolinguistic) and item/task parts (e.g., notices/signs, matching words/descriptions, grammar structures, reading comprehension tasks). citeturn9view1turn9view3turn10view0  
It is also aligned with the national English standards from entity["organization","Ministerio de Educación Nacional","colombia education ministry"] and broader curricular lineamientos mentioned in the framework. citeturn9view3turn11search2turn10view0

**Recommended L2 categories and L3 subtopics (Inglés)**  
(5 L2 categories; 10 L3 subtopics)

| Level 2 category (ES / slug_en / origin) | Level 3 subtopic (ES / slug_en / origin) | Short definition | Typical item signals / example questions |
|---|---|---|---|
| **Léxico** / `lexis` / **derived** | **Vocabulario y definiciones** / `vocab_definitions` / **derived** | Match meanings to words (including word lists); basic lexical knowledge. | matching tasks; “best word for…” citeturn9view3turn10view0 |
|  | **Vocabulario en contexto** / `vocab_in_context` / **derived** | Infer meaning from context inside a short text; synonyms/paraphrase. | “In line X, the word … means” |
| **Gramática y uso del lenguaje** / `grammar_language_use` / **derived** | **Estructura de oración y concordancia** / `sentence_structure_agreement` / **derived** | Grammatical correctness: word order, agreement, pronouns, connectors as grammar. | fill-in-the-blank grammar citeturn9view3turn10view0 |
|  | **Tiempos verbales y formas verbales** / `verb_tenses_forms` / **derived** | Tense/aspect/modals; selecting correct form to convey meaning. | “has/have”, “will/would”, modals |
| **Pragmática y funciones comunicativas** / `pragmatics_functions` / **official/derived** | **Avisos, instrucciones y señalética** / `notices_instructions_signage` / **derived** | Understand what a sign/notice means and where it would appear; functional language. | signs; “Where would you see this notice?” citeturn9view3turn10view0 |
|  | **Intención comunicativa en mensajes** / `communicative_intent_messages` / **derived** | Identify purpose (inviting, requesting, warning, apologizing) in short messages/dialogues. | emails, dialogues; speech acts |
| **Comprensión lectora literal** / `reading_literal` / **derived** | **Información explícita y parafraseo** / `explicit_info_paraphrase` / **derived** | Retrieve explicit facts; match paraphrased statements to text. | “According to the text…” literal |
|  | **Referencias y cohesión básica** / `references_basic_cohesion` / **derived** | Pronoun/reference tracking inside text; simple cohesion. | “What does ‘it’ refer to?” |
| **Comprensión lectora inferencial** / `reading_inferential` / **derived** | **Idea principal y propósito del texto** / `main_idea_purpose` / **derived** | Main idea, author purpose, topic, text intention. | “The main purpose is…” |
|  | **Inferencias y conclusiones** / `inferences_conclusions` / **derived** | Infer implied meaning, conclusion, attitude/tone (at Saber level). | “It can be inferred that…” |

**Why this is appropriate for adaptive practice (Inglés)**  
The test is explicitly focused on **reading + language use** with task types that repeatedly measure functional understanding and comprehension at CEFR-related levels. citeturn9view1turn9view3turn10view0 This taxonomy groups items into the few skill clusters that are both teachable (vocabulary/grammar/pragmatics) and recommendation-friendly (literal vs inferential reading), enabling targeted sessions like “pragmatics + signage” or “grammar forms + reading paraphrase,” which typically improve performance efficiently in multiple-choice contexts. citeturn12search12turn12search13

## Mapping from official frameworks to the proposed platform taxonomy

The mapping below distinguishes:
- **Official framework elements** (competencies, components, evidences)  
- **Platform taxonomy tags** (your 3-level system)  
- **Recommended secondary dimensions** (beyond taxonomy) to preserve official reporting power

### Lectura Crítica mapping

| Official framework element (ICFES) | Proposed taxonomy mapping (L2 → L3) |
|---|---|
| Afirmación 1: Identifica y entiende contenidos locales citeturn18view0 | `literal_comprehension → word_phrase_meaning`, `literal_comprehension → explicit_details` |
| Evidencia 1.1: significado de elementos locales citeturn18view0 | `literal_comprehension → word_phrase_meaning` |
| Evidencia 1.2: eventos/personajes explícitos citeturn18view0 | `literal_comprehension → explicit_details` |
| Afirmación 2: articula partes para sentido global citeturn18view0 | `structure_cohesion_multimodal → text_structure_parts`, `logical_links_connectors`, `discontinuous_text_relations`; `ideas_arguments → main_idea_theme` |
| Evidencia 2.1 estructura formal/función de partes citeturn18view0 | `structure_cohesion_multimodal → text_structure_parts` |
| Evidencia 2.2 voces/situaciones citeturn18view0 | `voices_perspective → voices_speakers`, `communicative_situation_pov` |
| Evidencia 2.3 relaciones entre partes/enunciados citeturn18view0 | `structure_cohesion_multimodal → logical_links_connectors` |
| Evidencia 2.4 ideas/afirmaciones en texto informativo citeturn18view0 | `ideas_arguments → claims_evidence_conclusions` |
| Evidencia 2.5 relación entre elementos (texto discontinuo) citeturn18view0 | `structure_cohesion_multimodal → discontinuous_text_relations` |
| Afirmación 3: reflexiona y evalúa contenido citeturn18view0 | `critical_evaluation` + `context_intertextuality` family |
| Evidencia 3.1 validez/implicaciones citeturn18view0 | `critical_evaluation → validity_implications` |
| Evidencia 3.2 relaciones intertextuales citeturn18view0 | `context_intertextuality → intertextual_links` |
| Evidencia 3.3 contenidos valorativos citeturn18view0 | `critical_evaluation → evaluative_content_bias` |
| Evidencia 3.4 estrategias discursivas citeturn18view0 | `critical_evaluation → discursive_rhetorical_strategies` |
| Evidencia 3.5 contextualización citeturn18view0 | `context_intertextuality → contextualization` |

### Matemáticas mapping

| Official framework element (ICFES) | Proposed taxonomy mapping | Recommended secondary tags |
|---|---|---|
| Competencia: Interpretación y representación citeturn4view0turn14view0 | Often pairs with `functions_graphs`, `tables_graphs_interpretation`, geometry diagram reads | `competencia_oficial_math=interpretacion_representacion` |
| Competencia: Formulación y ejecución citeturn4view0turn14view0 | Often pairs with `modeling_word_problems`, `equations_inequalities`, `rates_of_change` | `competencia_oficial_math=formulacion_ejecucion` |
| Competencia: Argumentación citeturn4view0turn14view0 | Often pairs with `argumentation_solution_validation` | `competencia_oficial_math=argumentacion` |
| Content categories: álgebra y cálculo / geometría / estadística citeturn5view2turn14view0 | Map to L2: `algebra_equations`, `functions_variation`, `geometry_measurement`, `data_statistics_chance` | (optional) `componente_oficial_math` if you want explicit content reporting |
| Contexts: personales; laborales; comunitarios; matemáticos/científicos citeturn14view0 | Does not change the taxonomy node; affects recommendation variety | `contexto_item` (see “secondary dimensions”) |

### Ciencias Naturales mapping

| Official framework element (ICFES) | Proposed taxonomy mapping | Recommended secondary tags |
|---|---|---|
| Competencia: Uso comprensivo del conocimiento científico citeturn8view2turn10view0 | Most items still map by component content (bio/phys/chem/CTS) | `competencia_oficial_science=uso_comprensivo` |
| Competencia: Explicación de fenómenos citeturn8view5turn10view0 | Often pairs with component subtopics + “explanatory model” reasoning | `competencia_oficial_science=explicacion_fenomenos` |
| Competencia: Indagación citeturn8view4turn15view1turn10view0 | Maps strongly to `scientific_skills` subtopics | `competencia_oficial_science=indagacion` |
| Componentes: biológico/físico/químico/CTS citeturn15view2turn15view1 | Directly map to L2 categories of the same names | — |

### Sociales y Ciudadanas mapping

| Official framework element (ICFES) | Proposed taxonomy mapping | Recommended secondary tags |
|---|---|---|
| Competencia: Pensamiento social citeturn6view3turn10view0 | Maps most often to `state_democracy_participation`, `economy_social_organization`, `history_temporality`, `space_territory_environment` | `competencia_oficial_social=pensamiento_social` |
| Competencia: Interpretación y análisis de perspectivas citeturn6view3turn7view1turn10view0 | Maps to `sources_perspectives_argumentation` and sometimes `systems_thinking_decisions` | `competencia_oficial_social=analisis_perspectivas` |
| Competencia: Pensamiento reflexivo y sistémico citeturn6view3turn7view1turn10view0 | Maps to `systems_thinking_decisions` and intervention tradeoff subtopic | `competencia_oficial_social=pensamiento_sistemico` |
| Fuentes primarias/secundarias; perspectiva; modelos conceptuales citeturn7view1 | Map to `primary_secondary_sources`, `actor_group_perspectives`, `cross_dimension_relations` | `stimulus_type=fuente_primaria/segunda` (optional) |

### Inglés mapping

| Official framework element | Proposed taxonomy mapping | Recommended secondary tags |
|---|---|---|
| Alignment to MCER and reading+language-use focus citeturn9view1turn10view0 | Supports L2 split: lexis/grammar/pragmatics/reading literal/reading inferential | `cefr_band` (derived) |
| MEN communicative competence components: linguistic/pragmatic/sociolinguistic citeturn9view3turn11search2 | Maps to L2: `lexis`, `grammar_language_use`, `pragmatics_functions` | `competencia_oficial_english=linguistica/pragmatica/sociolinguistica` (optional) |
| Task structure: notices, matching, grammar, reading citeturn9view3turn16view0 | Maps cleanly to L3 subtopics like `notices_instructions_signage`, grammar forms, reading inference | `stimulus_type` (dialogue/email/article/sign) |

## Guidance for LLM tagging in ingestion

### Tagging approach that is robust in production

A practical production approach (especially with scanned PDFs and multimodal stimuli) is:

1. **Input packaging**: send the LLM not just the question stem/options, but the **full stimulus** (passage, infographic, table, diagram) and any “shared stimulus ID” if multiple questions refer to the same text. In Saber-style exams, many questions are stimulus-dependent. citeturn13view1turn9view3  

2. **Two-stage inference**:
   - Stage A: choose **Level 1 subject** (often known from ingestion pipeline metadata; if not, classify).
   - Stage B: choose **(L2, L3)** from the subject’s taxonomy, returning:
     - `primary_tag` (exactly one L3)
     - `secondary_tags` (0–2 L3 tags)
     - `confidence` + `rationale_evidence` (short text spans or visual cues)

3. **Add secondary dimensions** (recommended) in the same call to avoid re-reading the stimulus:
   - `competencia_oficial_*` (one value, usually)
   - `stimulus_type`
   - `reading_load`
   - `data_representation_required`
   - `calculation_load` (math/science)
   - `multi_step_reasoning`

This structure aligns with the way adaptive systems use content tags to drive analytics and sequencing. citeturn12search12turn12search16turn12search13

### Tags that are usually easy to infer (high precision)

These tags tend to have strong lexical/visual cues:

- **Matemáticas**: `probability_counting`, `functions_graphs`, `plane_geometry`, `ratios_proportions_percent`, `tables_graphs_interpretation` (graphs/tables), `equations_inequalities` (algebraic form). citeturn14view0turn5view2  
- **Ciencias Naturales**: `chemistry_component` (chemical symbols/reactions), `motion_forces_dynamics` (v, a, force diagrams), `waves_electromagnetism` (circuits), `inquiry_design` and `data_interpretation_conclusions` (explicit tables/graphs + “conclusión”). citeturn15view0turn15view1turn8view4  
- **Inglés**: `notices_instructions_signage` (sign-style tasks), grammar fill-in tasks; inferential reading questions have conventional phrasing (“It can be inferred…”). citeturn9view3  
- **Sociales y Ciudadanas**: `primary_secondary_sources` if the item shows a “document/photo/testimony excerpt,” and `state_branches_accountability` when branches/control bodies/mechanisms are named. citeturn7view1turn6view3  
- **Lectura Crítica**: question stems referencing “estructura del texto,” “voz,” “estrategia discursiva,” “contexto,” or “validez/implicaciones” are strong cues. citeturn18view0  

### Tags that are ambiguous (need guardrails)

Common ambiguity patterns and how to handle them:

- **Lectura Crítica**: LLMs often over-tag by **topic** (e.g., “about environment”) instead of **reading evidence** (voice, structure, validity). Your prompt should explicitly say: *“Ignore passage topic; tag the reading process demanded by the question.”* This matches ICFES’s evidence structure. citeturn18view0  
- **Matemáticas**: “Modelación de situaciones” vs “Ecuaciones e inecuaciones”  
  - Use **modeling** when the hard part is formulating (variables/model choice).  
  - Use **equations** when formulation is already given and solving is the focus. citeturn14view0turn4view0  
- **Ciencias Naturales**: items can blend physics + chemistry (energy, conservation) or bio + CTS. Use:  
  - Primary tag = the component whose concepts are necessary for the key step (ICFES lists typical concept families by component). citeturn15view0turn15view2  
- **Sociales y Ciudadanas**: “Derechos y ciudadanía” vs “Estado y participación”  
  - Use rights when the decision is about principles/rights; use state/participation when about institutions/mechanisms/branches. citeturn6view3turn10view0  
- **Inglés**: “Vocabulario en contexto” vs “Comprensión literal”  
  - If the choice depends on meaning of a single word/phrase, tag vocabulary; if it depends on a stated fact paraphrase, tag reading literal.

### Common failure modes in automated tagging

1. **Stimulus not included**: the model guesses based on the question stem; this is catastrophic for reading/English/social source items.  
2. **Topic leakage** in Lectura Crítica: tagging by subject matter rather than reading process.  
3. **Representation blindness**: math/science questions with diagrams get mis-tagged if the vision input isn’t passed or if diagrams are low quality.  
4. **Over-multi-tagging**: tagging 5+ subtopics per item makes analytics noisy and weakens mastery signals; research and practice emphasize that inconsistent tagging undermines the usefulness of learner models. citeturn12search9turn12search16  
5. **Granularity mismatch**: too-fine tags produce low inter-rater reliability even for humans (not just ML), which compounds errors when automated. citeturn12search11turn12search3  

### When a question should receive multiple subtopics

Use multiple L3 tags only when **two distinct subtopics are both necessary** (not merely present in the story). Recommended rule:
- Assign exactly **one primary L3** (70–100% responsibility)
- Assign **up to two secondary L3** (each 20–40% responsibility)

Examples:
- Math: a word problem requiring equation setup and then graph interpretation → primary `modeling_word_problems`, secondary `functions_graphs`. citeturn14view0  
- Science: a CTS prompt that requires interpreting a graph to conclude → primary `data_interpretation_conclusions`, secondary `environment_sustainability`. citeturn15view1turn15view2  
- Social: primary source excerpt + compare perspectives → primary `primary_secondary_sources`, secondary `actor_group_perspectives`. citeturn7view1turn6view3  

## Final machine-friendly JSON tag set

The JSON below is **implementation-ready**: Spanish labels + stable English slugs, with origin marking. It includes **V2 (expanded) full taxonomy** and a **V1 minimal subset** for initial launch.

```json
{
  "taxonomy_name": "saber11_question_taxonomy",
  "taxonomy_version": "2026-03-14",
  "levels": ["subject", "category", "subtopic"],
  "subjects": [
    {
      "id": "lectura_critica",
      "label_es": "Lectura Crítica",
      "slug_en": "critical_reading",
      "origin": "official",
      "categories": [
        {
          "id": "lectura_critica.literal_comprehension",
          "label_es": "Comprensión literal",
          "slug_en": "literal_comprehension",
          "origin": "derived",
          "subtopics": [
            {
              "id": "lectura_critica.literal_comprehension.word_phrase_meaning",
              "label_es": "Significado de palabras y expresiones",
              "slug_en": "word_phrase_meaning",
              "origin": "derived"
            },
            {
              "id": "lectura_critica.literal_comprehension.explicit_details",
              "label_es": "Hechos y detalles explícitos",
              "slug_en": "explicit_details",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "lectura_critica.structure_cohesion_multimodal",
          "label_es": "Estructura, cohesión y textos discontinuos",
          "slug_en": "structure_cohesion_multimodal",
          "origin": "derived",
          "subtopics": [
            {
              "id": "lectura_critica.structure_cohesion_multimodal.text_structure_parts",
              "label_es": "Estructura y función de partes",
              "slug_en": "text_structure_parts",
              "origin": "derived"
            },
            {
              "id": "lectura_critica.structure_cohesion_multimodal.logical_links_connectors",
              "label_es": "Relaciones lógicas y conectores",
              "slug_en": "logical_links_connectors",
              "origin": "derived"
            },
            {
              "id": "lectura_critica.structure_cohesion_multimodal.discontinuous_text_relations",
              "label_es": "Lectura de textos discontinuos",
              "slug_en": "discontinuous_text_relations",
              "origin": "official"
            }
          ]
        },
        {
          "id": "lectura_critica.voices_perspective",
          "label_es": "Voces y perspectiva",
          "slug_en": "voices_perspective",
          "origin": "derived",
          "subtopics": [
            {
              "id": "lectura_critica.voices_perspective.voices_speakers",
              "label_es": "Identificación de voces/enunciadores",
              "slug_en": "voices_speakers",
              "origin": "official"
            },
            {
              "id": "lectura_critica.voices_perspective.communicative_situation_pov",
              "label_es": "Situación comunicativa y punto de vista",
              "slug_en": "communicative_situation_pov",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "lectura_critica.ideas_arguments",
          "label_es": "Ideas y argumentación interna del texto",
          "slug_en": "ideas_arguments",
          "origin": "derived",
          "subtopics": [
            {
              "id": "lectura_critica.ideas_arguments.main_idea_theme",
              "label_es": "Idea principal y tema",
              "slug_en": "main_idea_theme",
              "origin": "derived"
            },
            {
              "id": "lectura_critica.ideas_arguments.claims_evidence_conclusions",
              "label_es": "Afirmaciones, evidencias y conclusiones",
              "slug_en": "claims_evidence_conclusions",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "lectura_critica.critical_evaluation",
          "label_es": "Evaluación crítica del contenido",
          "slug_en": "critical_evaluation",
          "origin": "derived",
          "subtopics": [
            {
              "id": "lectura_critica.critical_evaluation.validity_implications",
              "label_es": "Validez e implicaciones de enunciados",
              "slug_en": "validity_implications",
              "origin": "official"
            },
            {
              "id": "lectura_critica.critical_evaluation.evaluative_content_bias",
              "label_es": "Contenidos valorativos y sesgo",
              "slug_en": "evaluative_content_bias",
              "origin": "official"
            },
            {
              "id": "lectura_critica.critical_evaluation.discursive_rhetorical_strategies",
              "label_es": "Estrategias discursivas y retóricas",
              "slug_en": "discursive_rhetorical_strategies",
              "origin": "official"
            }
          ]
        },
        {
          "id": "lectura_critica.context_intertextuality",
          "label_es": "Contexto e intertextualidad",
          "slug_en": "context_intertextuality",
          "origin": "derived",
          "subtopics": [
            {
              "id": "lectura_critica.context_intertextuality.intertextual_links",
              "label_es": "Relaciones intertextuales",
              "slug_en": "intertextual_links",
              "origin": "official"
            },
            {
              "id": "lectura_critica.context_intertextuality.contextualization",
              "label_es": "Contextualización histórica/cultural/situacional",
              "slug_en": "contextualization",
              "origin": "official"
            }
          ]
        }
      ]
    },
    {
      "id": "matematicas",
      "label_es": "Matemáticas",
      "slug_en": "mathematics",
      "origin": "official",
      "categories": [
        {
          "id": "matematicas.number_proportionality",
          "label_es": "Número y proporcionalidad",
          "slug_en": "number_proportionality",
          "origin": "derived",
          "subtopics": [
            {
              "id": "matematicas.number_proportionality.ratios_proportions_percent",
              "label_es": "Razones, proporciones y porcentajes",
              "slug_en": "ratios_proportions_percent",
              "origin": "derived"
            },
            {
              "id": "matematicas.number_proportionality.numeric_operations_properties",
              "label_es": "Operaciones y propiedades numéricas",
              "slug_en": "numeric_operations_properties",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "matematicas.algebra_equations",
          "label_es": "Álgebra y ecuaciones",
          "slug_en": "algebra_equations",
          "origin": "derived",
          "subtopics": [
            {
              "id": "matematicas.algebra_equations.algebraic_expressions",
              "label_es": "Expresiones algebraicas",
              "slug_en": "algebraic_expressions",
              "origin": "derived"
            },
            {
              "id": "matematicas.algebra_equations.equations_inequalities",
              "label_es": "Ecuaciones e inecuaciones",
              "slug_en": "equations_inequalities",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "matematicas.functions_variation",
          "label_es": "Funciones y variación",
          "slug_en": "functions_variation",
          "origin": "derived",
          "subtopics": [
            {
              "id": "matematicas.functions_variation.functions_graphs",
              "label_es": "Funciones y gráficas",
              "slug_en": "functions_graphs",
              "origin": "derived"
            },
            {
              "id": "matematicas.functions_variation.rates_of_change",
              "label_es": "Tasas de cambio y variación",
              "slug_en": "rates_of_change",
              "origin": "derived"
            },
            {
              "id": "matematicas.functions_variation.patterns_sequences",
              "label_es": "Patrones y sucesiones",
              "slug_en": "patterns_sequences",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "matematicas.geometry_measurement",
          "label_es": "Geometría y medición",
          "slug_en": "geometry_measurement",
          "origin": "derived",
          "subtopics": [
            {
              "id": "matematicas.geometry_measurement.plane_geometry",
              "label_es": "Geometría plana",
              "slug_en": "plane_geometry",
              "origin": "derived"
            },
            {
              "id": "matematicas.geometry_measurement.perimeter_area_volume",
              "label_es": "Perímetro, área y volumen",
              "slug_en": "perimeter_area_volume",
              "origin": "derived"
            },
            {
              "id": "matematicas.geometry_measurement.coordinates_transformations",
              "label_es": "Coordenadas y transformaciones",
              "slug_en": "coordinates_transformations",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "matematicas.data_statistics_chance",
          "label_es": "Datos, estadística y azar",
          "slug_en": "data_statistics_chance",
          "origin": "derived",
          "subtopics": [
            {
              "id": "matematicas.data_statistics_chance.tables_graphs_interpretation",
              "label_es": "Interpretación de tablas y gráficas",
              "slug_en": "tables_graphs_interpretation",
              "origin": "derived"
            },
            {
              "id": "matematicas.data_statistics_chance.central_tendency_dispersion",
              "label_es": "Medidas de tendencia central y dispersión",
              "slug_en": "central_tendency_dispersion",
              "origin": "derived"
            },
            {
              "id": "matematicas.data_statistics_chance.probability_counting",
              "label_es": "Probabilidad y conteo",
              "slug_en": "probability_counting",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "matematicas.modeling_verification",
          "label_es": "Modelación y verificación",
          "slug_en": "modeling_verification",
          "origin": "product_specific",
          "subtopics": [
            {
              "id": "matematicas.modeling_verification.modeling_word_problems",
              "label_es": "Modelación de situaciones",
              "slug_en": "modeling_word_problems",
              "origin": "derived"
            },
            {
              "id": "matematicas.modeling_verification.argumentation_solution_validation",
              "label_es": "Argumentación y validación de soluciones",
              "slug_en": "argumentation_solution_validation",
              "origin": "derived"
            }
          ]
        }
      ]
    },
    {
      "id": "ciencias_naturales",
      "label_es": "Ciencias Naturales",
      "slug_en": "natural_sciences",
      "origin": "official",
      "categories": [
        {
          "id": "ciencias_naturales.biology_component",
          "label_es": "Componente biológico",
          "slug_en": "biology_component",
          "origin": "official",
          "subtopics": [
            {
              "id": "ciencias_naturales.biology_component.homeostasis_organism_function",
              "label_es": "Homeostasis y función en organismos",
              "slug_en": "homeostasis_organism_function",
              "origin": "derived"
            },
            {
              "id": "ciencias_naturales.biology_component.genetics_reproduction",
              "label_es": "Herencia, genética y reproducción",
              "slug_en": "genetics_reproduction",
              "origin": "derived"
            },
            {
              "id": "ciencias_naturales.biology_component.ecology_evolution_biodiversity",
              "label_es": "Ecología, evolución y biodiversidad",
              "slug_en": "ecology_evolution_biodiversity",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "ciencias_naturales.physics_component",
          "label_es": "Componente físico",
          "slug_en": "physics_component",
          "origin": "official",
          "subtopics": [
            {
              "id": "ciencias_naturales.physics_component.motion_forces_dynamics",
              "label_es": "Movimiento, fuerzas y dinámica",
              "slug_en": "motion_forces_dynamics",
              "origin": "derived"
            },
            {
              "id": "ciencias_naturales.physics_component.energy_heat_transformations",
              "label_es": "Energía, calor y transformaciones",
              "slug_en": "energy_heat_transformations",
              "origin": "derived"
            },
            {
              "id": "ciencias_naturales.physics_component.waves_electromagnetism",
              "label_es": "Ondas y electromagnetismo",
              "slug_en": "waves_electromagnetism",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "ciencias_naturales.chemistry_component",
          "label_es": "Componente químico",
          "slug_en": "chemistry_component",
          "origin": "official",
          "subtopics": [
            {
              "id": "ciencias_naturales.chemistry_component.matter_structure_properties",
              "label_es": "Estructura y propiedades de la materia",
              "slug_en": "matter_structure_properties",
              "origin": "derived"
            },
            {
              "id": "ciencias_naturales.chemistry_component.chemical_changes_reactions",
              "label_es": "Cambios químicos y reacciones",
              "slug_en": "chemical_changes_reactions",
              "origin": "derived"
            },
            {
              "id": "ciencias_naturales.chemistry_component.mixtures_solutions_gases",
              "label_es": "Mezclas, soluciones y gases",
              "slug_en": "mixtures_solutions_gases",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "ciencias_naturales.science_tech_society",
          "label_es": "Ciencia, tecnología y sociedad",
          "slug_en": "science_tech_society",
          "origin": "official",
          "subtopics": [
            {
              "id": "ciencias_naturales.science_tech_society.environment_sustainability",
              "label_es": "Ambiente y sostenibilidad",
              "slug_en": "environment_sustainability",
              "origin": "derived"
            },
            {
              "id": "ciencias_naturales.science_tech_society.sci_tech_impact_society",
              "label_es": "Impacto de la ciencia y la tecnología en la vida social",
              "slug_en": "sci_tech_impact_society",
              "origin": "official"
            }
          ]
        },
        {
          "id": "ciencias_naturales.scientific_skills",
          "label_es": "Habilidades científicas",
          "slug_en": "scientific_skills",
          "origin": "product_specific",
          "subtopics": [
            {
              "id": "ciencias_naturales.scientific_skills.inquiry_design",
              "label_es": "Indagación y diseño de procedimientos",
              "slug_en": "inquiry_design",
              "origin": "official"
            },
            {
              "id": "ciencias_naturales.scientific_skills.data_interpretation_conclusions",
              "label_es": "Interpretación de datos y conclusiones",
              "slug_en": "data_interpretation_conclusions",
              "origin": "official"
            }
          ]
        }
      ]
    },
    {
      "id": "sociales_ciudadanas",
      "label_es": "Sociales y Ciudadanas",
      "slug_en": "social_and_civic",
      "origin": "official",
      "categories": [
        {
          "id": "sociales_ciudadanas.history_temporality",
          "label_es": "Historia y temporalidades",
          "slug_en": "history_temporality",
          "origin": "derived",
          "subtopics": [
            {
              "id": "sociales_ciudadanas.history_temporality.periodization_change_continuity",
              "label_es": "Periodización, cambio y continuidad",
              "slug_en": "periodization_change_continuity",
              "origin": "derived"
            },
            {
              "id": "sociales_ciudadanas.history_temporality.historical_causality_consequences",
              "label_es": "Causalidad histórica y consecuencias",
              "slug_en": "historical_causality_consequences",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "sociales_ciudadanas.space_territory_environment",
          "label_es": "Espacio, territorio y ambiente",
          "slug_en": "space_territory_environment",
          "origin": "derived",
          "subtopics": [
            {
              "id": "sociales_ciudadanas.space_territory_environment.maps_territorial_organization",
              "label_es": "Lectura de mapas y organización territorial",
              "slug_en": "maps_territorial_organization",
              "origin": "derived"
            },
            {
              "id": "sociales_ciudadanas.space_territory_environment.environment_resources_territory_change",
              "label_es": "Ambiente, recursos y transformaciones del territorio",
              "slug_en": "environment_resources_territory_change",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "sociales_ciudadanas.economy_social_organization",
          "label_es": "Economía y organización social",
          "slug_en": "economy_social_organization",
          "origin": "derived",
          "subtopics": [
            {
              "id": "sociales_ciudadanas.economy_social_organization.basic_economic_concepts",
              "label_es": "Conceptos económicos básicos",
              "slug_en": "basic_economic_concepts",
              "origin": "derived"
            },
            {
              "id": "sociales_ciudadanas.economy_social_organization.social_structures_inequality",
              "label_es": "Estructuras sociales y desigualdad",
              "slug_en": "social_structures_inequality",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "sociales_ciudadanas.state_democracy_participation",
          "label_es": "Estado, democracia y participación",
          "slug_en": "state_democracy_participation",
          "origin": "derived",
          "subtopics": [
            {
              "id": "sociales_ciudadanas.state_democracy_participation.social_rule_of_law_constitution",
              "label_es": "Estado Social de Derecho y Constitución",
              "slug_en": "social_rule_of_law_constitution",
              "origin": "official"
            },
            {
              "id": "sociales_ciudadanas.state_democracy_participation.state_branches_accountability",
              "label_es": "Organización del Estado y control ciudadano",
              "slug_en": "state_branches_accountability",
              "origin": "official"
            }
          ]
        },
        {
          "id": "sociales_ciudadanas.rights_coexistence_conflict",
          "label_es": "Derechos, convivencia y conflicto",
          "slug_en": "rights_coexistence_conflict",
          "origin": "derived",
          "subtopics": [
            {
              "id": "sociales_ciudadanas.rights_coexistence_conflict.rights_citizenship",
              "label_es": "Derechos y ciudadanía",
              "slug_en": "rights_citizenship",
              "origin": "derived"
            },
            {
              "id": "sociales_ciudadanas.rights_coexistence_conflict.conflict_peace_coexistence",
              "label_es": "Conflicto, paz y convivencia",
              "slug_en": "conflict_peace_coexistence",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "sociales_ciudadanas.sources_perspectives_argumentation",
          "label_es": "Fuentes, perspectivas y argumentación social",
          "slug_en": "sources_perspectives_argumentation",
          "origin": "derived",
          "subtopics": [
            {
              "id": "sociales_ciudadanas.sources_perspectives_argumentation.primary_secondary_sources",
              "label_es": "Fuentes primarias y secundarias",
              "slug_en": "primary_secondary_sources",
              "origin": "official"
            },
            {
              "id": "sociales_ciudadanas.sources_perspectives_argumentation.actor_group_perspectives",
              "label_es": "Perspectivas de actores y grupos",
              "slug_en": "actor_group_perspectives",
              "origin": "official"
            },
            {
              "id": "sociales_ciudadanas.sources_perspectives_argumentation.arguments_evidence_analytic_stance",
              "label_es": "Argumentos, evidencia y toma de postura analítica",
              "slug_en": "arguments_evidence_analytic_stance",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "sociales_ciudadanas.systems_thinking_decisions",
          "label_es": "Pensamiento sistémico y decisiones",
          "slug_en": "systems_thinking_decisions",
          "origin": "derived",
          "subtopics": [
            {
              "id": "sociales_ciudadanas.systems_thinking_decisions.cross_dimension_relations",
              "label_es": "Relaciones entre dimensiones de un problema",
              "slug_en": "cross_dimension_relations",
              "origin": "official"
            },
            {
              "id": "sociales_ciudadanas.systems_thinking_decisions.intervention_effects_tradeoffs",
              "label_es": "Efectos de intervenciones y consecuencias no intencionales",
              "slug_en": "intervention_effects_tradeoffs",
              "origin": "official"
            }
          ]
        }
      ]
    },
    {
      "id": "ingles",
      "label_es": "Inglés",
      "slug_en": "english",
      "origin": "official",
      "categories": [
        {
          "id": "ingles.lexis",
          "label_es": "Léxico",
          "slug_en": "lexis",
          "origin": "derived",
          "subtopics": [
            {
              "id": "ingles.lexis.vocab_definitions",
              "label_es": "Vocabulario y definiciones",
              "slug_en": "vocab_definitions",
              "origin": "derived"
            },
            {
              "id": "ingles.lexis.vocab_in_context",
              "label_es": "Vocabulario en contexto",
              "slug_en": "vocab_in_context",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "ingles.grammar_language_use",
          "label_es": "Gramática y uso del lenguaje",
          "slug_en": "grammar_language_use",
          "origin": "derived",
          "subtopics": [
            {
              "id": "ingles.grammar_language_use.sentence_structure_agreement",
              "label_es": "Estructura de oración y concordancia",
              "slug_en": "sentence_structure_agreement",
              "origin": "derived"
            },
            {
              "id": "ingles.grammar_language_use.verb_tenses_forms",
              "label_es": "Tiempos verbales y formas verbales",
              "slug_en": "verb_tenses_forms",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "ingles.pragmatics_functions",
          "label_es": "Pragmática y funciones comunicativas",
          "slug_en": "pragmatics_functions",
          "origin": "derived",
          "subtopics": [
            {
              "id": "ingles.pragmatics_functions.notices_instructions_signage",
              "label_es": "Avisos, instrucciones y señalética",
              "slug_en": "notices_instructions_signage",
              "origin": "derived"
            },
            {
              "id": "ingles.pragmatics_functions.communicative_intent_messages",
              "label_es": "Intención comunicativa en mensajes",
              "slug_en": "communicative_intent_messages",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "ingles.reading_literal",
          "label_es": "Comprensión lectora literal",
          "slug_en": "reading_literal",
          "origin": "derived",
          "subtopics": [
            {
              "id": "ingles.reading_literal.explicit_info_paraphrase",
              "label_es": "Información explícita y parafraseo",
              "slug_en": "explicit_info_paraphrase",
              "origin": "derived"
            },
            {
              "id": "ingles.reading_literal.references_basic_cohesion",
              "label_es": "Referencias y cohesión básica",
              "slug_en": "references_basic_cohesion",
              "origin": "derived"
            }
          ]
        },
        {
          "id": "ingles.reading_inferential",
          "label_es": "Comprensión lectora inferencial",
          "slug_en": "reading_inferential",
          "origin": "derived",
          "subtopics": [
            {
              "id": "ingles.reading_inferential.main_idea_purpose",
              "label_es": "Idea principal y propósito del texto",
              "slug_en": "main_idea_purpose",
              "origin": "derived"
            },
            {
              "id": "ingles.reading_inferential.inferences_conclusions",
              "label_es": "Inferencias y conclusiones",
              "slug_en": "inferences_conclusions",
              "origin": "derived"
            }
          ]
        }
      ]
    }
  ],
  "recommended_releases": {
    "v1_minimal": {
      "description": "Minimal set to launch: prioritizes high-signal subtopics and reduces ambiguity; keep full L1 and L2 structure but use fewer L3 tags initially.",
      "included_subtopic_ids": [
        "lectura_critica.literal_comprehension.word_phrase_meaning",
        "lectura_critica.literal_comprehension.explicit_details",
        "lectura_critica.structure_cohesion_multimodal.text_structure_parts",
        "lectura_critica.structure_cohesion_multimodal.logical_links_connectors",
        "lectura_critica.voices_perspective.voices_speakers",
        "lectura_critica.critical_evaluation.validity_implications",
        "lectura_critica.critical_evaluation.evaluative_content_bias",
        "lectura_critica.context_intertextuality.contextualization",

        "matematicas.number_proportionality.ratios_proportions_percent",
        "matematicas.algebra_equations.equations_inequalities",
        "matematicas.functions_variation.functions_graphs",
        "matematicas.geometry_measurement.plane_geometry",
        "matematicas.geometry_measurement.perimeter_area_volume",
        "matematicas.data_statistics_chance.tables_graphs_interpretation",
        "matematicas.data_statistics_chance.probability_counting",
        "matematicas.modeling_verification.modeling_word_problems",

        "ciencias_naturales.biology_component.ecology_evolution_biodiversity",
        "ciencias_naturales.physics_component.motion_forces_dynamics",
        "ciencias_naturales.physics_component.energy_heat_transformations",
        "ciencias_naturales.chemistry_component.chemical_changes_reactions",
        "ciencias_naturales.science_tech_society.environment_sustainability",
        "ciencias_naturales.scientific_skills.data_interpretation_conclusions",

        "sociales_ciudadanas.state_democracy_participation.social_rule_of_law_constitution",
        "sociales_ciudadanas.state_democracy_participation.state_branches_accountability",
        "sociales_ciudadanas.sources_perspectives_argumentation.primary_secondary_sources",
        "sociales_ciudadanas.sources_perspectives_argumentation.actor_group_perspectives",
        "sociales_ciudadanas.systems_thinking_decisions.cross_dimension_relations",
        "sociales_ciudadanas.history_temporality.historical_causality_consequences",

        "ingles.lexis.vocab_definitions",
        "ingles.grammar_language_use.verb_tenses_forms",
        "ingles.pragmatics_functions.notices_instructions_signage",
        "ingles.reading_literal.explicit_info_paraphrase",
        "ingles.reading_inferential.inferences_conclusions"
      ]
    },
    "v2_expanded": {
      "description": "Full taxonomy as defined in this JSON (all L3 nodes).",
      "included_subtopic_ids": "ALL"
    }
  },
  "secondary_dimensions": {
    "competencia_oficial": {
      "description": "Single-select tags that preserve official ICFES competency reporting; not part of the 3-level taxonomy.",
      "values": {
        "matematicas": ["interpretacion_representacion", "formulacion_ejecucion", "argumentacion"],
        "sociales_ciudadanas": ["pensamiento_social", "analisis_perspectivas", "pensamiento_reflexivo_sistemico"],
        "ciencias_naturales": ["uso_comprensivo", "explicacion_fenomenos", "indagacion"],
        "lectura_critica": ["afirmacion_1_local", "afirmacion_2_global", "afirmacion_3_critica"],
        "ingles": ["linguistica", "pragmatica", "sociolinguistica"]
      }
    },
    "stimulus_type": {
      "description": "Multi-select. Useful for recommendations and error diagnosis across subjects.",
      "values": [
        "texto_continuo",
        "texto_discontinuo",
        "texto_mixto",
        "tabla",
        "grafica",
        "diagrama_geometrico",
        "mapa",
        "caricatura_comic",
        "experimento_descripcion",
        "fuente_primaria_excerpt",
        "fuente_secundaria_excerpt",
        "aviso_sign_notice",
        "dialogo",
        "articulo"
      ]
    },
    "reading_load": {
      "description": "Single-select. Approximate based on word count + syntactic complexity.",
      "values": ["baja", "media", "alta"]
    },
    "calculation_load": {
      "description": "Single-select for Math/Science. Captures arithmetic burden separate from concept difficulty.",
      "values": ["baja", "media", "alta"]
    },
    "multi_step_reasoning": {
      "description": "Single-select. Indicates if >1 inferential step is needed.",
      "values": ["uno", "dos_o_mas"]
    },
    "cefr_band": {
      "description": "English-only, derived. Optional coarse placement for sequencing; refine with response data.",
      "values": ["pre_a1", "a1", "a2", "b1_o_mas"]
    }
  }
}
```

**Recommended minimal taxonomy for V1**  
Launch with the **V1 subset** defined above (roughly 30–35 high-signal L3 tags across all subjects). The goal is to maximize early tagging accuracy, stabilize analytics, and avoid brittle distinctions (especially in Lectura Crítica and Sociales). Then use real student-response data to identify where additional granularity produces distinct learning curves and actionable recommendations—an established approach in KC model refinement. citeturn12search4turn12search12  

**Expanded taxonomy for V2**  
Adopt the **full V2 taxonomy** (all L3 nodes defined) once you have:
- a validated tagging prompt + evaluation set,
- enough item volume per tag to support diagnostics (avoid sparse nodes),
- and initial mastery analytics that show stable separation by subtopic (not noise).

If you later want interoperability with external competency frameworks, consider representing your taxonomy in a machine-readable competency standard (e.g., CASE-style structure), but only after V1 proves operationally stable. citeturn12search6turn12search2  

**Risks and unresolved decisions**  
1. **Competency-in-taxonomy vs competency-as-secondary**: This report recommends keeping official competencies as secondary tags to avoid cross-product blowup, but you may prefer competency-first reporting; decide based on how strongly you want “Saber-like” dashboards. citeturn4view0turn18view0turn12search16  
2. **Multi-question stimuli**: If your ingestion pipeline splits questions from shared passages without reliably linking the full stimulus, auto-tagging will be noisy (especially Lectura/English/Social). citeturn13view1turn9view3  
3. **Image fidelity from scanned PDFs**: low-resolution diagrams can cause systematic mis-tagging in geometry/science; you may need preprocessing (cropping/contrast) and a fallback human review queue.  
4. **Tag sparsity**: some subtopics may be underrepresented in your current bank (depending on which booklets you ingested). Sparse tags degrade diagnostics and recommendations; you may need to merge or postpone them. citeturn12search12  
5. **Consistency drift over time**: as new content sources are ingested, tag boundary drift is likely unless you enforce a “tagging playbook” and periodic audits; inconsistent skill tagging is a documented failure mode in real systems. citeturn12search9  
6. **Difficulty estimation**: ICFES difficulty is psychometrically calibrated; your platform should treat “difficulty” as a learned property from response data, not only an LLM guess. Use LLM difficulty only as a cold-start prior. citeturn12search13turn12search16
