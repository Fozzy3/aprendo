# Análisis pedagógico y de producto (ICFES Saber 11)

Fecha: 2026-10-28. Mirada de experto en educación y en el Saber 11 sobre la
experiencia del estudiante, tal como está en el código. Las rutas de archivo son
la evidencia, no suposiciones.

## Veredicto

La base pedagógica es **mejor que la de la mayoría de apps de preparación**:
niveles en el idioma del ICFES, evidencia mínima antes de dar un nivel,
calificación de confianza, dificultad adaptativa y simulacros con la
distribución real. El problema no es que falte ciencia, sino que **sobran
caminos y faltan cierres**:

- se puede empezar a practicar desde 9 lugares;
- "tu punto más débil" se calcula de 5 formas distintas;
- la práctica normal corrige al final, como si fuera un examen;
- una sesión de práctica termina sin decirle al estudiante qué mejoró.

Hay que **quitar más que agregar**.

## Lo que está bien y hay que cuidar

| Qué | Por qué funciona | Dónde |
|---|---|---|
| Niveles 1–4 y A-/A1/A2/B1 con puntos de corte del ICFES | Habla el idioma del colegio y del examen | `docs/levels.v1.json` |
| No dar nivel con menos de 12 respuestas | Evita diagnósticos falsos con poca evidencia | `levels.v1.json` evidence.minAttempts |
| Confianza: Seguro / Dudé / Adiviné | Metacognición. Un error cometido "seguro" se corrige mejor cuando se explica (efecto de hipercorrección) | `lib/confidence-display.ts` |
| Repaso que prioriza errores de concepto | Va a donde más rinde la práctica de recuperación | `sessions.ts:438-505` |
| Selección adaptativa hacia ~70 % de acierto (Elo) | Dificultad deseable: ni aburre ni frustra | `adaptive.ts` |
| Reto intercalado (3 subtemas mezclados) | La práctica intercalada mejora la transferencia | `sessionKinds.ts` |
| Resolver separado de revisar; sin tutor en examen | Mide de verdad y luego enseña | ADR 0001 |
| Preguntas con texto compartido como grupo | Así viene el examen real | PRODUCT_SPEC 4e |
| Simulacro con 2 sesiones, 4h30 y sin calculadora | Ensaya las condiciones reales | `sessionKinds.ts` |
| Puntaje global con la fórmula oficial (3,3,3,3,1)/13×5 y banda de error | Es honesto | `globalScore.ts` |

## Problemas, en orden de impacto

### 1. La práctica corrige al final (el más importante)

Toda práctica lanzada desde Hoy, Ruta, Temario, la lección o los informes
corrige **al final** (`feedbackMode` queda en `al_final`). La corrección
inmediata solo se puede elegir en "Arma tu práctica" (`PracticeBuilder.tsx:212-230`).

Para un estudiante que está **aprendiendo** un tema (no midiéndose), la
retroalimentación inmediata y explicada rinde más que la diferida. Lo que
importa es que vea por qué su opción parecía correcta justo cuando la eligió.
La corrección al final es para medir: nivelación, simulacro, reto.

**Cambio:** `topic`, `recommended` y `repaso` con corrección inmediata por
defecto. Es un valor por defecto en `sessionKinds.ts`, no una función nueva.

### 2. El tutor no existe mientras se practica

`tutorInSolve` es `false` para todas las sesiones. El tutor solo aparece en la
revisión, cuando el estudiante ya se rindió o ya terminó. El PRODUCT_SPEC pedía
pistas durante la práctica.

Ahora el tutor es socrático y nunca da la respuesta antes de que el estudiante
conteste (`tutor.ts`). Encenderlo en `topic`, `recommended` y `repaso` es
seguro y es donde más enseña.

**Costo:** más mensajes contra el cupo diario (80 o 150). Conviene registrar
`usedTutor`, que hoy siempre se guarda en `false` (`sessions.ts:1248, 1396`).

### 3. Demasiados caminos, cinco definiciones de "débil"

- **Un subtema se puede practicar desde 9 lugares:** el plan de Hoy, Ruta,
  Temario, la lección, el resultado de la nivelación, el informe del simulacro,
  Progreso, el centro de práctica y el constructor.
- **"Lo más débil" se calcula de 5 formas:**
  - el Foco de Hoy usa el `masteryScore` de la materia;
  - el plan usa peso × margen × (1 − dominio);
  - Progreso usa el `masteryScore` del subtema;
  - Ruta usa el orden del temario con candado;
  - el puntaje global usa peso × margen.

Por eso el plan puede recomendar un subtema que Ruta muestra con candado. Un
estudiante de 16 años con poco tiempo necesita **una** respuesta a "¿qué hago
ahora?", no cinco.

**Cambio:** una sola función de "siguiente mejor subtema" (la del plan, que es
la mejor porque pondera por el peso ICFES), usada en todas partes. Hoy es el
único lugar que decide. Los demás solo muestran el mapa.

### 4. Una sesión de práctica termina sin cierre

La nivelación y el simulacro abren una pantalla de resultado. La práctica, el
repaso y el reto no tienen resumen ni muestran cambios de dominio. El
estudiante no ve que avanzó, y ver el avance es lo que sostiene la motivación
semanas antes del examen.

**Cambio:** una franja de 2–3 líneas al terminar, antes de la revisión:
"Proporciones: Intentado → Familiar · 7 de 10 · Siguiente: Funciones lineales".
Los datos ya existen (`mastery.ts`).

### 5. El repaso no es espaciado y repite la misma pregunta

Una pregunta fallada vuelve de inmediato y sin intervalos; las acertadas nunca
vuelven. Y vuelve **la misma pregunta**, cuya respuesta el estudiante ya vio en
la revisión: acertarla mide memoria de la clave, no comprensión. El ICFES nunca
repite ítems.

**Cambio, en dos pasos:**

1. El repaso trae una pregunta **hermana** sin ver del mismo subtema y
   competencia. La original queda solo como respaldo.
2. Intervalos simples tipo Leitner (1, 3, 7 y 21 días) con un `nextDueAt` por
   subtema.

El espaciado es de los efectos más sólidos de la psicología del aprendizaje y
hoy no está.

### 6. El temario no habla en competencias del ICFES

El ICFES reporta por **competencias**, y así leen los informes los rectores y
coordinadores:

- **Matemáticas:** Interpretación y representación; Formulación y ejecución;
  Argumentación.
- **Ciencias:** Uso comprensivo del conocimiento; Explicación de fenómenos;
  Indagación.
- **Sociales:** Pensamiento social; Interpretación y análisis de perspectivas;
  Pensamiento reflexivo y sistémico.
- **Lectura Crítica:** sus 3 afirmaciones.

La dimensión `competencia_oficial` ya se guarda en cada pregunta
(`pdfPipeline.ts`), pero **nadie la lee**: el informe del docente llamado
"competencias" es en realidad por subtema (`teacher.ts:175`).

**Cambio:** mostrar el desempeño por competencia en el informe del simulacro y
en el panel docente. Para la venta a colegios (B2B) esto vale más que cualquier
función nueva, porque es el idioma del Informe por Colegio del ICFES.

### 7. El número que más le importa al estudiante llega tarde

El puntaje global (0–500) solo aparece con las 5 áreas y 12 respuestas en cada
una: unas 75 preguntas y hasta 150 minutos de nivelación. Muchos nunca lo verán.

El cálculo de la banda del 95 % ya existe. **Cambio:** mostrar desde la primera
área un rango provisional ("hoy estarías entre 230 y 330") que se estrecha con
cada área. Es honesto porque la banda dice la incertidumbre, y le da al
estudiante una meta desde el día uno.

### 8. Ruta bloquea en un orden que el examen no tiene

Ruta abre un subtema solo cuando el anterior llega a Familiar
(`lib/mastery-display.ts:60-79`). En Lectura Crítica o Sociales los subtemas no
son prerrequisitos unos de otros: el candado frena sin razón pedagógica, y
además Ruta siempre abre en Lectura Crítica (`LearningPathPage.tsx:22`).

**Cambio:** quitar los candados y dejar la marca de "recomendado". Ruta debe
abrir en el área del Foco.

### 9. Falta estrategia de examen

El prompt de las lecciones prohíbe a propósito los consejos de formato de
examen, y está bien que las lecciones enseñen conceptos. Pero nadie enseña la
estrategia del Saber 11, que sube puntos sin saber más:

- no hay penalización por error, así que hay que responder todo;
- unos 2 minutos y cuarto por pregunta;
- en Lectura Crítica, leer primero el enunciado;
- en los bloques de texto compartido, administrar el tiempo por bloque.

**Cambio:** 5 tarjetas fijas, una por área, escritas por una persona y no por la
IA, enlazadas desde la intro del simulacro.

### 10. Errores y cabos sueltos verificados

- **"Desde tu nivelación" no aparece** para quien solo tiene nivelaciones: la
  línea base de Progreso lee solo el `diagnostic` antiguo (`progress.ts:288-296`).
  Es un bug.
- **Las penalizaciones de `masteryScore` por pista y por tutor no hacen nada**:
  siempre llegan en `false`.
- **Hay dos sistemas de dominio a la vez** (`masteryScore` 0–1 y `masteryLevel`
  tipo Khan), y "Dominado" significa dos cosas: un nivel de dominio y un estado
  de confianza.
- **La tarjeta de Repaso** promete "10 preguntas" y falla cuando no hay nada
  pendiente.
- **La comparación nacional** se calcula (`buildNationalComparison`) y no se
  muestra.

## Qué quitar

1. **Temario como pantalla aparte.** Ruta y Temario son dos mapas del mismo
   temario. Basta una sola pantalla: Ruta, con un "ver todo".
2. **"Tus sesiones" en el centro de práctica:** duplica Historial. Basta un
   enlace.
3. **El botón "Día de examen completo"**, que hace exactamente lo mismo que
   "Sesión 1" (`practice.tsx:~339-376`).
4. **Una de las dos metas semanales** (5 días o 180 minutos). Hay que quedarse
   con los minutos, porque miden esfuerzo y no solo asistencia.
5. **El selector de dificultad del constructor.** Un estudiante que elige "fácil"
   se lleva una ilusión de dominio, y el Elo ya ajusta la dificultad solo.
6. **La pestaña "Diagnóstico" antigua en Historial.** Los datos se conservan; la
   pestaña no.
7. **El `masteryScore` como cifra visible.** Se muestra un solo dominio, el de
   niveles Khan, y la palabra "Dominado" queda solo para él. La confianza pasa a
   decir, por ejemplo, "Seguro y bien".
8. **Hoy más liviano.** Hoy tiene entre 8 y 12 botones. Debe quedar con:
   - la cuenta regresiva;
   - una acción principal;
   - el plan;
   - la racha.

   La tarjeta de tiempo de estudio y la brecha de puntaje se van a Progreso.
9. ~~**La comparación nacional:** se borra o se muestra.~~ **Corregido en
   F30:** no estaba muerta. Tenía cifras verificadas del ICFES y se perdió en el
   rediseño de las gráficas, así que se restauró.

## Qué agregar (poco y en este orden)

| # | Cambio | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | Corrección inmediata por defecto en la práctica | Alto | Muy bajo (un valor por defecto) |
| 2 | Tutor socrático durante la práctica + registrar `usedTutor` | Alto | Bajo |
| 3 | Cierre de sesión con cambio de dominio y siguiente paso | Alto | Bajo |
| 4 | Una sola función de "siguiente subtema" en todas partes | Alto | Medio |
| 5 | Arreglar la línea base de Progreso con la nivelación | Medio | Bajo |
| 6 | Rango provisional del puntaje global desde la primera área | Medio | Bajo |
| 7 | Repaso con pregunta hermana y luego con intervalos | Alto | Medio |
| 8 | Competencias ICFES en el informe del simulacro y el panel docente | Alto (B2B) | Medio |
| 9 | Tarjetas de estrategia por área | Medio | Bajo |
| 10 | Meta de carrera (`plans/meta-carrera.md`, ya diseñada) | Medio | Medio |
| 11 | Tutor por voz (`plans/tutor-voz.md`) | Por medir | Fase 0: 1 día |

## Sobre la promesa del onboarding

La bienvenida (`components/Welcome.tsx`) dice lo que el estudiante va a
**lograr** (saber dónde está, subir en sus puntos débiles, llegar entrenado),
pero no garantiza puntos. Una garantía de mejora es una promesa comercial que el
producto no controla. Si se quiere una garantía real, debe ir atada a un uso
mínimo medible ("si completas X sesiones y no subes, …") y es una decisión de
negocio.
