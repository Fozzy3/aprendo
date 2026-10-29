# Ruta de mejora pedagógica

Estado: **plan, sin ejecutar** (2026-10-29). Sale de `plans/analisis-pedagogico.md`.
Cada fase cita la sección del análisis que la justifica (§N).

Numeración: sigue en F30 porque F25–F29 son del plan ENEM (`plans/enem-brasil.md`).

## Principios

1. **Primero quitar, después agregar.** Cada fase deja la app con menos caminos, no con más.
2. **Una sola respuesta a "¿qué hago ahora?"** Hoy decide; las demás pantallas muestran el mapa.
3. **Practicar es aprender; nivelar y simular es medir.** La práctica corrige al momento y tiene tutor. El examen no.
4. **TDD estricto.** Cada cambio de comportamiento entra con su prueba en rojo primero.
5. **Fases cortas que se pueden desplegar solas.** Ninguna deja la app a medias.

## Orden y dependencias

```
F30 Arreglos ──▶ F31 Aprender practicando ──▶ F32 Cierre de sesión
                                                   │
F33 Una sola brújula ◀─────────────────────────────┘
   │
   ├──▶ F34 Repaso espaciado
   └──▶ F35 Puntaje temprano y competencias ──▶ F36 Meta de carrera (plan propio)
F37 Tutor por voz (plan propio), en paralelo desde F31

Pista docente (en paralelo, después de F30):
F38 Qué enseñar esta semana ──▶ F39 Grupos flexibles ──▶ F40 Asignaciones ──▶ F41 Guía de clase ──▶ F42 Ciclo y reevaluación
                                                       (F40 necesita F33)                         (F42 usa competencias de F35)
```

---

### F30 · Arreglos y limpieza (§10, §Qué quitar 3, 6, 9) · ✅ (2026-10-29, sin commit)
Bugs verificados y duplicados sin discusión. No cambia la forma de estudiar.
- [x] **Bug:** "Desde tu nivelación" ya no lee solo el `diagnostic` antiguo. Ahora compara el puntaje de hoy por área con el de la nivelación y promedia (`changeSincePlacement`, `lib/progress-display.ts`). No compara la precisión: la práctica adaptativa apunta a ~70 % de acierto, así que la precisión llega ahí mejore o no el estudiante.
- [x] **Bug:** la Sesión 2 pendiente pasa por `TimedSessionIntro`. Al tocarla se abre la tarjeta del simulacro con su intro.
- [x] La tarjeta de Repaso muestra cuántas preguntas hay pendientes (`getReviewQueue`). Con 0 aparece bloqueada y explica por qué.
- [x] Se quitó "Día de examen completo": toda Sesión 1 completa ya termina en el descanso y la Sesión 2.
- [x] Historial ya no tiene la pestaña "Diagnóstico". Las sesiones antiguas siguen en "Todas".
- [x] La comparación nacional **se restauró en vez de borrarse**. No estaba muerta: el commit 4841051 (gráficas de progreso) la había dejado sin pantalla. Ahora es una nota bajo la gráfica de áreas, con las cifras del informe nacional 2024. El mensaje "por encima del X % del país" no se restauró: nunca podía aparecer y su fórmula estaba invertida.
- [x] Ruta abre en el área del Foco de Hoy (`focusSubjectId`, la misma función en las dos pantallas). Es el primer paso de F33.
- [x] "30 min" sale de `formatTimeLimit(NIVELACION.timeLimitMs)`, y el 12 de `MIN_ATTEMPTS_FOR_LEVEL`. Se corrigió el comentario de `path.ts`.
- [x] Verificación: typecheck limpio; pruebas: ingest 36, convex 401, web 164.

**Listo cuando:** un estudiante con solo nivelaciones ve su cambio en Progreso, y ningún botón lleva a un error.

### F31 · Aprender mientras se practica (§1, §2) · ✅
- [x] `defaultFeedbackMode` por tipo de sesión (`sessionKinds.ts`). `recommended`, `topic` y `repaso` corrigen al momento cuando quien las lanza no elige; nivelación, simulacro y reto, al final.
- [x] El tutor socrático funciona al resolver en esas tres (`tutorInSolve: true`). En `SessionSolve` hay un botón "Tutor" que abre el mismo chat en modo `solve`, con preguntas sugeridas de pista ("Dame una pista", "¿Cómo descarto opciones?") y no "Explícame la respuesta". El contexto le pasa la clave solo si la pregunta ya se comprobó.
- [x] `usedTutor` y `tutorMessageCount` se guardan de verdad (`sessions.recordTutorUse`, llamado por `sendPracticeTutorMessage`). Solo cuenta antes de comprobar la respuesta y mientras la sesión está abierta.
- [x] Decisión aplicada: un acierto con tutor cuenta para el acierto, pero esa práctica llega como máximo a Familiar (`SubtopicEvidence.tutorAssistedCount`).
- [x] `masteryScore` ya no resta `hintRate`. La columna se queda en el esquema para no migrar.
- Consecuencia: la práctica recomendada ahora es de tipo `practica` (corrección inmediata), así que ya no sube a Dominado. Dominado queda para reto, nivelación y simulacro, que miden sin ayuda. La leyenda de dominio se actualizó.


### F32 · Cierre de cada sesión (§4) · ✅
- [x] `completeSession` guarda `masteryChanges` (subtema, antes y después) en la sesión.
- [x] `SessionClose`: al terminar una práctica, un repaso o un reto, la revisión abre con el acierto y una línea por subtema. Si el nivel cambió, dice "Intentado → Familiar". Si no, dice qué falta (`closingLine`, por ejemplo: "Para Competente: una práctica perfecta de 4 o más preguntas, sin pedir ayuda al tutor"). Luego van "Siguiente paso en mi plan" y "Revisar pregunta por pregunta".
- [x] Prueba de punta a punta (`test/sessionClose.test.ts`): una práctica perfecta queda en Competente, y la misma con tutor queda en Familiar.


### F33 · Una sola brújula (§3, §8, §Qué quitar 1, 2, 4, 5, 7, 8) · ✅
- [x] `buildStudyPlan` devuelve `nextSubtopics` (los 3 de más puntos globales al alcance, fórmula del plan). Hoy (Foco), Ruta (área de apertura y "Recomendado ahora") y Progreso ("Practica esto ahora") leen esa misma lista (`focusSubjectId`).
- [x] Ruta sin candados (`resolvePathStates(nodes, recommendedIds)`).
- [x] Temario queda como "ver todo" de Ruta: la navegación ya los agrupaba, y ahora la lección vuelve a Ruta.
- [x] Hoy: el plan, la cuenta regresiva, la semana (Foco y sesión en curso) y el resumen del coach. La brecha de puntaje y el tiempo de estudio pasaron a Progreso.
- [x] Una sola meta semanal, en minutos. Se quitaron "Días de estudio x de 5" y `WEEKLY_GOAL`.
- [x] El centro de práctica ya no lista sesiones: tiene un enlace a Historial.
- [x] El constructor no tiene selector de dificultad. El filtro sigue en el backend, probado y opcional.
- [x] El estado de confianza "Dominado" pasó a llamarse "Seguro y bien".


### F34 · Repaso que sí espacia (§5) · ✅
- [x] Cajas de Leitner por subtema (`mastery.nextReviewState`): un subtema con todo bien sube de caja (1, 3, 7, 21, 60 días); con un error vuelve a la primera, al día siguiente. Lo mueve cada sesión al cerrar, también los exámenes, y sobrevive a la reconstrucción de agregados.
- [x] `isReviewDue`: vence cuando pasa su fecha. Un agregado de antes, sin fecha, vence si tiene errores, así nadie pierde su repaso.
- [x] El repaso sirve, por subtema vencido, 2 preguntas hermanas sin ver (de la misma competencia si están etiquetadas). La original o una ya vista vuelve solo si el tema no tiene nada nuevo. El orden pone primero los temas con un error de concepto reciente, luego la caja más baja y luego el más vencido.
- [x] El repaso ahora cuenta para el dominio como práctica: las originales quedan fuera por "clave ya vista" (`revealedQuestionIds`) y las hermanas son evidencia real.
- [x] Hoy, el centro de práctica y el plan cuentan temas vencidos, no preguntas falladas ("3 temas tocan repaso hoy: vuelven con preguntas nuevas"). Se llama "Repaso espaciado".


### F35 · Puntaje temprano y competencias ICFES (§6, §7, §9) · ✅
- [x] Cobertura: `bunx convex run teacher:competenciaCoverage` dice por área cuántas preguntas usables tienen `competencia_oficial`. **Pendiente del dueño:** correrlo en producción. Si la cobertura es baja, las tablas por competencia quedarán cortas hasta re-enriquecer.
- [x] Rango provisional del puntaje global desde la primera área (`provisionalGlobalRange`). A cada área sin medir le asigna la media de las medidas, con 15 puntos de dispersión entre áreas, así que el rango se estrecha con cada área. Aparece en la tarjeta del puntaje global.
- [x] Competencias con los nombres oficiales (`taxonomy.getCompetenciaLabel`, `competencyBreakdown`): en el informe del simulacro ("Por competencia" en cada área) y en el panel docente ("Por competencia ICFES"). Con menos de 10 respuestas dice "aún pocas" en vez de un porcentaje.
- [x] Estrategia del Saber 11 (`lib/exam-strategy.ts`): consejos generales y por área, desplegables en la intro del simulacro. Es texto fijo, **un borrador que debe revisar el equipo docente**.


### F36 · Meta de carrera · ✅ (V1)
Construida según `plans/meta-carrera.md`:
- `careers.ts`: 10 familias con pesos típicos (fuente UIS por familia; Artes usa los pesos oficiales del global), el cuestionario RIASEC de 12 actividades (`suggestFamilies`), `careerWeights` y `careerScore`.
- `students.careerFamily` y `setCareerFamily`.
- El plan del día y la práctica recomendada ponderan por la carrera; sin carrera, todo queda igual que antes.
- El ponderado aparece en Progreso junto al global, que no cambia.
- Dónde aparece: "¿Para qué carrera es este puntaje?" al terminar una nivelación y en Hoy mientras no haya respuesta (nunca es una puerta: tiene "Ahora no"); "Tu carrera · Cambiar" en Progreso; una línea de contexto para el tutor; la familia de cada estudiante en el panel docente.
- **Pendiente del dueño:** cruzar los pesos con otra universidad que pondere por programa (Univalle, UPTC o Distrital), como pide el plan.

### F37 · Tutor por voz · ✅ (fase 0)
- [x] Fase 0 (`lib/speech.ts`): micrófono en el chat del tutor donde el navegador tenga reconocimiento (Chrome, Edge, Safari; en Firefox no aparece). Lo dicho cae en el cuadro de texto y el estudiante lo envía. Un botón lee cada respuesta en voz alta en es-CO, pasando el LaTeX a palabras (`speakableText`). Nada de audio pasa por nuestros servidores ni se guarda.
- [ ] Fase 1, en cascada con nuestro STT y TTS: cuando la fase 0 muestre uso real (ver `plans/tutor-voz.md`).

---

## Metodología de enseñanza: qué estudiar y qué enseñar

Hoy la app le dice al **estudiante** qué estudiar. Al **docente** solo le muestra quién va mal: sus quiebres de riesgo, niveles por área y una tabla por subtema (`teacher.ts`). No le dice qué hacer el lunes. La metodología cierra ese hueco con un ciclo y tres niveles de atención, todos con reglas explícitas que se pueden auditar, como pide la arquitectura.

### El ciclo de dos semanas

Es instrucción basada en datos: evaluar → analizar → actuar → volver a evaluar.

```
 1. Medir           2. Decidir              3. Enseñar                     4. Practicar          5. Volver a medir
 nivelación,  ──▶   qué va a todo el  ──▶   clase corta (curso)       ──▶  la app asigna   ──▶  mini reto del subtema;
 simulacro,         curso, qué a grupos     y grupos pequeños              práctica a cada      el panel muestra
 práctica           y quién va solo         con la guía de clase           quien la necesita    antes y después
       ▲                                                                                              │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Dos semanas porque es lo que dura un tema en el aula y deja tiempo para juntar evidencia sin perder el hilo. Cada ciclo es un insumo directo para el Plan de Mejoramiento Institucional (PMI) del colegio.

### Tres niveles de atención

Se decide por subtema, contando solo a los estudiantes **con evidencia**: al menos 3 intentos en el subtema, y nunca con menos de 5 estudiantes del curso.

| Nivel | Regla | Qué hace el docente | Qué hace la app |
|---|---|---|---|
| **1. Todo el curso** | ≥ 40 % del curso por debajo de Familiar | Una clase corta del subtema (15–20 min) con la guía | Asigna la práctica del subtema a todos |
| **2. Grupo pequeño** | 15–40 % del curso por debajo de Familiar | Trabaja 10–15 min con ese grupo (máx. 6) mientras el resto practica | Arma el grupo y le asigna la práctica |
| **3. Individual** | Nivel 1 en un área, o inactivo 14 días, o sin nivelación | Una conversación corta: qué pasa, qué meta tiene | Ruta personal desde Hoy; el docente ve si la sigue |

Con menos del 15 %, no hace falta intervenir: cada estudiante lo resuelve con su ruta en la app.

**Prioridad entre subtemas:** peso del área en el ICFES × proporción del curso por debajo de Familiar × (1 + proporción de errores "seguros"). Un error cometido con seguridad es un error de concepto y pesa más que una duda. La lista se corta en **1–2 subtemas por ciclo para todo el curso**: enseñar ocho cosas a la vez es no enseñar ninguna.

### Cómo se enseña cada nivel

- **Todo el curso: discusión entre pares (estilo Mazur).** La app trae una pregunta real del banco donde el curso se divide entre dos opciones. Los estudiantes votan, discuten en parejas y vuelven a votar, y el docente cierra explicando la trampa. Funciona justo con los errores de concepto, y el dato de qué opción eligió el curso ya existe: la revisión muestra el % por opción.
- **Grupo pequeño: enseñanza explícita y andamiada.**
  1. Yo lo hago: el docente resuelve un ejemplo pensando en voz alta.
  2. Lo hacemos juntos: resuelven otro con ayuda.
  3. Lo haces tú: lo resuelven solos.

  Son los mismos niveles del método socrático del tutor (`tutor.ts`), así que el estudiante encuentra la misma lógica en el aula y en la app.
- **Individual: conversación y meta.** Un estudiante en nivel 1 o inactivo rara vez tiene un problema de contenido: suele ser motivación, tiempo o confianza. La app le da al docente tres datos para la charla (última actividad, área más baja, si tiene meta de carrera) y una pregunta para abrirla.
- **Cierre de cada clase: tiquete de salida.** Tres preguntas del subtema en la app, sin tutor y con corrección al final. Es la evidencia del paso 5.

### Qué estudia el estudiante y cómo se conecta

La ruta personal (F33, `nextBestSubtopic`) sigue decidiendo el día a día. Lo que asigna el docente va **primero** en Hoy, porque el aula manda; el resto del plan sigue la ruta. Así nunca hay dos planes compitiendo.

---

## Pista docente: el perfil del docente

### F38 · Qué enseñar esta semana (en el curso) · ✅
Se puede hacer apenas termine F30: todos los datos ya existen.
- [x] `classTeachingPlan` (función pura en `teacher.ts`, probada en `test/teaching.test.ts`): aplica las reglas de los tres niveles y la prioridad. Devuelve 1–2 subtemas para todo el curso, los grupos (máx. 6, repartidos parejo) y la lista de estudiantes para atender uno a uno.
- [x] `getClassTeachingPlan` lee los agregados por subtema y las últimas 150 respuestas de cada estudiante, que bastan para la confianza y el análisis de ítems sin pasar el límite de lecturas de Convex.
- [x] `/teacher/$classGroupId` abre con "Esta semana con todo el curso", "En grupos pequeños" y "Uno a uno", cada uno con su porqué. "Uno a uno" reemplaza a "Necesitan atención" y agrega una pregunta para abrir la charla (`conversationOpener`).
- [x] Análisis de ítems (`classItemAnalysis`): las 5 preguntas que más falla el curso, con al menos 3 respuestas cada una. Muestra el enunciado, las opciones, la correcta y la trampa más elegida resaltada.
- [x] ~~El informe "Lo que más le cuesta al curso" se ordena por la prioridad.~~ Ya no hace falta: la prioridad vive en el plan de la semana, y el informe queda como la foto completa por subtema.

### F39 · Grupos flexibles · ✅
- [x] Los grupos se arman solos por la necesidad compartida (nivel 2, máx. 6, repartidos parejo) y se rehacen con cada plan semanal.
- [x] Dentro de un ciclo (F42), el docente quita o agrega estudiantes a cada grupo (`teacher.setCycleGroup`). Un tema nuevo entra al ciclo con hoy como punto de partida.
- [x] Se imprime con el informe del curso.


### F40 · Asignaciones · ✅
- [x] Tabla `assignments` (curso, tema, `practica` de 10 o `tiquete` de 3, estudiantes opcionales, fecha límite por defecto de 7 días o 1 día), y `sessions.assignmentId`.
- [x] El docente asigna con un clic desde el plan de la semana: "Asignar práctica al curso", "Tiquete de salida" y "Asignar práctica al grupo". "Tareas asignadas" muestra cuántos la hicieron, cuántos van en curso y el acierto, y deja quitarla.
- [x] El estudiante la ve primero en Hoy ("De tu profe") y la empieza o continúa. `createSession` valida que sea para él y fija tema, número de preguntas y corrección: la práctica al momento, el tiquete al final.
- [x] La landing y `/privacidad` ya dicen que el docente asigna práctica y que nunca califica ni ve respuestas en vivo. **Pendiente del dueño:** revisión legal de esa frase en los términos.


### F41 · Guía de clase por subtema · ✅
- [x] Guía generada con IA, cacheada para todos (`classGuides`, `lessons.requestClassGuide`): objetivo, error típico, "Yo lo hago / Lo hacemos juntos / Lo haces tú" y 3 preguntas socráticas para discutir. Marcada "Escrita con IA: revísala".
- [x] `/teacher/guia/$subtopicId?curso=…`, imprimible: con el curso, agrega "La trampa de tu curso" (la pregunta que más falló, con sus opciones) para la votación en parejas. El tiquete de salida se asigna desde el plan.
- [x] Solo el personal docente puede pedir una guía (gasta presupuesto del modelo).
- [ ] Reportar un error en la guía: no está. El docente puede regenerarla cambiando `CLASS_GUIDE_PROMPT_VERSION`. Se agrega cuando haya uso real.


### F42 · Ciclo y reevaluación · ✅
- [x] `classCycles`: "Empezar un ciclo de 2 semanas" congela el plan (temas para todo el curso y para grupos, con cuántos estaban por debajo de Familiar). El panel muestra la tabla "al empezar / hoy" por tema (`belowFamiliar`) y dice cuándo terminó.
- [x] `/school` muestra el último ciclo de cada curso con su antes y después (`listSchoolCycles`, que lee solo agregados para que un colegio entero quepa en una consulta).
- [x] El informe por competencia ICFES (F35) está en el mismo panel e imprime con él.


**Listo cuando (pista docente):** un docente entra el lunes y en menos de un minuto sabe qué enseña a todo el curso, a qué grupo dedica 15 minutos y con quién debe hablar. Dos semanas después ve si funcionó.

---

## Revisión independiente (2026-10-29)

Dos revisores leyeron el diff completo sin las conclusiones de quien lo construyó. Se corrigió todo lo confirmado:

- **Integridad.**
  - El tiquete de salida no abre el tutor (`canUseTutor` con `feedbackMode`). Una práctica que corrige al final mide.
  - El docente no lee respuestas de sesiones abiertas (`recentSettledAnswers` filtra con `settledAttempts`).
  - Solo los docentes del curso, o el administrador del colegio, asignan, editan grupos o empiezan ciclos (`requireClassGroupWriter`). Los ids de estudiantes ajenos al curso se descartan.
- **Pedagogía.**
  - Estudiar el mismo tema varias veces el mismo día no lo espacia: con todo bien antes de su fecha, el tema conserva su caja.
  - Lo que asigna el docente abre aunque el estudiante no se haya nivelado.
  - Las preguntas que el estudiante dejó en blanco cuentan como vistas para el repaso.
- **Rendimiento.**
  - Los ciclos leen solo agregados.
  - La lectura de respuestas bajó a 100 por estudiante.
  - El contador del repaso sale de los agregados.
- **Web.**
  - Los atajos de teclado no responden detrás del tutor.
  - La primera respuesta de un chat sí se lee en voz alta.
  - El micrófono y la voz se apagan al cambiar de pregunta o cerrar el tutor.
  - La guía fallida tiene "Reintentar".
  - El plan y la guía muestran el error en vez de cargar sin fin.
  - Reiniciar un ciclo pide confirmación.
  - La hoja del tutor es un diálogo (Escape la cierra).
  - Las etiquetas accesibles son únicas.
  - Las tablas se desplazan en el teléfono.
  - Copia corregida.
  - `/privacidad` menciona la carrera y el dictado del navegador.

## Cómo sabemos si funcionó

Se calcula con las tablas que ya existen (`sessions`, `attempts`), sin herramienta de analítica nueva:

| Métrica | Fase que la mueve |
|---|---|
| % de registrados que terminan su primera nivelación | onboarding, F30 |
| Sesiones por estudiante por semana y retorno a 7 días | F31, F32, F33 |
| Acierto en la segunda pregunta del mismo subtema después de un error | F31, F34 |
| Transiciones de dominio por semana (Familiar → Competente) | F31, F34 |
| Acierto en preguntas hermanas del repaso frente a la original | F34 |
| % de estudiantes con rango de puntaje global | F35 |
| Docentes que abren el panel cada semana | F38 |
| % de asignaciones completadas a tiempo | F40 |
| Cambio en "por debajo de Familiar" por subtema enseñado en un ciclo | F42 |

## Decisiones tomadas (2026-10-29)

- **Acierto con ayuda del tutor:** cuenta para el acierto, pero no sube a Competente.
- **Temario:** se une a Ruta como "ver todo el temario".
- **El docente puede asignar práctica:** sí, solo práctica. Sin calificar y sin ver respuestas en vivo. Hay que actualizar la landing y los términos.
- **Orden:** F30, luego F38, luego el resto.
- **Por defecto, hasta que se diga otra cosa:** meta semanal en minutos, sin selector de dificultad, umbrales 40 % / 15 % con mínimo 5 estudiantes.
- **Tutor por voz:** el audio no se guarda.

## Decisiones (registro de lo que se preguntó)

1. **Un acierto con ayuda del tutor, ¿cómo cuenta para el dominio?** Recomendado: cuenta para el acierto, pero no para subir a Competente (al estilo Khan).
2. **¿Unir Temario a Ruta?** Recomendado: sí.
3. **¿Qué meta semanal se queda?** Recomendado: minutos.
4. **¿Quitar el selector de dificultad?** Recomendado: sí; el Elo ya ajusta la dificultad.
5. **¿El docente puede asignar práctica?** Hoy el panel es de solo lectura, y la landing lo promete así (F40). Recomendado: sí, pero solo práctica, sin ver respuestas individuales en vivo ni calificar. Hay que actualizar la landing y los términos.
6. **Umbrales de los niveles (40 % / 15 %, mínimo 5 estudiantes con evidencia).** Recomendado: arrancar con estos y ajustarlos con los primeros colegios piloto.
