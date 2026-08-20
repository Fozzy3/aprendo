# Plan — Rediseño de producto de Aprendo

> Plataforma de preparación ICFES Saber 11.
> Este archivo es el **tracker vivo** del rediseño: fases, checklist, decisiones y aprendizajes.
> Reframe central: de **"banco de preguntas + chat de IA"** → **"compañero de estudio guiado"**.
> Las preguntas son *evidencia*; la IA es el *motor de enseñanza*; la taxonomía es la *superficie de navegación*.

## Cómo se trabaja (loop por tarea)
1. Plan (este archivo) → 2. Tomar una tarea → 3. Completarla → 4. Limpiar con `/improve-architecture` →
5. Documentar aprendizajes aquí → 6. Marcar la tarea ✅ y volver a (3).

- Idioma del producto y de la comunicación: **español** (con acentos).
- UI con la skill `frontend-design`, **respetando el sistema de diseño existente** (no introducir fuentes/colores genéricos).
- El usuario corre `bun run dev` (no iniciar el server). Docs de Convex: https://docs.convex.dev
- Libertad para breaking changes y rediseño de arquitectura. Rama nueva antes de commitear; commits solo si el usuario lo pide.

## North star
Aprendo debe sentirse como un **tutor personal** que: (a) sabe qué dominar para el ICFES, (b) te dice qué estudiar hoy,
(c) te *enseña* el concepto, (d) te hace practicar, (e) mide si avanzas.

## Nueva arquitectura de información
```
Aprendo
 └ Hoy        ← home: plan del día + racha + repaso pendiente + coach semanal
 └ Ruta       ← camino de nodos por área hacia el siguiente nivel ICFES
    └ Temario ← sílabo ICFES completo (materias→categorías→subtemas) + lecciones
 └ Práctica   ← recomendada · por tema · repaso · simulacro (completo o por área)
 └ Progreso   ← mejora vs nivelación + nivel ICFES por área
    └ Historial ← calendario de estudio + todas las sesiones
```
> Nav = 4 ítems, 6 secciones: Temario cuelga de Ruta y el Historial de Progreso.
> Entrada a la app: **Nivelación por área** (`/diagnostic`), no el diagnóstico único de 20 preguntas.

---

## Fases y checklist

### Fase 1 — Temario navegable  🔥 (máximo ROI, menor esfuerzo)  · estado: ✅ completada
Convertir `docs/taxonomy.v1.json` en un mapa explorable: materias → categorías → subtemas,
mostrando dominio (`learnerSubtopicAggregates`), si hay lección, y nº de preguntas disponibles
(`questions` por subtema+elegibilidad). Lanzar práctica por subtema desde aquí.

- [x] Query Convex `getSyllabus(studentId)` — `packages/convex/src/syllabus.ts`. Une taxonomía + conteos + dominio.
- [x] Añadir `Temario` a la nav (`StudentAppShell.tsx`) — `StudentSection` ahora incluye `syllabus`.
- [x] Práctica filtrada por **subtema**: `topic` acepta `subtopicId` opcional (`createSession`/`buildSelection`/`selectTopic`), persistido en `sessions.subtopicId`.
- [x] Ruta `/syllabus` (label "Temario") con `SyllabusPage.tsx` — selector de materia, panel categoría→subtema, barras de dominio, chips de estado, botón Practicar.
- [x] Estados: dominado / en progreso / a reforzar / sin practicar / sin preguntas (`lib/syllabus-status.ts`).
- [x] Tema claro + oscuro; `fade-in`; reusa tokens y `RingProgress` (extraído a componente compartido).
- [x] `/improve-architecture` (módulo `questionPool.ts` + tipos inferidos) + specs actualizados + aprendizajes abajo.

### Fase 2 — Pantalla "Hoy"  · estado: ✅ completada
Home con plan del día + racha + continuar donde quedaste. Reemplaza el redirect actual de `/app`.
**NOTA:** la cuenta regresiva al examen y el campo `examDate` quedan FUERA por ahora (decisión del usuario).

- [x] "Plan de Hoy" = CTA de práctica recomendada (reusa el kind `recommended`) + foco de la semana + continuar.
- [x] Racha derivada de `questionAttempts` por día (zona horaria Colombia, UTC-5) — `packages/convex/src/today.ts`.
- [x] Ruta `/today` (label "Hoy") + `TodayPage.tsx`. `defaultRoute` ahora es `/today` (students.ts), así `/app` aterriza en Hoy.
- [x] `/improve-architecture`: hook `useStudentGuard` + `FullScreenLoader` (de-duplica el gate de 3 rutas) + documentar + ✅.

### Fase 3 — Lecciones IA por concepto  · estado: ✅ completada
Micro-explicación + demo interactiva + errores comunes, cacheadas por subtema. Generación bajo demanda.

- [x] Tabla nueva `conceptLessons` (cache global por `subtopicId`: secciones markdown + demo HTML opcional + estados/versión).
- [x] Generación IA **bajo demanda** sin `@convex-dev/agent`: query reactiva `getConceptLesson` → mutation `requestConceptLesson` (reclamo atómico/OCC, anti-doble-generación, timeout de lock) → `scheduler` → `internalAction generateConceptLesson` (AI SDK `generateObject`) → `internalMutation markReady/markFailed`. Módulo `packages/convex/src/lessons.ts`.
- [x] Página de concepto `/lesson/$subtopicId` (`LessonPage.tsx`): secciones con `MarkdownBlock` (KaTeX), demo en iframe sandbox, errores como tarjetas, CTA "Practicar este tema" (reusa `createSession topic+subtopicId`), estados generando/failed+reintentar.
- [x] `hasLesson` encendido en `getSyllabus` (scan `by_status==ready`); enlace + chip "Lección" en cada subtema del Temario.
- [x] `/improve-architecture`: extraído `packages/convex/src/taxonomy.ts` (lookups compartidos) consumido por `sessions.ts`, `lessons.ts` y `tutor.ts` (eliminados sus mapas locales de label) + specs + ✅.
- [x] CTA "Repasar este concepto" en el Review: enlace por pregunta a `/lesson/$subtopicId` del subtema, tras la explicación (`practice.$sessionId.review.tsx`).

### Fase 4 — Repaso espaciado + resumen semanal del coach  · estado: ✅ completada
- [x] **Repaso espaciado:** nuevo kind `repaso` (estrategia `review_mistakes`) que resurfacea preguntas cuyo último intento fue incorrecto, más antiguas primero. Query `getReviewQueue` (conteo de pendientes). Surface en "Hoy" (tarjeta "Repaso de errores: N") y en el hub de práctica.
- [x] **Resumen semanal del coach:** módulo `packages/convex/src/coach.ts` (tabla `coachSummaries` por `(studentId, weekIndex)`), generación bajo demanda (mismo patrón que lecciones) con `generateText`, surface en "Hoy" como tarjeta "Tu semana". Solo se genera si hubo actividad esa semana.
- [x] `/improve-architecture`: reusó el patrón generar-y-cachear y los helpers de taxonomía; sin nueva duplicación.

### Fase 5 — Generación de preguntas similares por IA  · estado: ✅ completada
- [x] Generación bajo demanda por subtema: action `generateSubtopicQuestions` (`packages/convex/src/generatedQuestions.ts`) con `generateObject` (MCQ A-D + respuesta + solución).
- [x] **No invasivo:** las preguntas se insertan en la tabla `questions` existente con `eligibility: 'practice_only'`, atadas a un `pdfUploads` sintético (slug `ai-generated`) → fluyen por toda la maquinaria (selección, conteos del Temario, sesiones, review) sin tocar el schema central.
- [x] Disparador: botón "Generar más práctica con IA" en la página de lección (`LessonPage`, `useAction`).

### Fase 6 — Identidad visual juvenil  · estado: ✅ completada
Rediseño total de la identidad: de crema+coral editorial a violeta+dorado tipo Duolingo/Brilliant.
Estrategia: **re-tokenizar, no re-maquetar** — casi todas las ~200 clases ya consumían variables.

- [x] Paleta nueva en `styles.css`: `--brand #6c4cf1`, `--gold #ffc93c`, `--success #21c08b`, `--danger #ff5d5d`,
      `--subject-*` por área ICFES. `--accent` queda como **alias de `--brand`** para no tocar las clases viejas.
- [x] Tipografía: Bricolage Grotesque (display) + Hanken Grotesk (body), vía el mismo `@import` de Google Fonts.
      (El body arrancó como Plus Jakarta Sans; cambiado en la Fase 12.)
- [x] **Bloque oscuro consolidado**: eliminada la copia duplicada dentro de `@media (prefers-color-scheme: dark)`;
      ahora `:root.dark, :root[data-theme="dark"]` cubre todos los casos (el tema resuelto siempre va como clase).
- [x] Puente `@theme` con los tokens `--color-*` de shadcn: `components/ui/*` deja de estar inerte.
- [x] Forma "presionable": `--shadow-hard` / `--shadow-hard-sm` + contorno 2px en `.btn-primary`, `.option-card`
      y `.launch-card`, con `translateY(2px)` en `:active`. Guard global de `prefers-reduced-motion`.
- [x] Eliminados los 7 literales coral que quedaban (`.btn-primary`, `.option-card.is-incorrect`,
      `.student-shell`/`.diagnostic-shell`, `.tutor-fab`) → `color-mix` sobre tokens.
- [x] `lib/subject-theme.ts` (nuevo) — color + emoji por área, sobre los tokens `--subject-*`.
- [x] `components/BrandMark.tsx` (nuevo) — el SVG del logo estaba copiado a mano en 5 archivos.
- [x] `lib/demo-document.ts` + `DEMO_FRAGMENT_RULES` de `lessons.ts` actualizados a la paleta/fuentes nuevas;
      `PROMPT_VERSION` → `v5` para que `decideClaim` regenere las demos cacheadas.

**Aprendizajes / decisiones**
- **`--accent` como alias de `--brand`** fue la decisión clave: el rediseño llega a ~200 clases sin editarlas.
  Si algún día se quiere separar marca de acento, es un rename mecánico.
- **Bug latente que destapó el cambio de paleta:** `.option-card.is-incorrect` se pintaba con el acento, y se
  leía como "rojo" **solo porque la marca era coral**. Con marca violeta habría marcado los errores en violeta.
  Ahora usa `--danger`. Lección: los tokens semánticos (error/acierto) nunca deben colgar del token de marca.
- **El `@media (prefers-color-scheme: dark)` era redundante**, no un fallback necesario: el script bloqueante de
  `__root.tsx` escribe la clase del tema resuelto antes del primer paint, también en modo `auto`.
- **La capa shadcn estaba inerte** (26 componentes escritos contra `--color-primary` y compañía, tokens que no
  existían; solo 3 se usaban). El puente `@theme` la habilita entera — usarla en las fases siguientes en vez de
  seguir engordando `styles.css`, que ya va por 3100 líneas.
- **Nav sin salto:** `.student-topnav-item` lleva `border: 2px solid transparent` para reservar el sitio del
  contorno que añade `.is-active`; sin eso la barra daba un salto de 4px al cambiar de pestaña.
- **Verificación:** convex tsc exit 0; web solo los 11 errores preexistentes de `ai-elements/*` (cero nuevos);
  tests 4 tareas (convex 7, ingest 4, web 2).
- **Resuelto en la Fase 12:** Plus Jakarta Sans estaba sobreexpuesta → Hanken Grotesk.

### Fase 7 — Historial de estudio  · estado: ✅ completada
- [x] `packages/convex/src/history.ts`: `getActivitySummary` (calendario + totales de siempre en **una** pasada
      sobre los attempts — separarlo en dos queries duplicaba el barrido) y `listHistory` (**paginada** sobre
      `by_studentId_startedAt`, incluye `diagnostic`/`nivelacion`/`simulacro`, a diferencia de `listSessions`).
- [x] `colombiaDayStartMs` añadido a `colombiaTime.ts` (junto a `colombiaWeekStartMs`), no reimplementado.
- [x] Ruta `/history` + `HistoryPage.tsx`: heatmap de 16 semanas (grilla CSS, sin librería), sesiones agrupadas
      con chip de área, filtros por kind, tarjetas de racha/días/preguntas/precisión.

### Fase 8 — Nivelación ICFES  · estado: ✅ completada
- [x] `docs/levels.v1.json` + `packages/convex/src/levels.ts` (patrón de `taxonomy.ts`; export `./levels` en
      `package.json` para que la web lo consuma). Niveles 1-4 + bandas CEFR para Inglés.
- [x] Kind `nivelacion` (15 preguntas, una área, pool `diagnostic`, 30 min, sin tutor, no requiere diagnóstico).
- [x] Puerta de entrada: **la primera nivelación desbloquea la app**. `computeStudentAppState` y
      `hasCompletedPlacement` aceptan `diagnostic` **o** `nivelacion` (los estudiantes ya diagnosticados entran igual).
- [x] `/diagnostic` reencuadrada como pantalla de nivelación por área (5 tarjetas, chip "Nivelada", ya no
      redirige cuando hay placement — si no, no podrías nivelar las otras cuatro áreas).
- [x] Nivel **derivado sin tabla nueva** en `getStudentProgress` (`subjectLevels`), con puerta de evidencia.
      Surface en Progreso ("Tu nivel ICFES por área", barra 1→4 con marca del nivel base) y en Hoy.
- [x] `packages/convex/test/levels.test.ts` (12 casos: bandas ascendentes, fronteras inclusivas, clamp, evidencia).

### Fase 9 — Ruta de aprendizaje  · estado: ✅ completada
- [x] `packages/convex/src/path.ts`: `getLearningPath(studentId, subjectId)` + `listPathSubjects`.
      Reusa `collectUsableQuestionsBySubject` (no un tercer barrido) y `levels.ts` para la cabecera.
- [x] Ruta `/path` + `LearningPathPage.tsx`: camino vertical de nodos (dominado / actual / disponible / bloqueado),
      lección y práctica por subtema desde cada nodo.
- [x] Nav reorganizada a **Hoy · Ruta · Práctica · Progreso** (4 ítems, 6 secciones): el Temario cuelga de Ruta y
      el Historial de Progreso, para no engordar la barra.

### Fase 10 — Preguntas agrupadas (el bug)  · estado: ✅ completada
- [x] **Ingest:** `contextKey` + `contextRange` en el schema; prompt corregido (las reglas 2 y 7 se contradecían:
      la 7 mandaba ignorar "instructions about how to answer", que es literalmente el encabezado "RESPONDA LAS
      PREGUNTAS X A Y"); `thinkingBudget` 0 → 2048 (con 0 el modelo perdía la numeración entre páginas).
- [x] **Prompt deduplicado:** `question-extractor.ts` (CLI) tenía una copia byte a byte del SYSTEM_PROMPT y de la
      llamada a Gemini; ahora importa de `question-extraction-core.ts`. Sin esto el arreglo cubría medio repo.
- [x] `question-groups.ts` (puro) + 9 tests: miembros dispersos, key sin estímulo, grupo de uno, rango incoherente.
- [x] **Convex:** tabla `questionGroups`, `questions.groupId`/`groupPosition` (opcionales ⇒ sin migración
      destructiva), `buildQuestionBodyMarkdown` deja de fundir el contexto, `clearPdfQuestions` borra también grupos.
- [x] **Enriquecimiento con estímulo completo** (`contextMarkdown`) + prompt versions bumpeadas.
- [x] `questionPool.expandToGroups`: única definición de "grupo entero o ninguno", consumida por las 5 estrategias.
- [x] `components/SharedStimulus.tsx` en solve y review + contexto del grupo para el tutor.

### Fase 11 — Simulacros por área  · estado: ✅ completada
- [x] `simulacro` acepta `subjectId` opcional: total oficial del área y tiempo al ritmo oficial
      (`SIMULACRO_MS_PER_QUESTION = 135_000`). Pasar área **y** número de sesión se rechaza.
- [x] `getLatestSimulacroScore` filtra los simulacros por área para no reportar un puntaje de examen completo
      que el estudiante nunca presentó.
- [x] Hub: selector de dos niveles ("Examen completo" / "Por área", con color y emoji por área).

### Fase 12 — Cierre de pendientes (cortes ICFES, typecheck, tipografía)  · estado: ✅ completada

- [x] **Cortes de nivel ICFES verificados** contra las hojas oficiales publicadas el 2025-09-22
      (`icfes.gov.co/wp-content/uploads/2025/09/22-septiembre-nd-prueba-<área>-saber-11.pdf`).
      Cuatro de las cinco áreas ya estaban bien; **Inglés estaba mal**: `docs/levels.v1.json` tenía cinco bandas
      inventadas (A- 0 / A1 48 / A2 58 / B1 68 / B+ 79). El ICFES publica **cuatro**: Pre A1 0-36, A1 37-57,
      A2 58-70, B1 71-100 — B1 es el techo de la prueba y **B+ no existe** en Saber 11. Corregido, con los
      descriptores reescritos desde el documento oficial.
      Confirmados sin cambio: LC 0/36/51/66 · MAT 0/36/51/71 · CN y SOC 0/41/56/71.
- [x] Test nuevo `cut points match the official ICFES level sheets` que fija los cinco cortes: son cifras que el
      estudiante se cree, no pueden derivar por accidente. `bandCount` sigue siendo dato (JSON), no código.
- [x] **Los 11 errores de typecheck preexistentes de `ai-elements/*` están resueltos.** Ahora el criterio de
      verificación vuelve a ser **cero errores**, no "cero errores nuevos".
      `jsx-preview.tsx`: guard de `tagName`, `attributes ?? ""`, y `toReversed()` → `[...stack].reverse()`
      (era ES2023 con `lib: ES2022`; invertir la copia no exige subir el target).
      `speech-input.tsx`: `result?.isFinal`. `stack-trace.tsx`: `filePath` opcional, `lines[0] ?? ""`,
      `errorType = type ?? null`.
- [x] **Tipografía de cuerpo: Plus Jakarta Sans → Hanken Grotesk.** Cuatro puntos de cambio (el `@import` y el
      token de `styles.css`, más el link y los tokens de `demo-document.ts`). No hace falta bumpear
      `PROMPT_VERSION`: el link de fuentes vive en el *wrapper* de la demo, no en el fragmento cacheado.

### Fase 13 — Producto: fecha de examen, puntaje global, distractores, calibración, confianza y comparación nacional  · estado: ✅ completada

Seis mejoras de producto pedidas por el usuario. Cinco módulos puros nuevos, todos con tests
(el paquete convex pasa de 20 a 96 tests).

- [x] **F1 · Fecha de examen** (`examPlan.ts` + 17 tests). `students.examDate` + `setExamDate`.
      `getTodayDashboard` devuelve `examPlan` (días restantes, fase, semanas, sesiones proyectadas
      al ritmo observado). `ExamCountdown.tsx` en Hoy, con prompt cuando no hay fecha.
      **Gotcha:** el input `type="date"` se parsea a **mediodía local**, no a medianoche —
      `new Date('2026-11-08')` es medianoche UTC = 7pm del día 7 en Bogotá, y la cuenta regresiva
      habría estado corrida un día para todo el país.
- [x] **F2 · Puntaje global 0-500** (`globalScore.ts` + 18 tests). Fórmula oficial verificada:
      `(3·LC + 3·MAT + 3·CN + 3·SOC + 1·ING) / 13 × 5`. Se reporta **con banda de incertidumbre**
      (error binomial por área, propagado con pesos al cuadrado, 95%): un estimado de 30 preguntas
      y uno de 600 no son la misma afirmación. Devuelve `null` si falta cualquier área — nombra las
      que faltan en vez de sustituirlas por ceros. `GlobalScoreCard.tsx` + meta editable
      (`targetGlobalScore`) + `highestLeverageSubject` ("dónde rinde más tu esfuerzo").
- [x] **F3 · Explicar el distractor** (`question-enrichment-core.ts`). `distractorRationales` por
      opción incorrecta, con el prompt pidiendo **el error de razonamiento**, no una repetición de la
      respuesta correcta. `thinkingBudget` 0 → 2048 (con 0 las racionalizaciones colapsaban a "esta
      opción es incorrecta"). `ANSWER_PROMPT_VERSION` → `v3`. El review muestra primero la del
      distractor que el estudiante eligió, y después la explicación general.
- [x] **F4 · Calibración Elo** (`elo.ts` + 19 tests). `questions.difficultyRating` +
      `students.abilityBySubject`. Se calibra en `completeSession`, **no** en `submitAnswer`:
      una respuesta puede cambiarse N veces antes de terminar (solo la última es evidencia) y
      escribir el documento compartido de una pregunta en cada respuesta la volvería un hotspot
      de contención. `completeSession` ya retorna temprano si la sesión está completa ⇒ cada intento
      se procesa exactamente una vez.
- [x] **F5 · Confianza declarada** (`confidence.ts` + 23 tests). `questionAttempts.confidence`
      (`sure`/`unsure`/`guess`), opcional: responder nunca depende de declarar. Cuatro estados —
      `mastered`/`fragile`/`misconception`/`gap`. **No es solo UI:** `collectDueReviewQuestions`
      ordena por `reviewPriority`, así que los errores de concepto (seguro + incorrecto) vuelven
      primero en el repaso. Franja en el solve + `ConfidenceBreakdownCard` en Progreso.
- [x] **F6 · Comparación nacional** (`national.ts` + `docs/national-results.v1.json` + 9 tests).
      **Cobertura deliberadamente parcial.** Las distribuciones por nivel del informe nacional 2024
      viven en figuras (imágenes); solo se registró lo que está en prosa y anclado a un año:
      LC nivel 2 = 48%, MAT nivel 3 = 50% y nivel 4 = 8%, CN nivel 1 = 18% y nivel 2 = 47%.
      Sociales e Inglés quedan como huecos explícitos con `gapReason`.
      `getNationalPercentileAtOrBelow` **se niega** a sumar una distribución incompleta: hacerlo
      halagaría al estudiante con un país al que le faltan tres de sus cuatro niveles.

**Bug encontrado de paso (crítico):** `progress.ts:buildSubjectLevels` hacía
`Math.round(subjectScore.score * 100)` sobre un valor que `completeSession` ya produce en escala
0-100. El resultado (0-10000) pasaba el clamp de `getLevelForScore`, así que **el baseline de
cualquier estudiante con diagnóstico legacy se reportaba en el nivel máximo** — un estudiante que
sacó 30% veía "Nivel 4" como su punto de partida y por tanto que había empeorado. Corregido.

**Aprendizajes / decisiones**
- **El puntaje de área ahora prefiere la evidencia calibrada.** `areaScore()` usa
  `expectedScore(ability, DEFAULT_RATING)` cuando hay suficientes intentos, y cae a la precisión
  cruda si no. La precisión cruda responde "qué porcentaje acertaste", que depende tanto de las
  preguntas que te tocaron como de ti; el Elo responde "qué porcentaje acertarías contra una
  pregunta promedio", que es lo que un puntaje de área debería significar. Es la dependencia
  F4 → F2 y por eso F4 va primero.
- **La incompletitud se declara en el contrato, no se disimula.** `national-results.v1.json` lleva
  `complete: false` por materia y `gapReason` donde no hay dato; la UI no renderiza nada para esas
  áreas. Mismo patrón que `levels.v1.json`.
- **Cada número que el estudiante se cree lleva su fuente en el JSON**, no en el código.
- Módulos puros nuevos exportados en `package.json` (`./globalScore`, `./confidence`, `./examPlan`,
  `./elo`) y registrados a mano en `_generated/api.d.ts` (`convex codegen` exige `CONVEX_DEPLOYMENT`).

### Hallazgo de seguridad (durante la Fase 7)
Ninguna query de lectura de `sessions.ts` validaba propiedad: `getSession`, `getActiveSession`, `listSessions`,
`getReviewQueue`, `getLatestDiagnostic`, `getLatestSimulacroScore` — ni `progress.getStudentProgress`.
`getSession` en particular devuelve **respuestas correctas y explicaciones** de una sesión completada, así que
cualquier estudiante autenticado podía leer las sesiones de otro pasando su id. Añadido `assertOwnsStudent`
en todas (el patrón que ya usaban `today.ts`, `syllabus.ts` y `coach.ts`).

---

## Wireframes de referencia

### "Hoy" (D.1) — sin cuenta regresiva (examDate fuera de alcance por ahora)
```
┌─────────────────────────────────────────────────────────────┐
│  Aprendo            Hoy · Temario · Práctica · Progreso   ⚙  │
├─────────────────────────────────────────────────────────────┤
│  Buenos días, Juan 👋          ┌──────────────────────────┐  │
│                                │   🔥 Racha: 5 días       │  │
│                                │   Esta semana: 4/5 metas │  │
│  ┌─────────────────────────────┴──────────────────────────┐ │
│  │  TU PLAN DE HOY                              ~25 min    │ │
│  │  ① 📖 Lección: Inferencia en Lectura Crítica   5 min  ▸ │ │
│  │  ② ✏️  Práctica: 6 preguntas del tema          12 min ▸ │ │
│  │  ③ 🔁 Repaso: 3 errores de ayer                8 min  ▸ │ │
│  │              [ ▶  Empezar sesión de hoy ]                │ │
│  └──────────────────────────────────────────────────────── │
│  Foco de la semana                  Continúa donde quedaste   │
└───────────────────────────────────────────────────────────────┘
```

### "Temario" (D.2) — el cambio de mayor ROI
```
┌─────────────────────────────────────────────────────────────┐
│  Temario ICFES Saber 11                    Tu dominio: 54%   │
├─────────────────────────────────────────────────────────────┤
│  [ Lectura ] [ Matemáticas ] [ C. Naturales ] [ Sociales ]…  │
│  Matemáticas                                  ▓▓▓▓▓░░░  58%   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ▸ Álgebra y cálculo            ▓▓▓▓▓▓▓░  72%  ✓ dominado │ │
│  │ ▾ Geometría                    ▓▓▓░░░░░  34%  ⚠ a reforzar│ │
│  │     • Áreas y perímetros       ▓▓▓▓▓░  habilitado        │ │
│  │     • Teorema de Pitágoras     ▓▓░░░░  📖 lección · ✏ 12 │ │
│  │     • Semejanza                ░░░░░░  🔒 aún sin practicar│ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```
Cada nodo: dominio + si hay lección + nº de preguntas disponibles. Mapa de progreso + menú de estudio a la vez.

### Página de concepto / lección IA (D.3)
```
┌─────────────────────────────────────────────────────────────┐
│  ← Geometría                              Teorema de Pitágoras│
│   📖 La idea en 2 minutos    [ demo interactiva = artifact ]  │
│   🧠 Cómo lo pregunta el ICFES                                │
│   ⚠ Errores comunes                                          │
│   [ ✏ Practicar 8 preguntas de este tema ]   💬 Tutor ⌘K     │
└───────────────────────────────────────────────────────────────┘
```

---

## Sistema de diseño (RESPETAR) — v2, juvenil
> Reemplaza la paleta crema+coral con Fraunces/Manrope de las Fases 1-5. Esa dirección está **derogada**;
> no la restaures. Cambiada en la Fase 6 (ver abajo) por decisión explícita del usuario.

- Definido en `apps/web/src/styles.css` (clases utilitarias custom + Tailwind v4, sin `tailwind.config.js`).
- Fuentes: display = **Bricolage Grotesque** (sans display, 700), body = **Hanken Grotesk**.
  NO Fraunces/Manrope/Inter/Roboto/Plus Jakarta Sans.
- Paleta: bg blanco `#ffffff` / lavanda `--bg-warm`, marca violeta `--brand: #6c4cf1`, `--gold: #ffc93c`,
  `--success: #21c08b`, `--danger: #ff5d5d`. Un color por área ICFES en `--subject-<id>`.
- **Tema oscuro: un solo bloque `:root.dark, :root[data-theme="dark"]`.** No añadas una copia dentro de
  `@media (prefers-color-scheme: dark)`: el script bloqueante de `__root.tsx` y `ThemeToggle` siempre ponen
  la clase del tema **resuelto** en el root, incluso en modo `auto`. (Antes había dos copias y divergieron.)
- Tokens: `--bg`, `--bg-card`, `--bg-inset`, `--text-primary/secondary/tertiary`, `--brand` (+ alias `--accent`
  para no tocar las ~200 clases viejas), `--gold`, `--success`, `--danger`, `--subject-*`, `--border`,
  `--border-hard`, `--radius-*`, `--shadow-*`, `--shadow-hard`, `--shadow-hard-sm`.
- **Convención de forma:** contorno de 2px = superficie; **sombra dura sin desenfoque (`--shadow-hard`) =
  se puede presionar** (`.btn-primary`, `.option-card`, `.launch-card`), y se hunde con `translateY(2px)`
  en `:active`. Las tarjetas estáticas se quedan con `--shadow-card` para que Progreso/Historial no se
  conviertan en un muro de contornos negros.
- Clases reutilizables: `.card`, `.card-inset`, `.btn-primary`, `.btn-ghost`, `.chip`, `.kicker`, `.fade-in`.
- Color/ícono por área: **`apps/web/src/lib/subject-theme.ts`** (`getSubjectTheme`), única fuente. Las
  etiquetas vienen de `lib/taxonomy.ts`, no se redeclaran.
- Logo: **`apps/web/src/components/BrandMark.tsx`** (antes copiado a mano en 5 archivos).
- Animación: `motion@12.38.0` ya instalado; hay un guard global de `prefers-reduced-motion` en `styles.css`.
- Componentes UI: `apps/web/src/components/ui/*` (radix/shadcn) y `ai-elements/*`. El `@theme` de `styles.css`
  ahora define los tokens `--color-*` que shadcn espera, así que `Card`/`Badge`/`Tabs`/`Select`/`Progress`
  ya renderizan con la paleta: **úsalos en vez de escribir clases CSS nuevas a mano.**

## Mapa de archivos clave
- Nav: `apps/web/src/components/StudentAppShell.tsx` (hoy `StudentSection = 'practice' | 'progress'`).
- Práctica: `routes/practice.tsx`, `routes/practice.$sessionId.tsx` + `components/SessionSolve.tsx`, `routes/practice.$sessionId.review.tsx`.
- Progreso: `components/StudentProgressPage.tsx` + `routes/progress.tsx`.
- Entrada/landing: `routes/diagnostic.tsx`, `routes/app.tsx` (redirect), `routes/index.tsx`.
- Taxonomía: `apps/web/src/lib/taxonomy.ts` (`getSubjectLabel`, `getSubtopicLabel`, `subjectIds`) ← `docs/taxonomy.v1.json`.
- Backend Convex: `packages/convex/src/{sessions,tutor,progress,students,schema,validators,sessionKinds}.ts`.
- Queries cliente: `apps/web/src/lib/student-queries.ts`.
- Sesiones unificadas: `packages/convex/src/sessionKinds.ts` (diagnostic/recommended/topic/simulacro sobre una sola tabla `sessions`).

## Specs autoritativos (leer antes de cada área — índice en `AGENTS.md`)
`PRODUCT_SPEC`, `ARCHITECTURE_SPEC`, `TAXONOMY_SPEC`, `DATA_MODEL_SPEC`, `LEARNER_STATE_SPEC`,
`RECOMMENDATION_ENGINE_SPEC`, `TUTOR_INTEGRATION_SPEC`, `TYPESCRIPT_CONVENTIONS` (no barrel files),
`EFFECT_BEST_PRACTICES` (package `ingest`), ADR `0001-separate-solve-and-review-session-screens`.

---

## Decisiones tomadas
- **Rutas en inglés, etiquetas en español:** `/syllabus` (label "Temario"), `/today` (label "Hoy"). Coherente con el código actual.
- **Práctica por subtema:** extender el kind `topic` para aceptar `subtopicId` opcional (reusa toda la maquinaria de `sessions`), en vez de crear un kind nuevo.
- **Cuenta regresiva al examen / `examDate`:** FUERA de alcance por ahora.
- **Specs:** son vivas. Se actualizan/eliminan las que queden obsoletas con el rediseño; cada cambio se registra abajo.
- **Convex:** investigar docs (https://docs.convex.dev) antes de diseñar schema/queries; en particular el conteo de preguntas por subtema (Convex no tiene `COUNT` nativo).

## Registro de aprendizajes y decisiones
> Una entrada por tarea completada (qué se hizo, qué cambió en el schema/arquitectura, qué aprendimos).

### Fase 1 — Temario navegable (✅)
**Qué se hizo**
- Backend: módulo nuevo `packages/convex/src/syllabus.ts` con `getSyllabus(studentId)` (auth con `assertOwnsStudent`), que une el JSON de taxonomía con conteos de preguntas lanzables por materia/subtema y el `masteryScore` de los aggregates. Dominio global = promedio de las materias con evidencia (consistente con la página de Progreso).
- Backend: `topic` ahora acepta `subtopicId` opcional. Cambios en `createSession` (args + validación + derivación de materia desde el subtema + reutilización de sesión activa), `buildSelection`, `selectTopic` (conmuta a `by_primarySubtopicId_eligibility`), y campo `subtopicId` en `sessionDocumentValidator`. Sin migración: campo opcional.
- Refactor (limpieza): extraído `packages/convex/src/questionPool.ts` (`hasUsableMetadata`, `isInEligibilityPool`, `collectUsableQuestionsBy{Subject,Subtopic}`) — única definición de "pregunta lanzable", consumida por `sessions.ts` y `syllabus.ts`. Evita que el Temario anuncie un conteo que la práctica no puede cumplir.
- Frontend: ruta `/syllabus` + `SyllabusPage.tsx` (selector de materia, panel categoría→subtema, barra de dominio, chip de estado, botón Practicar por subtema). `RingProgress` extraído a `components/RingProgress.tsx` (reusado por Progreso). Helper `lib/syllabus-status.ts` para los 5 estados. `SyllabusPage` usa el tipo de retorno inferido de `getSyllabus` (sin redeclarar la forma). Nav: `Temario` añadido (y acentos corregidos en el shell).
- Specs actualizados: `PRODUCT_SPEC` (dirección del rediseño + objeto/flujo Temario), `DATA_MODEL_SPEC` (Session `kind`/`subjectId`/`subtopicId`, `selectionReason` completo, read model del sílabo), `ARCHITECTURE_SPEC` (vista Temario + seam del pool de preguntas).

**Aprendizajes / decisiones técnicas**
- **Conteo en Convex (research):** Convex no tiene `COUNT` nativo a propósito. Para V1 (cientos/miles de preguntas) `.collect().length` sobre índices es aceptable mientras cada materia esté muy por debajo de ~1000 docs y los escaneos por transacción bajo 32k docs / 16 MiB. Se cuenta agrupando por materia (5×2=10 barridos en paralelo con `Promise.all`) y bucketing por subtema en memoria. `@convex-dev/aggregate` sería sobre-ingeniería ahora; umbral de migración documentado en `syllabus.ts`.
- **Reactividad:** `getSyllabus` se reinvalida ante cualquier cambio en `questions`. Aceptable en V1; si el ingest frecuente causa thrashing, migrar a conteos denormalizados o al componente aggregate.
- **Codegen:** tras añadir un módulo de funciones Convex hay que correr `bunx convex codegen` (en `packages/convex`) para que el web vea `api.syllabus`. El route tree de TanStack se regenera con el plugin en dev/build (o `bunx @tanstack/router-cli generate`).
- **Verificación:** typecheck convex (exit 0) y web (solo 11 errores pre-existentes en `ai-elements/*`, cero nuevos); tests 6/6. El dev server lo corre el usuario.
- **Gate:** `/syllabus` exige diagnóstico completo (como Progreso/Práctica). Revisable si se quiere que el Temario sea explorable antes del diagnóstico.

### Fase 2 — Pantalla "Hoy" (✅)
**Qué se hizo**
- Backend: `packages/convex/src/today.ts` con `getTodayDashboard(studentId)` — racha y días activos de la semana derivados de `questionAttempts` (sin esquema nuevo). Días bucketeados en zona Colombia (UTC-5) para que el día ruede a medianoche local.
- Backend: `computeStudentAppState` ahora devuelve `defaultRoute: '/today'` tras el diagnóstico → `/app` aterriza en Hoy.
- Frontend: ruta `/today` + `TodayPage.tsx` (saludo según hora, tarjeta de racha, "Tu plan de hoy" = CTA de práctica recomendada, "Foco de la semana" = materia más débil → Temario, "Continúa donde quedaste" = sesión activa). `Hoy` añadido como primer ítem de nav.
- Limpieza de arquitectura: extraído hook `lib/use-student-guard.ts` (login + gate de diagnóstico + estados de carga en un solo lugar) y componente `components/FullScreenLoader.tsx`. Refactorizadas las rutas `today`, `syllabus` y `progress` para usarlos (antes: el guard estaba copiado en 3-4 rutas).

**Aprendizajes / decisiones**
- **Reuso del motor existente:** "Hoy" no necesitó nueva lógica de recomendación — el "plan del día" envuelve el kind `recommended` ya existente. Las lecciones y el repaso espaciado del wireframe llegan en Fases 3-4; por ahora el plan es práctica recomendada + foco + continuar.
- **Racha sin esquema:** derivada de attempts en una query reactiva. Si crece mucho el histórico de attempts, considerar denormalizar la racha (igual que el conteo del Temario).
- **Verificación:** convex tsc exit 0, web solo 11 errores pre-existentes, tests 6/6.

### Fase 3 — Lecciones IA por concepto (✅)
**Qué se hizo**
- Backend: tabla `conceptLessons` (validador en `validators.ts`, tabla en `schema.ts`, índices `by_subtopicId`/`by_status`). Módulo `lessons.ts` con el flujo generar-y-cachear (query/mutation/internalAction/internalMutation). Modelo `openrouter('deepseek/deepseek-v4-pro')` + `generateObject` (AI SDK) con esquema Zod {ideaBody, icfesBody, commonMistakes[], demoHtml opcional}. `OPENROUTER_API_KEY` (ya configurada para el tutor). `getSyllabus` enciende `hasLesson` con scan `by_status==ready`.
- Frontend: ruta `/lesson/$subtopicId` + `LessonPage.tsx` (MarkdownBlock/KaTeX, iframe sandbox para la demo, errores como tarjetas, CTA practicar, estados generando/failed). Enlace + chip "Lección" desde el Temario (`SyllabusPage` SubtopicRow). Helpers `conceptLessonQuery` y `getSubjectIdForSubtopic`.
- Limpieza: extraído `packages/convex/src/taxonomy.ts` (lookups: `SUBJECT_IDS`, `getSubtopicContext`, `getSubjectIdForSubtopic`, `getSubjectLabel`, `getSubtopicLabel`) — consumido por `sessions.ts`, `lessons.ts` y `tutor.ts` (se eliminaron los mapas locales `subjectLabelById`/`subtopicLabelById` del tutor), eliminando las traversals duplicadas del JSON de taxonomía en el backend.
- CTA "Repasar este concepto" en el Review: enlace por pregunta a `/lesson/$subtopicId` del subtema actual, tras la explicación, sin tocar el flujo del tutor/artifacts.

**Aprendizajes / decisiones**
- **NO `@convex-dev/agent`** para contenido cacheado de una pasada: el Agent aporta hilos/historial/streaming innecesarios. Una `internalAction` con el AI SDK directo es lo correcto. El Agent se reserva para el tutor conversacional.
- **Patrón generar-y-cachear (research Convex):** las queries no pueden llamar LLMs (deben ser deterministas) → la generación va en una action agendada desde una mutation; el estado `generating` + serializabilidad/OCC de Convex actúa como lock lógico que deduplica solicitudes concurrentes; reactividad automática al pasar a `ready`. `promptVersion` invalida lecciones viejas. Timeout de lock (3 min) re-reclama generaciones colgadas (las actions no se reintentan solas).
- **Bug atrapado por el typecheck humano/linter:** `createSession` requiere `studentId`; un `as never` lo había ocultado en `LessonPage`. Corregido pasando `studentId` a la página. Lección: cuidado con `as never` sobre args de mutación.
- **Reusos clave:** `ARTIFACT_AUTHORING_GUIDE` del tutor inspiró las reglas condensadas de la demo HTML; el iframe `sandbox="allow-scripts"` de `ArtifactPane`; `MarkdownBlock` (KaTeX, imprescindible para fórmulas).
- **Verificación:** convex tsc exit 0; web solo 11 errores pre-existentes; tests 6/6. La generación real de lecciones requiere `OPENROUTER_API_KEY` en el deployment y se prueba en runtime (el usuario corre dev).

### Fase 4 — Repaso espaciado + resumen semanal (✅)
**Qué se hizo**
- Repaso: añadido el kind `repaso` a `SESSION_KINDS`/`sessionKindValidator` (el guard de compile-time mantiene la sincronía) + config en `sessionKinds.ts` + estrategia `review_mistakes`. En `sessions.ts`: `collectDueReviewQuestions` (último intento incorrecto = "no aprendida", más antiguas primero) + `selectReviewMistakes` + query `getReviewQueue`. Icono `RotateCcw` en `session-display.ts`. Surface en `TodayPage` (tarjeta) y filtro en el hub.
- Coach: `coach.ts` con `getWeeklyCoachSummary`/`requestWeeklyCoachSummary`/`getWeeklyStats` (internalQuery)/`generateWeeklyCoachSummary` (internalAction, `generateText`)/`markReady`/`markFailed`. Tabla `coachSummaries`. Surface en `TodayPage` (solicitud bajo demanda solo si `activeDaysThisWeek>0`).

**Aprendizajes / decisiones**
- **Añadir un session kind** toca: `SESSION_KINDS`, `sessionKindValidator` (el `_assertSessionKind` obliga a sincronizar), `SESSION_KIND_CONFIG`, `SelectionStrategy` + `buildSelection`, `recommendationSourceForKind`, y `KIND_ICON` (Record<SessionKind> obliga a añadir icono). El typecheck guía todos los puntos.
- **Repaso espaciado V1** simple y honesto: "due" = preguntas cuyo intento más reciente fue incorrecto; orden por antigüedad. Sin curva SM-2 todavía (suficiente para V1; se puede sofisticar luego con intervalos por nº de aciertos consecutivos).
- **Resumen semanal:** reusó el patrón generar-y-cachear (clave `(studentId, weekIndex)`, semana en UTC-5). Se genera solo con actividad para no gastar LLM en semanas vacías. `getWeeklyStats` es un `internalQuery` que la action invoca con `runQuery` (las actions no leen DB directo).
- **Trabajo en paralelo detectado:** durante esta sesión, `tutor.ts` se consolidó contra `packages/convex/src/taxonomy.ts` y se añadió el CTA "Repasar este concepto" en el Review (`practice.$sessionId.review.tsx` → `/lesson/$subtopicId`). Verificado por grep + typecheck; consistente.
- **Verificación:** convex tsc exit 0; web solo 11 errores pre-existentes; tests 6/6.

### Fase 5 — Generación de preguntas por IA (✅)
**Qué se hizo**
- `packages/convex/src/generatedQuestions.ts`: action `generateSubtopicQuestions(subtopicId, count)` (auth) que genera MCQ estilo ICFES con `generateObject` (Zod: 4 opciones A-D, una correcta, solución) e inserta vía `internalMutation insertGeneratedQuestions`. `findAiUpload`/`createAiUpload` gestionan un `pdfUploads` sintético (storageId minteado con un blob mínimo, una sola vez).
- Frontend: botón "Generar más práctica con IA" en `LessonPage` (`useAction` de `convex/react`), con feedback de cuántas se añadieron.

**Aprendizajes / decisiones**
- **Integración no invasiva > schema change:** en vez de hacer `questions.pdfUploadId` opcional (ripple en ingest/admin), las preguntas IA viven en `questions` bajo un upload sintético (slug `ai-generated`). Cero cambios al schema central; reuso total de selección/sesiones/review/conteos. `eligibility: 'practice_only'` las mantiene fuera del diagnóstico.
- **`useAction` (no `useConvexMutation`)** para llamar actions desde el cliente — `useConvexMutation` es solo para mutations (lo atrapó el typecheck).
- **Calidad/riesgo:** las MCQ generadas afirman su propia respuesta correcta (sin verificación independiente). V1 lo acepta con prompt riguroso + `practice_only`. Mejora futura: verificación adversarial de la respuesta o gating de calidad antes de habilitarlas.
- **Trabajo en paralelo:** se extrajo `packages/convex/src/aiCache.ts` (`decideClaim`) y `lessons.ts`/`coach.ts` se refactorizaron para usarlo (consolidación del patrón claim/generar-cachear). Convex package ganó script `test`. Verificado por typecheck + tests.
- **Verificación:** convex tsc exit 0; web solo 11 errores pre-existentes; tests 6/6.

### Pasada de limpieza de arquitectura (post Fases 3-5)
Revisión del código del rediseño con la skill `improve-codebase-architecture` (un agente Explore mapeó la fricción; se aplicaron solo los deepenings que pasan el "deletion test").
- **`aiCache.ts` (`decideClaim`)** — política pura de "cuándo (re)generar" del patrón generar-y-cachear, antes duplicada e incrustada en `lessons.ts` y `coach.ts`. Ahora se enuncia una vez y es testeable (la mecánica tipada tabla/índice/action se queda en cada caller). Primer test del paquete convex (`test/aiCache.test.ts`, 7 casos) + script `test`.
- **`collectDueReviewQuestions` (consolidación + bug)** — el conteo de `getReviewQueue` (tarjeta "Repaso de errores" en Hoy) contaba **todas** las preguntas con último intento incorrecto, pero `selectReviewMistakes` filtraba además por lanzabilidad (`hasUsableMetadata` + `eligibility`). La tarjeta podía anunciar más preguntas de las que la sesión podía lanzar (mismo defecto que `questionPool` previno en Fase 1). Ahora el helper devuelve solo las preguntas **lanzables** de repaso y conteo + selección comparten esa única definición.
- **Descartados con criterio (deletion test):** helper genérico para los wrappers `convexQuery(...'skip')` de `student-queries.ts` (solo movería boilerplate); hook `useGeneratedContent` para LessonPage/TodayPage (las dos superficies divergen — el coach no tiene estados failed/retry —, sería un wrapper shallow); unificar los "readiness bands" de `syllabus-status.ts` vs `StudentProgressPage` (etiquetas deliberadamente distintas, decisión de producto).
- **Verificación:** convex tsc exit 0; web solo 11 errores pre-existentes; tests 4 tareas (convex 7, ingest 4, web 2).

### Mejora de lecciones IA: demos integradas + carga reactiva (post Fases 3-5)
- **Demo integrada (no HTML genérico):** la demo dejó de generarse como documento HTML autónomo con estilos propios. Ahora el modelo produce un **fragmento** que usa las variables CSS de la app (`--accent`, `--bg-card`, `--text-*`, `--radius-*`, `--font-*`); el cliente lo envuelve con `buildDemoDocument(fragment, theme)` (`apps/web/src/lib/demo-document.ts`), inyectando fuentes (Fraunces/Manrope), tokens y el **tema claro/oscuro actual**. Hook `useResolvedTheme` (observa la clase de `<html>`) para que la demo siga el tema; el iframe se re-renderiza al cambiarlo. `DEMO_FRAGMENT_RULES` en `lessons.ts` instruye al modelo a usar esos tokens y no codificar colores/fuentes.
- **La demo es para explorar, no evaluar:** el prompt prohíbe explícitamente preguntas/quizzes/ejercicios en la demo (tanto en la decisión de fase 1 `demoConcept` como en `DEMO_FRAGMENT_RULES`) — para practicar preguntas están la práctica por tema, el CTA y la generación con IA. `PROMPT_VERSION` → `v3`.
- **Enfoque "entender el tema" (estilo Khan Academy):** se eliminaron las secciones "Cómo lo pregunta el ICFES" (`icfesBody`) y "Errores comunes" (`commonMistakes`) del schema, validador, prompt y UI. La lección ahora es una **explicación que enseña el concepto** (`ideaBody`, más completa: intuición → ejemplo → para qué sirve) + demo opcional. El prompt y el schema piden solo explicación, sin formatos de examen ni práctica. `PROMPT_VERSION` → `v4`. (El usuario borra los registros viejos; el schema con `schemaValidation` rechazaría docs con los campos eliminados hasta que se borren.)
- **Carga explícita vía socket reactivo:** generación dividida en dos fases que parchean la fila (campo `stage`): fase 1 escribe el texto (`stage: 'writing'` → `'demo'`), fase 2 construye la demo opcional → `ready`. El cliente muestra "Escribiendo tu lección…" y luego el **texto completo** con un placeholder "Creando una demostración interactiva…" donde irá la demo — sin polling, solo parches a la DB. La demo es resiliente: si falla la fase 2, la lección se publica con su texto. `PROMPT_VERSION` → `v2` (regenera las cacheadas vía `decideClaim`).
- **Specs:** `DATA_MODEL_SPEC` (campo `stage`, demo como fragmento, dos fases) y `ARCHITECTURE_SPEC` §5 (flujo reactivo en dos fases + shell temificado).
- **Verificación:** convex codegen + tsc exit 0; web solo 11 errores pre-existentes; tests 4 tareas (convex 7, ingest 4, web 2).

### Rediseño de Progreso: de foto estática a "cuánto he mejorado"
La vista anterior solo mostraba el dominio actual (precisión + bandas por materia + subtemas débiles), sin evolución. Rediseñada en torno a la **mejora**:
- **Backend:** `getProgressTrends` (nuevo, `progress.ts`) — serie de **precisión semanal** + totales de actividad (preguntas, días activos, primera actividad), derivados de `questionAttempts` (sin estado nuevo). Query aparte de `getStudentProgress` para no encarecer la query que también usa "Hoy". El "antes" sale de `snapshot.diagnosticBaseline` (overall + `subjectScores`) que ya existía.
- **Frontend (`StudentProgressPage`):** hero con **delta de precisión vs diagnóstico** ("Has subido N puntos"); **gráfico de tendencia** SVG hecho a mano (área+línea, sin librería) de precisión semanal; **"Antes y ahora" por materia** (diagnóstico → actual con barra + tick de baseline + chip de delta, ordenado por mejora); tarjetas de actividad (incl. "lo que más mejoró"); y "Sigue mejorando aquí" = subtemas débiles **enlazados a su lección**. Acentos corregidos (la versión vieja tenía "preparacion"/"diagnostico" sin tilde).
- **Limpieza:** extraído `packages/convex/src/colombiaTime.ts` (`colombiaDayNumber`/`colombiaWeekIndex`/`colombiaWeekStartMs`) — `today.ts` y `coach.ts` migrados (eliminadas 2 copias de la lógica de zona horaria UTC-5); reusado por la tendencia de progreso.
- **Specs:** `PRODUCT_SPEC` §3 (la vista de progreso se enmarca en mejora, no foto).
- **Verificación:** convex codegen + tsc exit 0; web solo 11 errores pre-existentes; tests 4 tareas.
