# Plan: versión ENEM para Brasil

> Decidido el 2026-10-13. Las fases siguen la numeración de `plans/rediseno-institucional.md` (desde la 25).
>
> **Estado: plan aprobado, sin ejecutar.** No hay nada de ENEM en el código ni en producción.
> El código de F25 ya está escrito y probado (409 + 152 pruebas en verde), pero quedó guardado aparte en
> `git stash` con el nombre "enem F25: costura de examen (sin aplicar)". Para arrancar: `git stash list`, y luego
> `git stash apply stash@{N}` en una rama nueva.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Examen | **ENEM** (Exame Nacional do Ensino Médio, INEP). Es el equivalente brasileño del Saber 11. |
| Código | **El examen es configuración, no un fork.** Un solo repo y un solo deploy. Cada colegio o cursinho tiene un `examId` (`saber11` \| `enem`). |
| Cliente | **Cursinhos y colegios (B2B).** Reusa org → cursos → docente → estudiantes y las licencias por cupo. No hay pagos que construir. |
| Contenido | **Real + generado.** Los cadernos oficiales del INEP alimentan la nivelación y el simulado. Las preguntas generadas por IA desde la matriz de referencia completan la práctica. |
| Idioma | **pt-BR para las orgs ENEM.** Se usa un diccionario propio tipado, sin librería de i18n. El español sigue igual. |
| Redação | **Fase propia (F30), después del MVP.** Es el diferencial que más venden los cursinhos, pero es un producto aparte: corrección por IA en 5 competencias. |

## El examen (hechos que fijan la configuración)

| | Saber 11 | ENEM |
|---|---|---|
| Preguntas | 254 en 2 sesiones de 4h30 | 180 en 2 días: 90 + redação (5h30) y 90 (5h) |
| Áreas | 5 (LC, MAT, CN, SOC, ING) | 4 de 45 cada una: Linguagens (incluye 5 de lengua extranjera, inglés o español, a elección), Humanas, Natureza, Matemática |
| Opciones | A–D (inglés hasta H) | **A–E** |
| Nota | 0-100 por área, global 0-500 con pesos 3/3/3/3/1 | **TRI** (modelo de 3 parámetros), escala ~0-1000 por área. No hay global oficial; cada universidad (SISU) pondera a su modo |
| Niveles | 4 por área (cortes ICFES) | **No hay niveles oficiales.** La meta es la nota de corte del curso que el estudiante quiere |
| Taxonomía | Propia (5 / 25 / 33) | **Matriz de referencia del INEP**: 30 habilidades (H1-H30) agrupadas en competencias, por área |
| Ítems | Cuadernillos ICFES | Cadernos y gabaritos públicos del INEP. Los **microdados** (`ITENS_PROVA`) traen por ítem `CO_HABILIDADE` y los parámetros TRI `NU_PARAM_A/B/C` |

Lo que esto regala: con los microdados, cada ítem real llega **ya etiquetado con su habilidad** y con su **calibración TRI oficial**. Se puede estimar la nota ENEM con el mismo modelo que usa el INEP, no con el % de aciertos. Ningún competidor chico lo hace bien.

Ojo: el INEP retiró los microdados 2017-2019 y 2021 para adaptarlos a la LGPD, así que la cobertura de parámetros varía por año. Se verifica en F27.

## Arquitectura: la costura mínima

La regla que mantiene esto pequeño: **los ids son globalmente únicos**. Las áreas ENEM se llaman `enem_linguagens`, `enem_humanas`, `enem_natureza` y `enem_matematica`, y las habilidades `enem_mt_h01` y así. Así, todo lo que hoy busca por id (`getSubtopicContext`, `getSubjectLabel`, `getLevelForScore`, los colores) sigue funcionando sin saber de qué examen viene el id. Solo cambia **lo que lista o pondera áreas**.

```
packages/convex/src/exams.ts            ExamId, EXAMS: { saber11, enem } y getExam(id)
  └─ por examen: taxonomy JSON, subjectIds, scoring, sesiones (diagnóstico,
     nivelación, simulacro, ritmo), optionLabels, locale, timeZone, persona del tutor
docs/taxonomy.enem.v1.json              4 áreas → competencias → 120 habilidades
organizations.examId  (opcional, default saber11)
students.examId       (se copia de la org al unirse; default saber11)
```

Hay ~20 puntos que hoy listan áreas con constantes globales: `SUBJECT_IDS`, `LEVELLED_SUBJECT_IDS`, `SUBJECT_WEIGHTS`, `REQUIRED_SUBJECT_IDS` y `taxonomyContract.subjects`. Están en `today`, `teacher`, `progress`, `path`, `syllabus`, `sessions`, `questionPool`, `practiceBuilder`, `studyPlan`, `examReport` y `generatedQuestions`, y en la web en `practice.tsx`, `PracticeBuilder.tsx`, `subject-theme.ts` y `practice-builder.ts`. Cada uno pasa a pedir `getExam(student.examId)`.

Lo que **no** cambia: las tablas de preguntas, intentos y agregados, el motor de recomendación, Elo, el dominio por subtema y las rutas. El modelo de datos ya acepta cualquier etiqueta de opción (`validators.ts:13`). El teclado del solve ya lee las opciones de la pregunta (`SessionSolve.tsx:488`).

## Fases

### F25 · Costura de examen (sin cambio visible) — escrita y guardada en `git stash`, sin aplicar
- `exams.ts` con `saber11` como único examen, tomando los valores que hoy están sueltos (pesos, simulacro, ritmo, opciones).
- `examId` opcional en `organizations` y `students`, con `getStudentExam(ctx, student)`.
- Los ~20 consumidores leen del examen del estudiante.
- `generatedQuestions` toma `optionLabels` del examen (hoy está fijo en `z.enum(['A','B','C','D'])`).
- **Hecho cuando:** las 398 + 152 pruebas siguen en verde y hay pruebas nuevas que prueban que un examen ficticio de 2 áreas cambia listas y pesos. ✔ 409 + 152 (en el stash).
- Pendiente para F28: escribir `students.examId` al unirse a un curso (hoy nadie lo escribe; todo cae en `saber11`). La web lee el examen con `useExam()`.

### F26 · Modelo ENEM
- `docs/taxonomy.enem.v1.json` desde la matriz oficial del INEP: 4 áreas → competencias → H1-H30.
- Puntuación por área:
  - Estimación TRI-3PL (θ por máxima verosimilitud acotada, escala 500 + 100·θ) cuando los ítems tienen parámetros.
  - Si no los tienen, un proxy por aciertos marcado como "estimativa".
  - Siempre con la banda de incertidumbre, igual que hoy.
- "Média" simple de las 4 áreas + redação (cuando exista).
- Meta = nota de corte SISU que el estudiante escribe. Reemplaza a los niveles; la UI dice "faltan X pontos para a sua meta".
- `subject-theme`: colores de las 4 áreas ENEM.
- **Hecho cuando:** `estimateEnemScore` está probado contra casos con parámetros conocidos.

### F27 · Ingesta INEP
- Loader de cadernos (PDF) + gabaritos + microdados `ITENS_PROVA` por año y color de caderno, sobre el pipeline de PDF existente (tipo `load-icfes-booklets.ts`).
- Etiqueta = `CO_HABILIDADE` → habilidad; parámetros TRI en el ítem.
- Ítems anulados (`IN_ITEM_ABAN`) fuera.
- Lengua extranjera: inglés y español marcados aparte.
- Se valida cuántos años traen parámetros.
- **Hecho cuando:** ≥ 2 ediciones completas (360 ítems) están cargadas en dev y son elegibles.

### F28 · Sesiones ENEM
- Config ENEM en `exams.ts`:
  - Diagnóstico por área.
  - Nivelação de 15.
  - Simulado de 2 días (90 + 90, 5h30 / 5h, ~3 min por ítem).
  - Opciones A–E.
- Elección de lengua extranjera en el perfil.
- `ExamBreak` habla de "Dia 2".
- **Hecho cuando:** un simulado ENEM completo se crea, se resuelve y se reporta en las pruebas.

### F29 · Producto en pt-BR
- Diccionario `copy.es.ts` / `copy.pt.ts` y `useCopy()` según el examen del usuario. Son unos 70 archivos con textos; se hace por pantalla, empezando por el flujo del estudiante.
- Prompts del tutor, lecciones, coach y preguntas generadas en portugués brasileño. La persona deja de ser "estudiante colombiano de grado 11".
- Zona horaria `America/Sao_Paulo`: hoy `colombiaTime.ts` es fijo y pasa a `timeZone` del examen.
- Landing para cursinhos en `/br` (o un dominio .com.br).
- **Hecho cuando:** un estudiante de una org ENEM no ve una sola palabra en español.

### F30 · Redação (después del MVP)
- Tema + caja de texto (o foto del manuscrito con OCR).
- Corrección por IA en las 5 competencias (0-200 cada una), con comentario por competencia.
- El docente puede ajustar la nota.
- Riesgo: la calidad de la corrección. Se calibra con redações nota 1000 públicas antes de venderla.

### F31 · Lanzamiento
- LGPD: muchos estudiantes son menores, así que hacen falta base legal, consentimiento del responsable y un encarregado.
- Términos y privacidad en pt-BR.
- Facturación en BRL (manual, B2B).
- Seed de un cursinho demo.
- Revisión jurídica del reuso comercial de los cadernos del INEP (Lei 9.610/98: son obras públicas, pero no está confirmado que no tengan restricción).

## Estimación

F25 ~3 días · F26 ~4 · F27 ~4 · F28 ~3 · F29 ~6 · **MVP sin redação ≈ 4 semanas**. F30 +2 semanas. F31 depende del abogado.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Derechos sobre los cadernos del INEP | Opinión legal antes de vender. Mientras tanto se usa solo en pilotos. Las preguntas generadas no dependen de esto. |
| Microdados sin parámetros en algunos años | Proxy por aciertos marcado como "estimativa" y prioridad a los años con parámetros. |
| Calidad del portugués en preguntas generadas y en el tutor | Revisión por un profesor brasileño antes de abrir la práctica generada. |
| La competencia (Descomplica, Stoodi, Me Salva!) es grande en B2C | Por eso el B2B: el panel docente y el co-branding son lo que ellos no venden a cursinhos chicos. |
