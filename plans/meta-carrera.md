# Plan: meta de carrera (estudiar para la carrera que quieres)

> Investigado y diseñado el 2026-10-19.
>
> **Estado: V1 construida** (2026-10-29, F36 de `plans/ruta-mejora-pedagogica.md`). Falta cruzar los pesos con una segunda universidad.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Cuándo se pregunta | **Justo después de la primera nivelación**, cuando el estudiante ve su nivel: "¿Para qué carrera es este puntaje?". Se puede saltar. Mientras no responda, una tarjeta en Hoy lo sigue invitando. Se cambia en Progreso. **Nunca es una puerta**: la regla de la app es no obligar a nada. |
| Qué elige | **Una familia de carreras** (Salud, Ingenierías…), con la ponderación típica de esa familia. No la universidad ni el programa exacto: eso es la V2 (G24). |
| Si no sabe | **Un cuestionario corto de intereses** (12 preguntas, modelo RIASEC de Holland), sin IA. El resultado son 2 o 3 familias para explorar, con el enlace a Buscando Carrera del MEN. |
| El global oficial | **No se toca.** El puntaje global sigue con los pesos ICFES 3/3/3/3/1. La carrera agrega un segundo número, el ponderado, y cambia la prioridad de estudio. |

## Lo que encontramos

### 1. Las universidades públicas no admiten por el global: admiten por un ponderado de cada carrera

Ejemplo verificado: la UIS selecciona con el Saber 11 multiplicando cada prueba por la ponderación de cada programa y llenando cupos de mayor a menor (Acuerdo 222 de 2014 del Consejo Académico, documento "Criterios de admisión", 2022). Algunos programas de su tabla:

| Programa (UIS) | Ciencias | Lectura | Matemáticas | Sociales | Inglés |
|---|---|---|---|---|---|
| Medicina | 30 | 25 | 20 | 15 | 10 |
| Ingeniería de Sistemas | 25 | 20 | 35 | 10 | 10 |
| Ingeniería Mecánica | 30 | 10 | 40 | 10 | 10 |
| Derecho | 10 | 40 | 20 | 20 | 10 |
| Economía | 10 | 25 | 30 | 25 | 10 |
| Trabajo Social | 10 | 40 | 10 | 30 | 10 |
| Matemáticas | 10 | 20 | 50 | 10 | 10 |
| Química | 40 | 15 | 25 | 10 | 10 |
| Lic. Lenguas Extranjeras (inglés) | 10 | 25 | 10 | 20 | 35 |

Qué significa para Aprendo: **el mismo 300 de global vale distinto según la carrera.** A quien quiere Derecho le rinde más un punto en Lectura que uno en Matemáticas, y a quien quiere Mecánica al revés. Hoy el plan del día optimiza el global (`studyPlan.ts` usa los pesos 3/3/3/3/1). Optimizar el ponderado de su carrera es ventaja real, no solo motivación.

Cada universidad fija sus pesos y los cambia por convocatoria. La UNAL y la UdeA tienen examen de admisión propio (dato conocido, no verificado en esta investigación). Por eso la V1 habla de pesos **típicos** y cita la fuente.

### 2. Conectar el estudio con un futuro concreto sube el rendimiento, sobre todo de quien duda de sí mismo

- **Valor de utilidad** (Hulleman y Harackiewicz, 2009, *Journal of Educational Psychology*): estudiantes de 9.º que escribían para qué les servía en su vida lo que veían en ciencias subieron interés y notas, unos dos tercios de una letra. El efecto apareció solo en quienes tenían bajas expectativas de sí mismos.
- **"Possible selves"** (Oyserman y colegas, programa School-to-Jobs, con asignación aleatoria): imaginarse de adulto y unir esa imagen con el colegio mejoró notas, asistencia e iniciativa en clase.

El público de Aprendo (grado 11, colegios públicos, ansioso por el examen) es justo el que más gana con esto. Por eso el tutor también recibe la carrera, para hacer ese puente en una frase cuando venga al caso.

### 3. Orientación para quien no sabe

- **Buscando Carrera** (MEN) es un catálogo de programas de educación superior con filtros, pensado para grados 10 y 11. **No es un test.** Sirve como destino del resultado: "estas familias te podrían gustar, mira los programas aquí".
- Los estudios con estudiantes de grado 11 en Colombia usan inventarios de intereses: el IPP en Ibagué y el SDS de Holland en Quindío. La base común es el modelo **RIASEC** de Holland: Realista, Investigador, Artístico, Social, Emprendedor, Convencional.
- Los instrumentos validados (SDS) tienen licencia. El cuestionario de Aprendo es propio y corto, así que **orienta, no diagnostica**. Se dice así en pantalla, junto con la sugerencia de hablar con el orientador del colegio.

## Familias de carreras (V1)

El perfil típico usa un programa real de la tabla UIS. La columna "Rango en la UIS" muestra cuánto varía dentro de la familia.

| id | Familia | Ejemplos | C / L / M / S / I | Perfil tomado de | Rango en la UIS |
|---|---|---|---|---|---|
| `salud` | Salud | Medicina, Enfermería, Fisioterapia, Nutrición, Bacteriología | 30 / 25 / 20 / 15 / 10 | Medicina | Ciencias 30–40 |
| `ingenierias` | Ingenierías y tecnología | Civil, Sistemas, Industrial, Mecánica, Electrónica | 30 / 20 / 30 / 10 / 10 | Civil, Eléctrica, Electrónica, Química, Petróleos | Mate 25–40 |
| `ciencias_naturales` | Ciencias naturales | Biología, Química, Geología, Física | 35 / 20 / 25 / 10 / 10 | Biología | Ciencias 20–40 |
| `matematicas` | Matemáticas y estadística | Matemáticas, Estadística, Lic. en Matemáticas | 10 / 20 / 50 / 10 / 10 | Matemáticas | — |
| `derecho` | Derecho y ciencia política | Derecho, Ciencia Política, Relaciones Internacionales | 10 / 40 / 20 / 20 / 10 | Derecho | — |
| `sociales_humanas` | Ciencias sociales y humanas | Psicología, Trabajo Social, Historia, Comunicación, Filosofía | 10 / 35 / 20 / 25 / 10 | Historia y Archivística | Lectura 20–40 |
| `economicas` | Económicas y administrativas | Economía, Administración, Contaduría | 10 / 25 / 30 / 25 / 10 | Economía | — |
| `educacion` | Educación (licenciaturas) | Básica Primaria, Literatura, Música | 22 / 22 / 22 / 22 / 12 | Lic. Básica Primaria | varía con el énfasis |
| `idiomas` | Idiomas | Lenguas Extranjeras, Traducción | 10 / 25 / 10 / 20 / 35 | Lic. Lenguas Extranjeras | — |
| `artes` | Artes y diseño | Diseño, Artes Plásticas, Arquitectura | **sin perfil propio** | — | — |

Notas:
- **Artes y diseño:** la tabla UIS no tiene programas de artes, y Diseño Industrial pondera como una ingeniería. Hasta tener una fuente, esta familia **usa los pesos oficiales del global** (3/3/3/3/1, es decir 23/23/23/23/8) y no muestra ponderado propio.
- **Psicología y Administración** no están en la tabla de la sede Bucaramanga; quedan en la familia más cercana.
- Antes de construir, se cruza con al menos otra universidad que pondere por programa (Univalle, UPTC, Universidad Distrital) y se anota en el código la fuente de cada perfil.

## Cuestionario de intereses (si no sabe)

- 12 actividades, dos por tipo RIASEC. Cada una se contesta "Me gusta", "Me da igual" o "No me gusta" (2, 1 o 0 puntos).
- Los dos tipos con más puntos sugieren las familias.

| Tipo | Ejemplos de actividades | Familias que sugiere |
|---|---|---|
| R Realista | Armar o reparar aparatos; trabajar al aire libre con herramientas | Ingenierías, Ciencias naturales |
| I Investigador | Entender por qué pasa un fenómeno; resolver acertijos de lógica | Ciencias naturales, Matemáticas, Salud |
| A Artístico | Dibujar, diseñar o hacer música; escribir historias | Artes y diseño, Idiomas, Sociales y humanas |
| S Social | Explicarle algo a un compañero; ayudar a alguien con un problema | Educación, Salud, Sociales y humanas |
| E Emprendedor | Convencer a otros en un debate; organizar un negocio o un evento | Derecho, Económicas |
| C Convencional | Llevar cuentas y registros en orden; organizar datos en tablas | Económicas, Matemáticas, Ingenierías |

- **Resultado:** 2 o 3 familias, de mayor a menor coincidencia, y un botón "Elegir esta". Se agrega el enlace a Buscando Carrera y la frase: "Esto orienta, no decide. Habla también con el orientador de tu colegio."
- **Sin IA:** es determinista, gratis, inmediato y se puede probar.

## Qué cambia en la app

| Dónde | Cambio |
|---|---|
| `packages/convex/src/careers.ts` (nuevo, puro) | `CAREER_FAMILIES` (id, nombre, ejemplos, pesos, fuente), las 12 preguntas, `suggestFamilies(respuestas)` y `careerWeights(id)` |
| `schema.ts` → `students` | `careerFamily: v.optional(v.string())` |
| `students.ts` | `setCareerFamily` (con `assertIsStudent`, valida el id y acepta `null`), con el mismo patrón que `setTargetGlobalScore` |
| `studyPlan.ts:95` | Entrada opcional `subjectWeights`. Sin carrera usa `SUBJECT_WEIGHTS`, como hoy. El texto de la razón cambia a "donde más puntos ganas para tu carrera" |
| `today.ts:211` | Le pasa `careerWeights(student.careerFamily)` al plan |
| `sessions.ts` `selectRecommended` (317) | El orden de debilidad se multiplica por el peso del área en su carrera |
| `progress.ts` | `careerScore`: Σ peso × puntaje de área / 100. Es `null` si falta alguna área, como el global |
| Revisión de la nivelación (`NivelacionResult`) | Bloque "¿Para qué carrera es este puntaje?" con las familias, "Todavía no sé" (abre el cuestionario) y "Ahora no" |
| Hoy | Tarjeta mientras no haya carrera, con el estilo de la invitación de `ExamCountdown` |
| Progreso | "Tu carrera: Ingenierías · Cambiar" y el ponderado junto al global |
| Tutor (`getPracticeQuestionContext`) | Una línea: "Quiere estudiar: Ingenierías. Si viene al caso, dile en una frase para qué le sirve esto en esa carrera." No cambia el alcance: sigue siendo esta pregunta y el Saber 11 |
| Docente (`getClassOverview`) | La familia de cada estudiante, como columna en "Cada estudiante" |

Lo que **no** cambia: `estimateGlobalScore` y `SUBJECT_WEIGHTS`, que siguen siendo los oficiales. Ojo: el stash de ENEM (F25) mueve `SUBJECT_WEIGHTS` a `getExam()`, así que se toca en los mismos archivos. Si se aplica primero, los pesos de carrera van por examen.

## Tareas de la V1 (TDD)

1. `careers.test.ts`: cada familia suma 100. `suggestFamilies` devuelve las familias de los dos tipos con más puntos y desempata de forma estable. Un id desconocido da `null`.
2. `careers.ts`, `schema.ts` y `setCareerFamily`. En `authz.test.ts`: un estudiante no cambia la carrera de otro, y un id inválido se rechaza.
3. `studyPlan.test.ts`: con pesos de Derecho y el mismo margen en Lectura y Matemáticas, el plan elige Lectura; con Ingenierías, Matemáticas. Sin carrera, igual que hoy.
4. `progress.test.ts`: `careerScore` es `null` con un área faltante, y el cálculo da bien en un caso a mano.
5. UI: bloque post-nivelación, tarjeta en Hoy, cuestionario y Progreso. Una prueba de componente del cuestionario (respuestas → familias).
6. Tutor y docente: el contexto con la carrera (prueba en `tutor.test.ts`) y la columna en el curso (`staff-routes.test.tsx`).

## Después (fuera de la V1)

- **Universidad y programa exactos (G24 en `plans/redesign.md`):** pesos reales por programa y por universidad, con el año de la convocatoria, y puntajes de corte de los últimos admitidos (Univalle publica estadísticas por programa). Requiere una tabla de datos que se actualiza cada año.
- La UNAL y la UdeA, con examen propio: allí solo aplica el global (y el examen propio no lo cubre Aprendo).
- Medir si funciona: comparar la práctica semanal y la mejora por área de quienes eligen carrera contra quienes no.

## Fuentes

- UIS, Dirección de Admisiones, "Criterios de admisión" (2022), Tabla No. 1: https://comunicaciones.uis.edu.co/wp-content/uploads/2022/05/CRITERIOS-DE-ADMISION-1.pdf
- Hulleman, C. S. y Harackiewicz, J. M. (2009). Promoting interest and performance in high school science classes. *Journal of Educational Psychology*, 101(4). Resumen en revisiones: https://pmc.ncbi.nlm.nih.gov/articles/PMC5589190 y https://journals.sagepub.com/doi/10.1177/2372732216655542
- Oyserman, Terry y Bybee (2002), y el programa School-to-Jobs: https://deepblue.lib.umich.edu/bitstream/2027.42/89945/1/oyserman__terry__bybee__2002.pdf y https://pmc.ncbi.nlm.nih.gov/articles/PMC3204662
- MEN, "¿Buscando carrera?": https://www.mineducacion.gov.co/sistemasdeinformacion/1735/article-234959.html
- Estudios con grado 11 en Colombia (IPP en Ibagué; SDS en Quindío): https://dialnet.unirioja.es/descarga/articulo/6976577.pdf y https://ojs.uniquindio.edu.co/ojs/index.php/riuq/article/download/1060/1413/5474
- Puntaje ponderado por carrera, explicación general: https://lakalle.bluradio.com/sociedad/informacion-de-servicio/olvidate-del-puntaje-global-del-icfes-calcula-tu-ponderado-para-entrar-a-la-universidad-so35
