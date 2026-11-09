# Plan: reconstrucción del front, gamificación, estudio socrático y auditoría del banco (F50–F77)

> Plan aprobado el 2026-11-08. Reemplaza la dirección visual de `plans/rediseno-institucional.md` para las pantallas del estudiante.

## Contexto

Un docente que probó Aprendo la llamó "ladrillada": rígida, plana, con demasiado texto, "una prueba impresa pegada en lo digital", demasiado universitaria para jóvenes de 15–16 años. Sugirió íconos, metas, medallas, ranking y rachas al estilo Duolingo, desde grado 6, y nombró los Martes de Prueba de Milton Ochoa como referente escolar. El dueño quiere opciones más simples, una imagen moderna, gamificación real, un avatar, menos texto, competencia fácil y una auditoría una por una de cada pregunta, imagen y respuesta, además de un pipeline correcto para los bancos futuros.

**Decisiones del dueño (finales):** look de estudiante joven pero creíble, con docente, colegio e impresión que siguen sobrios · liga semanal del curso por esfuerzo · auditar los ítems ICFES y construir un banco original para todo lo que sea de pago · prechequeo con IA y firma de docentes de área pagos · **estudiar a través de preguntas: guía socrática primero, nunca la respuesta entregada de forma directa.**

**"Reconstruir" significa todo el front, cada pantalla de cada rol** (ver Mapa final de pantallas). El backend en Convex, el motor de aprendizaje y el modelo escolar se quedan.

**Tiempos:** el Calendario A de 2026 ya pasó, así que esta es la ventana antes de que los colegios planeen 2027. El memorando de la junta dice que el banco original debe existir en el primer semestre de 2027 o se pierde el ciclo 2027.

## Por qué ocurre cada queja (verificado en el código)

| Queja | Causa hoy | Fase |
|---|---|---|
| "Prueba impresa pegada en lo digital" | Los enunciados de cuadernillo se muestran como recortes escaneados (`SessionSolve.tsx:785-801`) | F53 |
| Demasiado texto, demasiadas opciones | "Qué practicar" se responde en 5 lugares; `/practice` tiene 7 lanzadores; hasta ~22 controles en una sola pregunta | F51–F53, F56 |
| Plano, rígido | `DESIGN.md` prohíbe tarjetas, sombras, dorado y movimiento al presionar; `motion` está instalado y nunca se importa; no hay ilustraciones | F51 |
| Respuesta entregada, pasivo | Tras "Comprobar", `AnswerFeedback.tsx` muestra de una vez la opción correcta, la justificación y la solución completa; el método socrático solo vive dentro del tutor opcional (`tutor.ts:107`) | F56 |
| Sin recompensa | La racha es un número simple, no hay XP, medallas ni avatar; el cierre de sesión muchas veces no existe (`practice.$sessionId.review.tsx:283`) | F54, F55, F58 |
| Demasiado universitario | `PRODUCT.md:43-59` dice "no es un juego", sin recompensas | F51 lo reescribe |
| Ranking | Rechazado antes (`plans/redesign.md:366`) | F59, F60 |
| Empezar en grado 6 | No hay grado en los estudiantes, las preguntas ni la taxonomía | F70 |
| Martes de Prueba | No hay una prueba de todo el colegio ni recurrente, ni plan de mejora | F67, F68 |

## Fases

**Compuerta de demo = F50–F57 más F71–F76.** Los rectores solo deben ver el banco semilla original. La auditoría (F62–F65) corre en paralelo desde el primer día.

**Orden de construcción:** F50 → F51 → F71 → F52–F57 → F72–F76 → F58–F61 → F67–F70 → F77. La auditoría y el banco original corren en paralelo.

### Frente A: arreglos y demo para rectores

- **F50 Salvaguardas (primero, pequeña).**
  - `setQuestionAnswerResult` borra la clave cuando falla el LLM (`pdfs.ts:357-359`): conservar la clave existente.
  - `upsertBookletQuestions` vuelve a escribir clave y elegibilidad en filas existentes (`booklets.ts:209-211`), lo que desharía una auditoría: evitarlo.
  - Rechazar `retryPdfUpload` cuando existan intentos. Borra filas y deja intentos colgados (`pdfs.ts:184-209`).
  - Validar el `correctOption` del LLM contra las etiquetas del ítem. Preferir "Tabla de respuestas correctas" al interpretar la clave (`icfes-booklet.ts:94`).
  - El script de recorte entrega la página y la coordenada `y`. Corregir la etiqueta de fuente "ICFES · ICFES" y el enlace de `ReportsQueue` (`:77-79`).
- **F51 Look de estudiante y presupuesto de texto.**
  - Reescribir primero `PRODUCT.md` y `DESIGN.md`. Cargar el paquete completo de diseño frontend (CLAUDE.md).
  - Implementar como una capa acotada: `data-look="student"` en `<html>` desde `__root.tsx`, más un `student.css` pequeño que remapea tokens bajo `@media screen`. Sin reescribir `styles.css`; los informes impresos siguen sobrios.
  - Colores vivos por materia, íconos, botones táctiles, íconos PNG/maskable para que la PWA se instale.
  - **Presupuesto de texto (pantallas del estudiante):** una acción principal; título de máximo 8 palabras; máximo 25 palabras antes de la acción; todo lo más largo queda detrás de "Ver más".
- **F52 Navegación, cuatro pestañas.** Hoy (un botón grande, franja de racha/XP/avatar) · Aprende (absorbe Temario y los lanzadores por tema) · Retos (liga, Repaso, Reto, Simulacro) · Yo (avatar, medallas, niveles, historial, cuenta). Quitar los lanzadores duplicados con `launchableFromHub`. La carrera y la fecha del examen pasan al onboarding.
- **F53 Pantalla de resolución.**
  - Texto primero mediante `questions.stemDisplay`; los ítems pasan uno por uno a medida que se auditan. Solo se quedan como imagen las figuras que de verdad se necesitan.
  - El tamaño del texto y el reporte pasan a un menú de más opciones. Agregar estados de presión, bolitas de progreso y animación de correcto/incorrecto.
  - Una respuesta incorrecta no muestra la opción correcta ni la explicación; abre el camino guiado (F56).
  - Los exámenes conservan los sellos (`sealQuestion`, `canCheckAnswers`): no hay indicación de acierto ni XP hasta el cierre. Registrar la excepción `inmediata` existente en el ADR 0002.
- **F54 XP, recompensa y misión diaria.**
  - La sesión principal es de 5 preguntas.
  - `completeSession` calcula `sessions.reward` una sola vez. Solo esfuerzo: tiempo mínimo por respuesta, tope diario, sin que cuente si fue correcta. Terminar un camino guiado da XP; saltar directo a la respuesta no.
  - Orden de la pantalla de cierre: XP, racha, medalla nueva, dominio, puntaje al final.
  - El plan diario suma una "misión cumplida" derivada.
- **F55 Avatar y apodo.** Partes SVG guardadas como ids (sin subir archivos); apodo a partir de listas cerradas de palabras.
- **F56 Estudio socrático (el ciclo central de aprendizaje).** La app enseña preguntando. Aplica solo donde `canCheckAnswers` es verdadero; los exámenes y el Reto conservan sus sellos.

  | Momento | Lo que ve el estudiante |
  |---|---|
  | Antes de responder | "Pista" opcional: una pregunta guía, nunca elimina una opción |
  | Respuesta incorrecta | "Todavía no". Sin opción correcta ni explicación |
  | Diagnóstico | "¿Qué te hizo elegir la B?" con 2–3 razones para tocar, propias de ese distractor |
  | Escalera | Hasta 3 preguntas para tocar (≤ 20 palabras cada una), concretas al concepto, que terminan en una contradicción del distractor elegido |
  | Reintento | Elige de nuevo. Si acierta: "Lo descubriste" |
  | Respuesta mostrada | Solo después de la escalera o de un segundo fallo: 2–3 frases. "Muéstrame" aparece solo después del paso 1 |
  | Cierre | Un toque en "¿por qué funciona?"; un ítem similar vuelve por Repaso (F34) |

  - **Correcta pero con baja confianza** (los chips ya existen): una pregunta "¿por qué?", para que un acierto por suerte se ponga a prueba. Correcta y con confianza: se sigue sin fricción.
  - **La ayuda se desvanece:** la longitud de la escalera sigue a `masteryLevel` (completa en niveles bajos, una sola pregunta en `competente`, ninguna en `dominado`).
  - **Tocar primero, escribir es opcional.** Las guías se tocan, lo que mantiene el presupuesto de texto. "Pregúntale al tutor" agrega texto libre o voz con el mismo método; el tutor no debe nombrar la opción antes de que termine el camino.
  - **Pregeneradas, no en vivo.** Tabla `questionGuides`, una fila por pregunta: revisable por docentes, instantánea, sin costo de LLM por estudiante, funciona con conexiones débiles. Tabla aparte porque `getSession` envía al cliente el documento completo de la pregunta. Una consulta entrega un paso a la vez, solo después de `submitAnswer`, solo para la opción elegida. `checkAnswer` deja de devolver `correctOption` hasta que termine el camino.
  - **La evidencia se mantiene limpia.** Solo la primera respuesta alimenta el dominio y el Elo. El camino registra `questionAttempts.guidedOutcome` (`self_corrected` o `revealed`) sin cambiar `isCorrect`. Los docentes ven por ítem cuántos necesitaron que se les revelara la respuesta.
  - **Revisión.** Los ítems incorrectos ofrecen "Descúbrelo" primero, con la respuesta a un toque (el ADR 0001 sigue mostrándola). "Repetir las que fallé" corre en modo guiado.
  - **Las lecciones se vuelven preguntas.** `lessons.ts` genera 3–5 pasos (≤ 40 palabras): cada uno abre pidiéndole al estudiante que prediga y luego muestra por qué. Las lecciones viejas en caché se siguen mostrando. "Escuchar" reutiliza `lib/speech.ts`.
- **F57 Compuerta de nivel y semilla.** `questions.bankTier`, filtro en todos los puntos de llamada del pool y en las dos re-verificaciones de `isInEligibilityPool`, 100 ítems originales (20 por área) con guías, organización demo.

### Frente B: enganche

- **F58 Racha, medallas, primera semana.** Un solo `streakFrom()` reemplaza las copias en `today.ts` y `history.ts`. Los escudos se recalculan de forma determinista (se gana 1 cada 7 días activos, se guardan hasta 2, se gastan solos), así que no hay tabla ni cron. Las medallas se derivan de `sessions.reward`. Ruta de siete días para la primera semana con un paso de compromiso (la ventana más frágil de Duolingo).
- **F59 Liga semanal del curso (la versión fácil).** Automática, sin configuración: una franja en Retos, ±2 vecinos, se reinicia cada semana, por XP de esfuerzo. Reglas en G2/G3.
- **F60 Duelo en vivo del curso (nuevo).** El docente inicia un juego por equipos de 10 minutos en el proyector; los estudiantes entran desde un banner en Hoy mediante la reactividad de Convex. Equipos balanceados automáticamente, solo puntaje por equipo, sin resultados individuales públicos. No escribe `questionAttempts`, así que el dominio se mantiene limpio, y en la V1 no da XP. Tablas: `classDuels`, `duelAnswers`.
- **F61 Medición.** Consulta de admin para el retorno al día 7, sesiones por semana y actividad del cuartil inferior; liga activada o desactivada por curso. Si el cuartil inferior baja, se desactiva.

### Frente C: auditoría una por una (arranca en paralelo con F50)

Etapas para cada pregunta:

| # | Etapa | Salida |
|---|---|---|
| 1 | Inventario: conteo real por fuente, historial semilla con la clave actual | `pending_checks` |
| 2 | Fuente: página del cuadernillo y coordenada `y`; página del OCR por coincidencia aproximada; guardar la imagen de la página | `source` |
| 3 | Chequeos deterministas (abajo) | `checks` |
| 4 | Visión: imagen de la página frente al enunciado guardado, las opciones y el recorte; ¿la figura es necesaria y legible? | `vision`, `stemDisplay` propuesto |
| 5 | Resolución a ciegas con dos modelos, de proveedores distintos, con imágenes incluidas (`inferQuestionAnswer`) | `solvers` |
| 6 | Reetiquetado de taxonomía, escribiendo solo la taxonomía (17 de 25 de la muestra tienen baja confianza pero son diagnósticas) | reemplaza la suposición por palabras clave |
| 7 | Función pura `auditDecision()` | `needs_review`, `auto_passed`, `rejected` |
| 8 | Muestra estratificada de las aprobadas automáticamente, mínimo 60 por área | `sampled` |
| 9 | Firma del docente | `approved`, `fixed` |
| 10 | Publicar y reparar | `eligibility`, intentos |
| 11 | Guías socráticas, solo después de aprobar la clave (una guía construida sobre una clave equivocada enseña el error) | `questionGuides` |

Chequeos de las guías: primero los deterministas (sin la etiqueta ni el texto de la opción correcta, una pregunta por paso, límites de palabras); luego un segundo modelo recorre cada camino y debe llegar a la clave; los docentes aprueban las guías marcadas más una muestra.

- **Chequeos deterministas, antes de cualquier LLM:** clave presente y dentro de las etiquetas; clave impresa vuelta a interpretar; cantidad de opciones válida; opciones vacías o duplicadas (atrapa opciones que son figuras y que el recorte no capturó); menciona una ilustración pero no tiene imagen; errores de KaTeX; elementos fijos de la página; rango del grupo frente a `memberCount`; las URL resuelven; sanidad del recorte; enunciados duplicados; ids de taxonomía válidos.
- **F62** Inventario y chequeos deterministas. **F63** Visión y resolución; corregir la pérdida de imágenes (`guessImageMediaType`, `toEnrichmentQuestion`, `stemImages`/`contextImages` sin leer); tratar los 193 recortes huérfanos y las preguntas con figura descartadas.
- **F64 Interfaz del revisor.** Nueva pestaña `audit` en `admin.tsx` y `components/admin/AuditQueue.tsx`: imagen de la página junto a la pregunta renderizada, chips de chequeos, respuestas de los modelos, historial de la clave; aprobar/corregir/rechazar con atajos. `requireReviewer(ctx, subjectId)`. Pago = conteo por revisor. Los reportes abiertos devuelven el ítem a `needs_review`.
- **F65 Publicar y reparar.**

| Resultado | Pregunta | Intentos | Datos del estudiante |
|---|---|---|---|
| Clave equivocada | Clave nueva más historial | Recalcular `isCorrect`, conservar `selectedOption` | Recalcular `sessions.summary`, programar `rebuildStudentProgress` por estudiante |
| Defectuosa | `excluded` más `voidedAt` | Sin cambios | La reconstrucción la omite; la revisión muestra un aviso |
| Errata o taxonomía | Corregida | Sin cambios | La reconstrucción la reclasifica |

Reglas: nunca se borra una fila ni se pone una clave en nulo. Una clave impresa nunca cambia sola: que los dos modelos discrepen la sube al primer lugar de la cola, y un cambio necesita docente más admin. Las fallas graves sacan la pregunta del pool de inmediato. Límite aceptado: las transiciones de Elo y de dominio no se revierten por un solo ítem.

**El banco actual recibe revisión humana al 100%**, porque todas las áreas están por debajo del mínimo de 60 ítems. Después del lanzamiento, marcar los ítems con n ≥ 30 donde la opción más elegida difiere de la clave (`questionAnswerStats`).

**Costo.** Horas humanas = (F·N + max((1−F)·N·s, 60·áreas)) × 3 min. Unos 213 ítems ≈ 11 h (213 sale de la documentación y no está verificado). N=2.000, F=0.25, s=0.1 ≈ 40 h. El costo de la IA no está medido; correr primero un piloto de 20 ítems.

**Bancos futuros:** todo cargador inserta `eligibility: 'pending'` más una fila de auditoría, así que nada llega a los estudiantes sin pasar la etapa 10.

### Frente D: banco original

- **F66 Pipeline de autoría, ~2.000 ítems.** `docs/bank-blueprint.v1.json` por materia, subtema, competencia, dificultad, `targetGrade`, ponderado por los cupos oficiales. El generador nunca lee filas ICFES, y las paráfrasis están prohibidas. Compuerta determinista de similitud por shingles frente a las filas ICFES. Pasajes originales o de dominio público, con la licencia registrada. La misma auditoría menos la comparación con la fuente, con una guía para cada ítem; un desacuerdo entre los modelos y la clave rechaza el ítem. Inglés primero: la ruta de cuadernillos no tiene ninguno, y el simulacro necesita 55.

### Frente E: colegios

- **F67 Prueba periódica del colegio.** Ronda `schoolTests`, forma fija, una asignación por curso, nuevo tipo de sesión `prueba` con el sellado del simulacro; N rondas creadas por adelantado, sin crons. Informe por curso y área en cuestión de días (tiempo de respuesta publicado por Milton Ochoa: 3–5 días).
- **F68 Plan de mejora.** "Generar plan" a partir de la evidencia de la ronda, extendiendo `classCycles` con `schoolTestId` y `actions`; la siguiente ronda es el "después".
- **F69 Mensaje semanal a las familias.** Un botón: copiar un mensaje semanal genérico para el grupo de WhatsApp del docente. No se guardan datos de los padres, y la prueba en Brasil encontró que lo genérico funcionó casi igual que lo personalizado.
- **F70 Base para el grado.** `students.grade`, `questions.targetGrade`, selector de 6–11. La taxonomía y el contenido por grado para 6–9 quedan aplazados; el grado 9 es la primera expansión real.

### Frente F: el resto del front

- **F71 Shells y lo global.**
  - Roles: `/app` envía al admin de la plataforma a `/admin`, al revisor a la pestaña de auditoría, al docente u `org_admin` a `/teacher`, y a los demás al estudiante. Agregar un cambiador de rol para usuarios con varios roles; ambos shells enlazan a Cuenta y Salir. `useStudentGuard` exime al personal. `SchoolLabel` usa el colegio del rol activo.
  - `/admin` pasa a `StaffShell`; `/diagnostic` usa el marco del estudiante. `AuthFrame` es solo para páginas públicas.
  - Agregar 404 y error boundaries con marca; agregar una rama de error en `/app`.
  - Un solo toast (a partir de `.solve-toast`) y un solo `ConfirmDialog` (el diálogo Radix existente) reemplazan los 5 `window.confirm`.
  - Borrar los exports muertos de `ai-elements`/`ui`, el comentario oculto en `__root.tsx`; traducir ThemeToggle; confirmar que las devtools se quitan de producción.
- **F72 Público.** Landing reescrita para rectores con capturas reales de la app nueva; login, restablecimiento y textos legales con el estilo nuevo; `/privacidad` cubre liga, avatar y acudientes; og:image, sitemap y canonical; reemplazar el "15" fijo en el código.
- **F73 Cuenta.** `/cuenta` dentro del shell, agrega editar nombre, cambiar contraseña, exportar datos (`/privacidad` promete acceso) y Salir.
- **F74 Docente.** Se mantiene sobrio y se simplifica. La página del curso se divide en tres pestañas. Ocultar los controles de escritura a los docentes no asignados. Corregir los fallos silenciosos de las consultas y el falso "Todavía nadie…". El CSS de impresión oculta todos los controles y abre los `<details>`. Corregir "Volver al curso".
- **F75 Colegio.** Pestañas en vez de una sola página larga; la fila del estudiante enlaza a su detalle; la renovación de licencia recibe un enlace de contacto.
- **F76 Personal.** Todo en español, el mismo aspecto en todas las pestañas; PDFs y Preguntas se fusionan en Banco; el explorador de preguntas gana edición vía Auditoría, así que la promesa en `ReportsQueue` se vuelve cierta.
- **F77 Endurecimiento final.** Matriz completa de QA (Verificación), `break-ui` en cada lista y tarjeta, pasada de SEO, revisión de movimiento, `judgment-day` adversarial.

**Skills y herramientas por etapa** (el paquete de diseño se carga completo y junto en F51, según CLAUDE.md):

| Etapa | Herramientas |
|---|---|
| Dirección y sistema | `impeccable`, `design-taste-frontend`, `redesign-existing-projects`, `gstack-design-shotgun`, `ui-ux-pro-max`, `hallmark` |
| Partes del avatar, ilustraciones | agente `impeccable-asset-producer`, SVG |
| Pulido | `make-interfaces-feel-better`, `emil-design-eng`, `apple-design`, `mobile-native` |
| Movimiento | `animate`, `find-animation-opportunities`, `transitions-dev`, `transitions-polish`, `improve-animations`, `animation-performance`, `remove-animations` |
| SEO (solo lo público) | `seo-audit`, `seo-technical`, `seo-page`, `seo-schema`, `seo-images`, `seo-geo` |
| Verificación | `playwright-cli`, `break-ui`, `gstack-qa-only`, `gstack-design-review`, `judgment-day`, `impeccable-finish-reviewer` |

`pick-ui-library` y `review-animations` se nombran en CLAUDE.md pero no están instaladas; `animate` e `improve-animations` cubren ese terreno. Sin librería de UI nueva: Radix, Tailwind, `motion` y `lucide-react` alcanzan.

**Un solo punto de control de diseño:** tres direcciones visuales mostradas en Hoy y en Resolver; el dueño elige una. Todo lo que sigue avanza sin detenerse.

## Mapa final de pantallas

Estado: **Se mantiene** (solo cambia el estilo) · **Reconstruida** · **Fusionada** · **Nueva** · **Eliminada**.

**Público**

| Pantalla | Ruta | Estado | Funciones |
|---|---|---|---|
| Landing | `/` | Reconstruida | Valor para rectores, capturas de la app, qué se mide, vista del docente, origen de las preguntas, datos de menores, contacto, entrada del estudiante |
| Login | `/login` | Se mantiene | Iniciar sesión, registrarse, pedir restablecimiento, aviso de verificación |
| Nueva contraseña | `/reset-password` | Se mantiene | Definir la nueva contraseña, estados de enlace inválido y de listo |
| Legal | `/terminos`, `/privacidad` | Se mantiene | Texto, fecha de actualización, pie de página |
| 404 y error | global | Nueva | Explicar y ofrecer un camino de regreso |

**Estudiante (pestañas: Hoy, Aprende, Retos, Yo)**

| Pantalla | Ruta | Estado | Funciones |
|---|---|---|---|
| Enrutador | `/app` | Se mantiene | Enviar a cada rol a su inicio |
| Bienvenida y nivelación | `/diagnostic` | Reconstruida | Bienvenida en 3 pasos, fecha del examen y carrera, compromiso de la primera semana, nivelación por área |
| Hoy | `/today` | Reconstruida | Un botón grande, tareas del docente, misión, racha/XP/avatar, banner del duelo en vivo |
| Aprende | `/path` | Fusionada (absorbe `/syllabus`) | Tarjetas por materia, ruta de temas y dominio, practicar un tema, abrir una lección |
| Lección | `/lesson/$subtopicId` | Reconstruida | Pasos guiados por preguntas, demo, escuchar |
| Retos | `/practice` | Reconstruida | Liga, Repaso, Reto, Simulacro, constructor personalizado plegado, reanudar |
| Resolver | `/practice/$sessionId` | Reconstruida | Pregunta con texto primero, opciones, tachar, confianza, Pista, camino guiado, tutor; modo examen sellado |
| Resultados y revisión | `/practice/$sessionId/review` | Reconstruida | Pantalla de recompensa, Descúbrelo, respuestas, tutor, repetir las falladas |
| Duelo en vivo | `/duelo/$id` | Nueva | Unirse, responder, puntaje por equipo |
| Yo | `/progress` | Fusionada (absorbe `/history`) | Editor de avatar, medallas, puntaje y niveles, calendario de estudio, historial de sesiones, carrera y fecha del examen, salirse de la liga, tema, cuenta |
| Unirse a un curso | `/join` | Se mantiene | Ingresar el código |
| Cuenta (todos los roles) | `/cuenta` | Reconstruida | Editar nombre, cambiar contraseña, colegios, exportar datos, eliminar, Salir |
| Rutas viejas | `/syllabus`, `/history` | Eliminada | Redirigen a `/path` y `/progress` |

**Docente (navegación: Cursos, Colegio si es admin)**

| Pantalla | Ruta | Estado | Funciones |
|---|---|---|---|
| Cursos | `/teacher` | Se mantiene | Cursos por colegio, próxima prueba del colegio, aviso de licencia |
| Curso: Esta semana | `/teacher/$classGroupId` | Reconstruida | Plan de la semana, asignar, guía de clase, iniciar duelo, código de invitación, mensaje semanal a las familias |
| Curso: Resultados | igual, pestaña | Fusionada | Niveles por área, cuadrícula de estudiantes, una sola vista de puntos débiles (temas + competencias + más falladas), proporción que necesitó la respuesta, imprimir |
| Curso: Plan | igual, pestaña | Fusionada | Asignaciones, ciclo, plan de mejora y acciones |
| Informe del estudiante | `/teacher/student/$studentId` | Se mantiene | Informe de solo lectura, señal de estudio guiado, imprimir |
| Guía de clase | `/teacher/guia/$subtopicId` | Se mantiene | Guía con IA, la trampa del curso, imprimir |
| Anfitrión del duelo | `/teacher/duelo/$id` | Nueva | Vista de proyector, avanzar, resultados por equipo |

**Admin del colegio**

| Pantalla | Ruta | Estado | Funciones |
|---|---|---|---|
| Cursos | pestaña de `/school` | Reconstruida | Crear con selector de grado, docentes por curso, códigos, eliminar |
| Personas | pestaña | Reconstruida | Agregar y quitar docentes y estudiantes, enlace al informe del estudiante, cupos |
| Pruebas | pestaña | Nueva | Crear rondas, seguimiento, resultados del colegio y por curso, consolidado de ciclos de mejora |
| Institución | pestaña | Se mantiene | Nombre, escudo, licencia, contacto de renovación |

**Personal de Aprendo (`StaffShell`)**

| Pantalla | Ruta | Estado | Funciones |
|---|---|---|---|
| Banco | pestaña de `/admin` | Fusionada (PDFs + Preguntas) | Subir, estado, reintentar cuando sea seguro, explorar por fuente |
| Auditoría | pestaña | Nueva | Cola, página frente a pregunta, chequeos, modelos, aprobar/corregir/rechazar, guías, historial; los reportes de preguntas la alimentan. Es la única pestaña que ven los revisores |
| Colegios | pestaña | Se mantiene | Crear, editar plan/cupos/fecha, administradores |

## Modelo de datos (tablas nuevas: questionAudits, questionGuides, schoolTests, classDuels, duelAnswers)

```ts
sessions:      reward?: { xp, medals[], streakDays }
questionAttempts: guidedOutcome?: 'self_corrected' | 'revealed'
NEW questionGuides: questionId, hint, byOption: { [label]: { diagnose, steps[] } }, reveal,
                    modelId, promptVersion, status, reviewedBy?
students:      grade?, nickname?, leagueOptOut?, avatar?: {...ids}, reviewerSubjects?
questions:     bankTier?, stemDisplay?, targetGrade?, voidedAt?
organizations: leagueEnabled?
classCycles:   schoolTestId?, actions?
assignments:   schoolTestId?, subtopicId becomes optional
NEW questionAudits: questionId, subjectId, status, pipelineVersion, source, checks[],
                    vision?, solvers[], sampled?, reviewedBy?, reviewedAt?, reviewNote?, history[]
NEW schoolTests · classDuels · duelAnswers
```

No se agrega: libro de XP, tablas de congelaciones, medallas o liga, crons, tienda de monedas, subida de avatares, apodos de texto libre, tabla de versiones de preguntas. Todo campo nuevo en `questions` que lleve la respuesta debe agregarse a `sealQuestion`, que es una lista negra.

## Compuertas legales y de seguridad

- **G1 Aislamiento de ICFES.** Los colegios que pagan reciben solo ítems originales; ICFES queda en un nivel gratuito, con atribución y sin modificar. La propia nota legal del repo advierte que incluso el uso indirecto queda expuesto, así que se debe obtener una consulta escrita al ICFES y la revisión de un abogado antes de escalar. Las guías son texto nuevo construido sobre un ítem, así que los ítems ICFES solo las tienen si el abogado está de acuerdo; hasta entonces usan el tutor en vivo.
- **G2 Menores.** `leagueEnabled` queda apagado por defecto hasta que el colegio firme un otrosí; actualizar `/privacidad`; autorización de los acudientes antes de cobrar a las familias.
- **G3 Privacidad de la liga.** Sin ids de estudiantes, ≥ 5 participantes, en la mitad inferior se muestran diferencias y no posición, nunca en las vistas del docente ni en los informes.
- **G4 Apodos.** Listas cerradas revisadas para evitar dobles sentidos colombianos.
- **G5 Sin culpa.** Sin textos del tipo "perdiste tu racha"; una racha rota ofrece un nuevo comienzo.

## Si falta tiempo

Recortar en este orden: duelo, liga, medallas, partes del avatar, reetiquetado ICFES, acciones del plan de mejora. **Nunca recortar:** F50, la compuerta de nivel, el camino guiado de F56, las etapas deterministas y de resolución, la firma de los ítems originales.

## Acciones del dueño

1. Autorizar lecturas en producción o correr la exportación: los agentes tienen bloqueado el acceso a prod, y los contadores de dev (93) no coinciden con la documentación (213).
2. Contratar un docente por área; el docente de este chat se ofreció.
3. Abogado y consulta escrita al ICFES; otrosí de privacidad para los colegios.
4. Dar la ruta exacta de la hoja de usuarios y contraseñas. Una búsqueda amplia fue bloqueada por la política de permisos, así que hay que nombrarla. Su contenido nunca va en el repo, el plan, los logs ni las capturas.
5. Elegir una de las tres direcciones visuales (F51).
6. Decidir sobre los commits: no se hace commit ni despliegue de nada si no se pide. Dado el tamaño, se recomienda un commit por fase.

## Qué significa "producto final"

**Lo que entrega este trabajo:** todas las pantallas de arriba, todos los flujos, gamificación, estudio socrático, herramientas y pipeline de auditoría, prechequeos con IA, el generador de banco original y los ítems semilla, todo pasando la matriz de QA en dev.

**Lo que el código por sí solo no puede terminar:** la firma de los docentes sobre las preguntas, la aprobación humana del banco de ~2.000 ítems, las respuestas legales y del ICFES, las pruebas con estudiantes reales y el lanzamiento a producción (requiere visto bueno). Mientras los docentes no aprueben los ítems, ninguna pregunta se marca como verificada; la app está completa y lista para demo, pero no autorizada para cobrar.

## Verificación

- TDD estricto: primero una prueba que falle para cada función pura (`auditDecision`, recompensa, `streakFrom`, ventana de la liga, compuerta de similitud, reparación de clave) en `packages/convex/test` y `packages/ingest/test`.
- En cada fase: `bun run typecheck` y `bun run test`, sin build. Agregar pruebas de ruta para las no cubiertas `/`, `/login`, `/reset-password`, `/diagnostic`, `/admin`, `/teacher/student`, `/teacher/guia`.
- **Matriz de QA, corrida con `playwright-cli` sobre la app local:** cada pantalla × su rol (student, teacher, org_admin, staff, reviewer, multirrol) × teléfono 390 y escritorio 1440 × claro y oscuro × movimiento reducido; impresión en las pantallas de informe; estados de carga, vacío, error y datos de peor caso; teclado A–D en Resolver; contraste ≥ 4.5:1.
- **Recorridos por rol con las cuentas de la hoja:** iniciar sesión, completar el flujo principal de cada rol, cerrar sesión. Corre contra la web local y el despliegue dev, que está desactualizado y debe refrescarse primero con `convex dev --once`. Si una cuenta existe solo en producción, se crea una equivalente en dev; las pruebas nunca cambian datos de producción. El estado del navegador vive en el scratchpad y se borra después.
- Prueba de sellos: los tipos de examen nunca exponen respuestas, guías ni XP antes del cierre. Prueba del modo guiado: ningún payload contiene la opción correcta antes de que termine el camino; un reintento nunca cambia `isCorrect`.
- Tutor: conjunto fijo de 30 conversaciones guionadas, ninguna nombra la opción antes de que termine el camino.
- Piloto socrático: comparar un ítem similar una semana después entre los estudiantes guiados y los que vieron la respuesta, y medir el tiempo por pregunta y el abandono dentro de la escalera.
- Auditoría: piloto de 20 ítems, comparado a mano con los PDFs, antes de la corrida completa. Aprobado = todo defecto sembrado queda marcado.
- Producto: 5–10 estudiantes de 15–16 años y el docente prueban la demo F50–F57 antes del Frente B; F61 mide el retorno al día 7.

## Después de la aprobación

Guardar esto como `plans/reconstruccion-estudiante-y-banco.md` (en español, como los otros planes), enlazarlo desde `AGENTS.md`, registrar las decisiones en memoria, cargar el paquete de diseño y empezar por F50. Sin commits ni despliegues si no se piden.

## Evidencia (y sus límites)

- La gamificación ayuda en general y varía según el elemento: [Huang 2020, g≈0.46](https://link.springer.com/10.1007/s11423-020-09807-z).
- Las tablas de posiciones perjudican a los estudiantes de los puestos bajos: [tesis de Philpott](https://research.usq.edu.au/item/q5yvy/examining-efl-students-motivation-and-attitudes-toward-a-gamified-course-using-leaderboards-and-quests-at-a-japanese-university), [estudio SDT de matemáticas](https://par.nsf.gov/servlets/purl/10510520).
- Diseño de rachas: [Duolingo](https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals), [entrevista de Lenny](https://lennysnewsletter.com/p/behind-the-product-duolingo-streaks). No se encontró nada sobre rachas en la preparación de exámenes para adolescentes, de ahí F61.
- Recuperación espaciada: [espaciado, g≈0.74](https://par.nsf.gov/servlets/purl/10518320), [revisión en el aula](https://link.springer.com/10.1007/s10648-021-09595-9). Las sesiones diarias cortas para adolescentes no están probadas.
- Diseño socrático: experimento de campo en matemáticas de bachillerato con ~1.000 estudiantes: la IA sin salvaguardas dejó a los estudiantes un 17% peor cuando se les quitó; un tutor basado en pistas evitó en gran parte ese daño, pero no superó a no usar IA en el examen ([PNAS 2025](https://papers.ssrn.com/abstract=4895486), [Wharton](https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education)). Las preguntas de autoexplicación ayudan: [Bisra 2018, 64 estudios](https://www.Gwern.net/doc/psychology/spaced-repetition/2018-bisra.pdf). Esforzarse sin ayuda requiere algo de conocimiento previo ([Kapur](https://futurity.org/?p=2629782)), por eso toda escalera termina en la respuesta. Límite: no se encontró ninguna prueba directa de escaleras para tocar frente a respuestas instantáneas, de ahí el piloto.
- Aprender haciendo: [Brilliant](https://brilliant.org/) (afirmaciones del proveedor). Modos de juego por equipos para bachillerato: [comparación](https://ditchthattextbook.com/gameshow), [Screenwise](https://screenwiseapp.com/guides/best-blooket-alternatives-for-high-schoolers) (blogs).
- Mensajes a los padres: [J-PAL São Paulo](https://www.povertyactionlab.org/evaluation/how-messages-parents-impact-student-performance-brazil).
- Competidor: [circular de Martes de Prueba, 2021](https://www.unilibre.edu.co/colegio/pdfs/2021/CIRCULAR-DE-MARTES-PRUEBA.pdf).
- Legal: [términos del ICFES](https://www.icfes.gov.co/wp-content/uploads/2024/11/10-Mayo_Formar-Saber-Pro-2024-2.pdf), `content/icfes/02_practica_lectura.pdf` p.3; [preguntas frecuentes de la Ley 1581](https://unal.edu.co/fileadmin/user_upload/docs/ProteccionDatos/20240930-PREGUNTAS_FRECUENTES_RPDP.pdf); [Decreto 1377](https://www.unidadvictimas.gov.co/wp-content/uploads/Documentos/decretos/DECRETO_1377_2013.pdf). No es asesoría legal.
