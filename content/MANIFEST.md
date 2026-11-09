# Fuentes del banco de preguntas

46 PDFs, ~150 MB. **No están en git** — es material público y re-descargable, y
meterlo en la historia infla el repo para siempre. `bash content/fetch.sh` los
vuelve a bajar todos.

Descargados y revisados el 2026-08-20.

---

## `icfes/` — 15 PDFs · Caja de Herramientas Saber 11 y cuadernillos oficiales

Fuente: <https://www.icfes.gov.co/caja-de-herramientas-saber-11/practica/>

### Lo que los hace valiosos

**Traen la respuesta correcta declarada por el ICFES.** No hay que inferirla.
Eso elimina de raíz el riesgo que arrastraba el pipeline: hasta ahora Gemini
afirmaba su propia respuesta correcta sin verificación independiente, y un
estudiante que estudia con una respuesta mal inferida aprende mal.

Dos formatos, y conviene ingerirlos distinto:

| Archivo | Pág | Qué trae |
|---|---|---|
| `0{1,3,5,7,9}_explicadas_*.pdf` | 3 c/u | Pocas preguntas, cada una con **respuesta + explicación en prosa** de por qué esa opción es correcta y por qué las otras no |
| `0{2,4,6,8}_practica_*.pdf`, `10_practica_ingles.pdf` | 24-41 | El volumen: **221 preguntas con clave de respuestas oficial** al final |

### Preguntas con respuesta oficial disponible

| Área | Preguntas |
|---|---|
| Matemáticas | 50 |
| Lectura Crítica | 49 |
| Ciencias Naturales | 49 |
| Sociales y Ciudadanas | 48 |
| Inglés | 25 |
| **Total** | **221** |

**La clave de Inglés además trae el nivel de desempeño por pregunta**
(`3 → E → A1`, `20 → D → B1`). Eso es dificultad medida por el ICFES, y es un
prior mucho mejor que arrancar todas las preguntas en `DEFAULT_RATING` 1200
(ver `packages/convex/src/elo.ts`). También confirma las bandas CEFR corregidas
en `docs/levels.v1.json`: Pre A1 / A1 / A2 / B1, sin `B+`.

### Cuadernillos oficiales completos

`16-feb-…-lectura-critica-2026`, `24-feb-…-ciencias-naturales-2026`,
`09-marzo_…-matematicas-2026`, `22-diciembre-…-ciencias-naturales-2025`,
`16-octubre-…-ingles-2024`. Exámenes completos, **con tabla de respuestas
correctas impresa al final** (la de Inglés, una por cada uno de sus dos
exámenes). No necesitan inferencia del modelo.

---

## `altopuntaje/` — 5 PDFs · cuadernillos por área, formato actual

Fuente: <https://altopuntaje.com/prueba-icfes-preguntas-saber-11-examenes/>

21-33 páginas por área, las cinco áreas del examen actual. Sin clave de
respuestas visible; requieren inferencia.

> El servidor sirve un certificado Let's Encrypt válido pero **omite el
> intermedio**, y su raíz (`ISRG Root YE`) es más nueva que la mayoría de
> bundles de CA. `fetch.sh` arma la cadena explícitamente en vez de recurrir a
> `--insecure`, que aceptaría cualquier certificado.

---

## `saber11-formato-viejo/` — 26 PDFs · NO INGERIR

Fuente: enlaces de Google Drive en la misma página de altopuntaje.

**Son del Saber 11 anterior a 2014**, cuando el examen tenía materias sueltas:
Biología, Química, Física, Filosofía, Historia, Geografía, Lenguaje, Medio
Ambiente, Violencia y Sociedad.

El examen actual tiene **cinco áreas**, y `docs/taxonomy.v1.json` está construida
sobre esas cinco. Filosofía, Geografía, Historia y Violencia y Sociedad **no
tienen dónde caer**. Ingerirlos produce una de dos cosas, ambas malas:

- preguntas que el enriquecimiento no puede etiquetar y quedan `excluded`, o
- preguntas forzadas a un subtema que no les corresponde, que después
  contaminan el dominio calculado y la recomendación.

Se conservan como referencia histórica. `cuadernillo-saber11-2016.pdf` y
`-2014.pdf` sí son del formato actual y podrían revisarse aparte.

---

## Ampliación del 2026-11-09

Decisiones y recortes en `content/revision-banco/2026-11-09-ampliacion-2*` (no están en git). **El registro de fuentes y las huellas para no repetir preguntas están en `content/fuentes/README.md`.**

| Fuente | Años | Origen de la clave |
|---|---|---|
| Cuadernillos Saber 11 | 2014, 2019 | Tabla impresa |
| Evaluar para Avanzar, grado 11 | 2021 a 2023 | Guía docente del ICFES; sin guía utilizable, dos soluciones a ciegas |
| Exámenes aplicados, prefijo `icfes-reservado-` | 2024, 2025 | Dos soluciones a ciegas (`answerModelId: two-solvers-v1`) |

Los `icfes-reservado-` son copias de cuadernillos marcados como de uso exclusivo del ICFES. El dueño decidió subirlos a producción el 2026-11-09, sabiendo que la revisión legal sigue pendiente. Sus escaneos originales llevaban datos del examinado y no se conservan.

---

## Estado del pipeline frente a este material

**Resuelto:** el enriquecimiento aceptaba solo etiquetas `A-D`. Los cuadernillos
de Inglés usan ítems de 3 opciones (`A-C`) y de emparejamiento donde cinco
enunciados comparten ocho opciones (`A-H`). El enum ahora va de `A` a `H`
(`packages/ingest/src/question-enrichment-core.ts`).

**Resuelto:** las claves impresas ya se leen sin modelo en
`packages/ingest/src/icfes-booklet.ts`: `parseAnswerKey` (tabla final),
`parseExamAnswerKeys` (una tabla por examen en Inglés) e `inlineAnswer` (respuesta
impresa junto a la pregunta en las `explicadas` y en las guías).
`load-icfes-booklets.ts` carga con esa clave los ocho cuadernillos de Lectura,
Matemáticas, Sociales y Ciencias.

**Pendiente:** el cargador todavía no incluye Inglés, las `explicadas` ni las
guías.
