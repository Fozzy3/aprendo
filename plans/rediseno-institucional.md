# Plan: rediseño institucional y SaaS para colegios

> Este tracker reemplaza la dirección visual v2 (violeta, dorado, Nico, sombras duras) y adelanta la Fase 18 de
> `plans/redesign.md`. Las fases siguen numeradas desde la 19.
> Se decidió el 2026-10-10. Fases 19-24 construidas el 2026-10-12 en la rama `refactor/fase-19-limpieza`, sin commit.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Cliente | **Colegios (B2B) primero.** El colegio compra, y estudiantes y docentes usan. B2C queda para después, sobre el mismo modelo. |
| Marca | **Co-branding.** La identidad es Aprendo, más el escudo y el nombre del colegio en la cabecera y en los informes. No hay color por colegio. |
| Gamificación | **Sin disfraz.** Se van Nico, las sombras duras "presionables", el dorado y los emojis por área. La racha y el dominio se quedan como señales académicas sobrias ("días de estudio", "nivel de dominio"). |
| Mundo visual | **Cuaderno cuadriculado** (sorteo `6ffabd95`, elegido por el usuario). |
| Arquitectura | Sin reescritura. Se hace limpieza, se corrigen tres bugs y se añade la capa multi-tenant mínima. |

---

## 1. Brief de diseño

**Trabajo y audiencia.** Hay tres visitantes, todos en modo *Operate*:
- **Estudiante de 11°:** en el teléfono, en sesiones cortas y con ansiedad por el examen.
- **Docente o coordinador:** en un computador del colegio, revisa un curso de 30-40 estudiantes.
- **Rector o comprador:** llega a la landing, que es el único modo *Persuade*.

**Resultado.** Cada quien debe salir con una respuesta:
- El estudiante sabe qué estudiar hoy y en qué nivel ICFES está por área.
- El docente sabe qué estudiantes y qué competencias están en riesgo.
- El colegio ve el producto como **suyo** (co-branding) y como algo serio.

**Dirección: Cuaderno cuadriculado.** El cuaderno de cuadros de 5 mm que todo estudiante colombiano lleva, como instrumento de trabajo y no como disfraz.

*Tesis.* Una retícula que todo respeta, más un margen rojo donde vive el juicio del docente.

*Mundo propio.*
- Papel blanco frío. Nada de crema.
- Rayado azul pálido de 5 mm, visible **solo** en hojas de trabajo: resolver y repaso.
- Tinta azul marino para el texto. Grafito para las marcas del estudiante.
- Rojo de margen para errores y notas del docente. Verde tinta para lo correcto.
- La etiqueta de portada ("Colegio · Curso · Estudiante") es el lugar del co-branding.

*Paleta de referencia:* `#FBFCFE` papel · `#C9D8EA` rayado · `#16233F` tinta · `#C3352B` margen · `#2E6B45` verde. Los valores finales se miden en la Fase 21.

*Lo que cada challenger aportó* (cada aporte es una regla, no un adorno):
1. **Jerarquía solo por escala tipográfica.** No hay chrome de tarjeta ni sombras decorativas (aporte del espécimen tipográfico).
2. **La retícula es el módulo real de layout.** Todo cae en celdas, y mostrar la cuadrícula es un estado, no un fondo fijo (aporte de Crouwel).
3. **El tiempo se dibuja exacto.** En los informes de ritmo, el largo de una barra es el número de segundos por pregunta (aporte de la labanotación).
4. **En resolver, una pregunta ocupa la hoja** y la siguiente ya está cargada (aporte del feed vertical).
5. **Controles rectangulares.** El primario es tinta llena; el secundario, un contorno de 1 px. Sin píldoras (aporte del anuario de diseño).

*Primer viewport (Hoy).* Arriba a la izquierda va la etiqueta de portada con el escudo del colegio. Debajo, el plan de hoy en renglones numerados dentro de la retícula. La columna de margen lleva fecha y nivel. La acción primaria, "Empezar", está en el primer renglón.

*Riesgo honesto.* Si se aplica flojo, termina en "disfraz de cuaderno escolar" infantil. El antídoto es la disciplina: la cuadrícula visible solo donde se trabaja, cero ilustraciones de espiral, cero fuentes manuscritas.

**Alcance.** Cubre todas las pantallas del estudiante, la landing, el login y el admin, y suma dos superficies nuevas: el panel docente y la administración de la institución. Se conservan:
- el contenido, el copy en español con tuteo y todos los flujos;
- la ADR 0001 (resolver y revisar en pantallas separadas);
- el pasaje al lado de la pregunta;
- el atajo de teclado A-D.

**Anti-objetivos:**
- No es el LMS genérico azul con tarjetas (Canvas o Moodle).
- No es el tablero corporativo de KPIs.
- Nada infantil: ni stickers, ni espirales, ni letra a mano.
- Ningún número sin evidencia (este principio de PRODUCT.md se mantiene).

**Estados y rangos que hay que diseñar:**
- Curso de 0, 1, 35 y 120 estudiantes.
- Estudiante sin nivelación.
- Simulacro de 134 preguntas.
- Colegio sin escudo: el fallback es el nombre en texto.
- Colegio con licencia vencida.
- Docente con dos colegios.

**Restricciones:**
- Primero el teléfono para el estudiante; primero el escritorio para el docente.
- Contraste mínimo de 4,5:1.
- `prefers-reduced-motion`.
- Modo oscuro (cuaderno de noche: papel tinta y rayado tenue).
- La demo de lecciones hereda los tokens (`lib/demo-document.ts`, `DEMO_FRAGMENT_RULES` de `lessons.ts`). Al cambiar la tipografía hay que subir `PROMPT_VERSION`.

**Decisiones tomadas al construir** (el usuario delegó: «lo que consideres mejor», «finalízalo»):
1. Fuentes: **Source Serif 4** para títulos y cifras (la voz del boletín y el acta) y **Public Sans** para el trabajo, con cifras tabulares. Ninguna está en la lista vetada.
2. El rojo del docente y el de error son **un solo token** (`--margin` = `--danger`).
3. Notas del docente en el margen del estudiante: **no se construyen** (opcional; el docente solo lee). Se añaden si un colegio lo pide.
4. La tabla `students` **no se renombra**: se documenta como "cuentas".

---

## 2. Revisión de arquitectura (verificada)

**Veredicto.** El núcleo está sano. Hay unos 15 módulos puros con tests (`elo`, `mastery`, `pacing`, `sessionIntegrity`, …), la web los importa desde `@aprendo/convex/*` sin copiarlos, y hay un solo guard de propiedad, `assertOwnsStudent` (40 usos). Lo que falta es limpieza, tres bugs y el concepto de tenant.

Verifiqué personalmente lo siguiente:
- 43 de 48 archivos de `ai-elements` están muertos.
- `query('questions').collect()` aparece en `sessions.ts`, `pdfs.ts:514` y `explanations.ts:110,264`.
- `onDelete` solo borra la fila `students` (`auth.ts:69-74`).
- `requireEmailVerification: false` y localhost en `trustedOrigins` (`auth.ts:16,88`).
- `getSubjectIdForSubtopic` está duplicado y no coincide: devuelve `null` en la web y `undefined` en convex.

### Bugs y riesgos
| # | Problema | Arreglo | Esfuerzo |
|---|---|---|---|
| B1 | Barrido del banco completo al crear sesión (`selectRecommended`, `loadPracticeBank` sin alcance). Convex corta en ~16k docs / 8 MiB por transacción, así que `createSession` va a fallar cuando el banco crezca. | Leer por índice `by_subjectId_eligibility`, igual que `collectUsableQuestionsBySubject`. | S-M |
| B2 | Borrar una cuenta deja huérfanos: sesiones, intentos, agregados e hilos. Con menores de edad y colegios, eso choca con la Ley 1581. | Una `internalMutation` de borrado en cascada. | S |
| B3 | Registro abierto sin verificar el email, y localhost confiable también en producción. | Exigir verificación y añadir localhost solo si falta `SITE_URL`. | S |
| B4 | `.collect()` de todos los intentos del estudiante en rutas calientes. | Por ahora solo vigilarlo. Más adelante, un resumen por estudiante. | M |

### Código muerto
- 43 archivos de `components/ai-elements` (solo se usan `artifact`, `conversation`, `message`, `prompt-input` y `shimmer`).
- 12 primitivas de `components/ui` sin ningún import, junto con sus deps `@radix-ui/*`.
- La ruta `routes/dashboard.tsx` (redirect huérfano).
- Funciones públicas sin llamador: `getPdfUploadDetail`, `getLatestSimulacroScore`, `getCurrentStudentAppState` y `listArtifactsForThread`.
- `listQuestionReports` y `resolveQuestionReport` no tienen pantalla. Se les da una en el admin (Fase 22).
- El placeholder `expect(true)` en `web.test.ts`.

### Nombres y límites
- **Regla nueva:** identificadores en inglés y sustantivos del dominio ICFES en español (`nivelacion`, `simulacro`, `repaso`). Se documenta como glosario en `DATA_MODEL_SPEC.md`. Los enums guardados **no** se renombran, porque eso exige una migración y no paga.
- **Renombres baratos (S):**
  - En `students.ts`: `hasCompletedDiagnostic` → `hasPlacement`, `activeDiagnosticSessionId` → `activePlacementSessionId` y `latestCompletedDiagnosticId` → `latestPlacementSessionId`.
  - `summarize` → `toSessionSummary`.
  - `lib/useAnswerQueue.ts` → `use-answer-queue.ts` y `lib/useSessionTimer.ts` → `use-session-timer.ts`.
  - Los default exports (`BrandMark`, `ThemeToggle`, `ReviewTutor`, `MarkdownBlock`) pasan a named exports.
- **Taxonomía duplicada:** se exporta `./taxonomy` desde `packages/convex` y se borra `apps/web/src/lib/taxonomy.ts`.
- **Límite de ingest roto:** convex importa `../../ingest/src/...` y existe el barrel `ingest/src/index.ts` (prohibido por las convenciones). Se pasa a `exports` por módulo y se borra el barrel.
- **Archivos gigantes, a partir cuando se toquen:**
  - `sessions.ts` (2094 líneas) se divide en `sessionSelection.ts` y `sessionCompletion.ts`.
  - `SessionSolve.tsx` (989 líneas) se divide con `useExamTools` y `useIntegrityReporting`.
- **AGENTS.md desactualizado:** nombra las rutas `/upload-pdfs` y `/questions`, que no existen, y enlaza a `/Users/julian/...`.

### Multi-tenant mínimo (se mantiene lo simple)
- **Global** (banco compartido, operado por el equipo de Aprendo): `questions`, `questionGroups`, `pdfUploads`, `conceptLessons`, `questionAnswerStats` y la triage de `questionReports`.
- **Por tenant por herencia:** todo lo que cuelga de `studentId` (sesiones, intentos, agregados, tutor, `llmUsage`). **No lleva `orgId`.**
- **Tablas nuevas:**
  - `organizations { name, slug, crestStorageId?, plan, seatLimit, licenseEndsAt }`
  - `memberships { orgId, accountId: v.id('students'), role: 'student'|'teacher'|'org_admin' }`, con índices `by_accountId` y `by_orgId_role`.
  - `classGroups { orgId, name, grade, inviteCode }` y `classGroupMembers`.
- **Separar el guard:**
  - `assertCanViewStudent`: el propio estudiante, o un docente o org_admin de su misma institución. Va en las queries.
  - `assertIsStudent`: solo el propio estudiante. Va en las mutations.
  - **Motivo:** si se ensancha el guard actual, un docente podría responder exámenes por el estudiante.
- `requireAdminStudentId` → `requirePlatformAdmin`, y `sessions.ts:2050` pasa por ese helper.
- `LLM_DAILY_LIMITS` depende del plan. Ese es el punto de enganche del cobro, sin pasarela.
- **Tests de autorización** con `convex-test`, antes de tocar los guards. Hoy ningún handler tiene tests.

> **Decisión abierta (recomendación incluida):** la tabla `students` es en realidad "cuentas". La recomendación es **no renombrarla**: hay `studentId` en todas las tablas y Convex no renombra tablas. Se documenta como "cuenta" y el rol vive en `memberships`. La alternativa es una tabla `accounts` nueva más una migración (L): el nombre queda más claro, pero toca todo el esquema.

---

## 3. Fases

### Fase 19: Limpieza y fundamentos · ✅
Va primero porque reduce lo que hay que re-estilizar y deja los guards con tests.
- [x] Código muerto: 43 de ai-elements, 12 primitivas ui, 17 dependencias, `dashboard.tsx`, 4 funciones públicas sin llamador, más `latestSimulacroExam` (solo lo usaba una de ellas) y el placeholder de test. Unas 11.400 líneas menos.
- [x] Taxonomía única desde `@aprendo/convex/taxonomy`; se borró `apps/web/src/lib/taxonomy.ts`. Ingest exporta `./*` y se borró el barrel; convex importa `@aprendo/ingest/<módulo>`.
- [x] Renombres: `hasCompletedDiagnostic` → `hasPlacement` (y se borraron `activeDiagnosticSessionId`/`latestCompletedDiagnosticId`, que nadie leía), `summarize` → `toSessionSummary`, hooks a kebab-case, named exports (`ReviewTutor` sigue con default por `lazy()`), `web.test.ts` → `student-queries.test.ts`. Glosario en `DATA_MODEL_SPEC.md`.
- [x] B1: `collectUsableQuestions` (por índice y por área) reemplaza los dos barridos de `sessions.ts`. Test con convex-test.
- [x] B2: `deleteStudentData` (12 tablas) + `deleteAllForUserIdAsync` del agent en `onDelete`. Test con convex-test.
- [x] B3 (parcial): localhost solo es origen confiable si no hay `SITE_URL`.
- [x] B3 completo (en la Fase 20): verificación de email y recuperación de contraseña con Resend (`email.ts`, un `fetch`, sin SDK). Se activan solas cuando el deployment tiene `RESEND_API_KEY`; sin ella, el registro sigue abierto y los correos van al log.
- [x] AGENTS.md: rutas reales y enlaces relativos.
- [x] Verificación: tsc convex/web/ingest en 0, eslint convex en 0. Tests: convex 366, ingest 36, web 123.

**Aprendizajes**
- **`convex-test` llegó antes de lo previsto** (estaba en la Fase 20): TDD estricto lo exige para B1/B2. Está fijado en `0.0.54`, porque desde la 0.0.55 pide `convex ^1.43` y el repo usa 1.33. Bajo bun no existe `import.meta.glob`, así que el mapa de módulos se arma en `test/convexModules.ts`.
- **Las primitivas se importan con extensión** (`../components/ui/resizable.tsx`): una búsqueda de imports que no contemple `.tsx` da falsos "sin uso". `resizable` se borró por error y se restauró, con su dependencia en 4.8.0.
- `shiki` pasó de 4.0.2 a 3.23.0 en el lock: la 4 solo la pedía `code-block` (borrado), y la 3 es el rango de `@streamdown/code`.
- ✅ Ya no leen todo el banco: el backfill de explicaciones y `listExplanationFlags` paginan de a 200 (`explanations.ts`), y `getDiagnosticEligibleQuestionPool` (`pdfs.ts`, sin llamadores) se borró.

### Fase 20: Backend multi-tenant · ✅
- [x] Arnés de auth para `convex-test` (`test/signIn.ts`: registra el componente de Better Auth sin `import.meta.glob`) y tests de guards en rojo primero (`authz.test.ts`, `schools.test.ts`).
- [x] Guards: `assertIsStudent` (toda escritura), `assertCanViewStudent` (lecturas del docente: progreso, tendencias, actividad), `requireOrgRole`, `requirePlatformAdmin`.
- [x] Tablas `organizations`, `memberships`, `classGroups`, `classGroupMembers`; `students.name` desde el registro.
- [x] `schools.ts`: crear colegio (staff), licencia, docentes, cursos, códigos, asignar docentes, quitar miembros, escudo, `joinClassGroup` con cupos y licencia validados en el servidor.
- [x] Límite de LLM por plan (`LLM_DAILY_LIMITS` por `individual`/`pilot`/`school`, `llmPlanFor`).
- [x] `teacher.ts`: `listMyClassGroups`, `getClassOverview` (nivel por área con `buildSubjectLevels`, razones de riesgo), `getCompetencyReport`.
- [x] El docente aterriza en `/teacher` (`defaultRoute`), el borrado de cuenta incluye membresías, borrado de cuenta autoservicio (`deleteUser`).
- [x] `addOrgAdmin` (staff): nombrar otro administrador si el único se va.
- [x] Atribución por pregunta (`questionSource.ts`: «ICFES · cuadernillo» o «escrita por Aprendo con IA»).

### Fase 21: Identidad "Cuaderno" · ✅
- [x] `PRODUCT.md` reescrito (colegio, docente, estudiante, comprador).
- [x] Fuentes en `styles.css`, `demo-document.ts` y `DEMO_FRAGMENT_RULES`; `PROMPT_VERSION` v7 → v8.
- [x] Tokens: papel, rayado, tinta, grafito, margen, verde, `--cell`; radios 2-4 px; sin dorado, sin sombras duras, sin degradados, sin `translateY` presionable.
- [x] `.sheet` (retícula + margen rojo) solo en resolver, revisar y las hojas de acceso.
- [x] Controles rectangulares; `.card` pasa a sección con regla; gramática de página (`.ruled-page`, `.ruled-section`, `.plan-lines`, `.data-table`).
- [x] Sin emojis (áreas, confianza), sin `Mascot.tsx` (→ `EmptyState`), `BrandMark` nuevo (una celda con margen) y `SchoolLabel`.
- [x] Contrato de dirección en `__root.tsx`.
- [x] 93 reglas CSS muertas borradas (~570 líneas).

### Fase 22: Pantallas del estudiante · ✅
- [x] Resolver: hoja centrada con retícula, número en el margen (encerrado al marcar), tachado en lápiz, la imagen de la siguiente pregunta precargada.
- [x] Hoy: columna de margen (fecha, días de estudio, racha como "días seguidos") y el plan en renglones numerados con "Empezar" en el primero.
- [x] Revisar: hoja con retícula, clave con chulo verde, error con × rojo, explicación del distractor como nota al margen.
- [x] Simulacro: barras de ritmo con la duración exacta en escala común y marca del ritmo oficial.
- [x] Progreso, Historial, Ruta, Temario, Lección, el hub de práctica, la nivelación y sus resultados: rehechos con la gramática de página (margen con datos, secciones con regla, tablas `.data-table`, listas en renglones). Sin degradados, cursivas, kickers, píldoras ni rellenos suaves. 129 reglas CSS muertas borradas y `RingProgress.tsx` eliminado.
- [x] Admin: cola de `questionReports` y pestaña Colegios (licencias).
- [x] Login con nombre, verificación de correo, "olvidé mi contraseña" y regreso a la página de origen (`safeNext`); `/reset-password`; `/cuenta`.
- [~] Revisión visual: capturas headless de landing, login y legal (escritorio, teléfono, oscuro). Las pantallas con datos no se capturaron: no hay backend local (ver Pendientes).

### Fase 23: Panel docente e institución · ✅
- [x] `/teacher`: cursos por colegio (docente con dos colegios), estados vacíos.
- [x] `/teacher/$classGroupId`: código del curso, necesitan atención, estudiantes × áreas (nivel y evidencia, "—" sin evidencia), por competencia; licencia vencida.
- [x] `/teacher/student/$studentId`: vista de solo lectura del estudiante.
- [x] `/school`: nombre y escudo, licencia y cupos, cursos (crear, código, regenerar, asignar docentes, eliminar), docentes, estudiantes.
- [x] `/join`: código a mano o por enlace `?codigo=`.
- [x] Tests de las pantallas nuevas: `apps/web/src/tests/staff-routes.test.tsx` (unirse, cuenta, panel docente, curso, colegio). Destapó y arregló un error silencioso al quitar un docente en /school.
- [ ] (Opcional, no construido) notas del docente en el margen.

### Fase 24: Landing y cierre · ✅
- [x] Landing para rectores: qué mide, qué ve el docente (y qué no puede hacer), procedencia de las preguntas, datos de menores, contacto (`VITE_CONTACT_EMAIL`). Sin precios.
- [x] `/terminos` y `/privacidad` (Ley 1581, menores, terceros reales: Convex, OpenRouter, Resend).
- [x] `DESIGN.md` reescrito desde lo construido.
- [x] `AGENTS.md`, `ARCHITECTURE_SPEC.md` y `DATA_MODEL_SPEC.md` (§7) con tenants y roles.

### Pendientes que dependen del dueño
- **Configurar en producción:** `RESEND_API_KEY` y `EMAIL_FROM` (dominio verificado en Resend) en Convex; `VITE_CONTACT_EMAIL` en la web.
- **Revisión legal** de `/terminos` y `/privacidad`: falta la razón social, el NIT y un canal de contacto del responsable del tratamiento.
- **ICFES y uso comercial:** la decisión previa (Fase 18) fue usar ítems del ICFES solo en un nivel gratuito con atribución. Venderle a un colegio acceso a esos ítems puede chocar con sus términos: confirmarlo antes de cobrar, o tener listo el banco propio (Fase 17, G28).
- **Prueba visual con datos:** correr `bun run dev` contra el deployment de desarrollo y revisar resolver, revisar, Hoy, panel docente y colegio en escritorio y teléfono.

---

## 4. Riesgos

- **El disfraz de cuaderno.** Se mide en la revisión final: si una captura sin contenido parece una plantilla "escolar" infantil, se re-hace.
- **Duplicar la tabla `students` como cuentas** confunde a quien lea el código. Mitigación: el glosario y nombres de helpers explícitos.
- **El banco chico frente a la promesa B2B:** Matemáticas tiene ~44 preguntas usables. El banco original (Fase 17 G28) sigue siendo un requisito para vender.
- **`styles.css` (5619 líneas):** la re-tokenización llega a casi todo, pero las clases de componentes borrados deben salir en el mismo cambio.
