# Fuentes del banco de preguntas

Registro de dónde salió cada pregunta, para no volver a cargarla. Actualizado el 2026-11-09, sobre el banco de **dev** (1379 preguntas elegibles).

| Archivo | Qué tiene |
|---|---|
| `README.md` | Este resumen: qué se cargó, qué se descartó y qué falta |
| `registro.json` | Cada cuadernillo: enlaces, sha256, guía de claves, conteos y origen de la clave |
| `huellas.jsonl` | Una línea por pregunta, cargada o en espera. Solo hashes: no tiene texto del examen |

Los enlaces de los exámenes aplicados están en `content/revision-banco/fuentes-reservadas.tsv`, fuera de git. El proceso completo de la última carga está en `content/revision-banco/proceso-2026-11-09/`, también fuera de git.

## Antes de cargar un cuadernillo nuevo

1. **Busca su URL y su sha256** en `registro.json` y en la tabla de descartados. Si ya están, no lo proceses.
2. **Compara cada pregunta con `huellas.jsonl`.** El mismo cuadernillo circula con otro nombre y el ICFES reutiliza preguntas entre años.
3. **Mira la portada**, no el nombre del archivo: un PDF rotulado "Ciencias 2022" era la guía de Matemáticas.
4. **Prueba la tabla de claves** contra una solución a ciegas. Por debajo de 70 % de coincidencia no es la tabla de ese cuadernillo.
5. **Carga solo con `addOnly`** (`apply-bank-review.ts`). No uses `load-icfes-booklets` sobre cuadernillos ya cargados.

### Cómo comparar con las huellas

Cada línea trae `slug`, `n` (número), `area`, `estado`, `pag`, `s` y `o`.

- **Normaliza el texto:** descomposición NFD, sin diacríticos, en minúsculas, y conserva solo los tokens `[a-z0-9]+`.
- **`s`:** hashes de los grupos de 4 palabras seguidas del enunciado, sin repetir y ordenados.
- **`o`:** hash de cada opción normalizada, ordenados.
- **Hash:** los primeros 8 caracteres hexadecimales del SHA-1 del texto.

Dos preguntas son la misma si se cumple alguna condición:

| Caso | Regla |
|---|---|
| Opciones con texto (al menos 3 reales) | Jaccard de opciones ≥ 0,75 y Jaccard de enunciado ≥ 0,3; o ≥ 0,6 si el enunciado tiene menos de 12 grupos |
| Opciones de imagen ("Opción A") | Jaccard de enunciado ≥ 0,8 y al menos 25 grupos |
| Revisión final, misma área | Jaccard de enunciado ≥ 0,85 con al menos 15 grupos, revisada a mano: el mismo texto puede traer otras cifras |

Los ejercicios de emparejamiento de Inglés comparten una lista de opciones, así que nunca compares solo opciones. Una coincidencia exacta de texto no basta: las copias con texto corregido no coinciden.

## Cargadas


### Saber 11 2014: 15 elegibles

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-2014-ciencias` | 3 | 0 | 3 oficial | [enlace](https://altopuntaje.com/prueba-icfes-preguntas-saber-11-examenes/) | - |
| `icfes-2014-ingles` | 12 | 0 | 12 oficial | [enlace](https://altopuntaje.com/prueba-icfes-preguntas-saber-11-examenes/) | - |

### Saber 11 2017 (guía): 68 elegibles

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-icfes-guia-2017-1-ciencias` | 9 | 1 | 9 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-1.pdf) | - |
| `icfes-icfes-guia-2017-1-ingles` | 9 | 1 | 9 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-1.pdf) | - |
| `icfes-icfes-guia-2017-1-lectura` | 5 | 1 | 5 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-1.pdf) | - |
| `icfes-icfes-guia-2017-1-matematicas` | 8 | 1 | 8 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-1.pdf) | - |
| `icfes-icfes-guia-2017-1-sociales` | 8 | 1 | 8 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-1.pdf) | - |
| `icfes-icfes-guia-2017-2-ciencias` | 5 | 0 | 5 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-2.pdf) | - |
| `icfes-icfes-guia-2017-2-ingles` | 14 | 0 | 14 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-2.pdf) | - |
| `icfes-icfes-guia-2017-2-lectura` | 3 | 0 | 3 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-2.pdf) | - |
| `icfes-icfes-guia-2017-2-matematicas` | 3 | 0 | 3 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-2.pdf) | - |
| `icfes-icfes-guia-2017-2-sociales` | 4 | 0 | 4 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2024/11/Guia-de-orientacion-saber-11-2017-2.pdf) | - |

### Saber 11 2019: 24 elegibles

Copias de terceros de material ICFES fechado en 2018. Traen la tabla de claves impresa.

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-2019-ciencias` | 6 | 0 | 6 oficial | [enlace](https://universate.co/wp-content/uploads/2023/12/cuadernillo-de-preguntas-saber-11-ciencias-naturales-2019.pdf) | - |
| `icfes-2019-ingles-e1` | 7 | 0 | 7 oficial | [enlace](https://universate.co/wp-content/uploads/2023/12/cuadernillo-de-preguntas-ingles-saber-11-2019.pdf) | - |
| `icfes-2019-ingles-e2` | 11 | 0 | 11 oficial | [enlace](https://universate.co/wp-content/uploads/2023/12/cuadernillo-de-preguntas-ingles-saber-11-2019.pdf) | - |
| `icfes-2019-lectura` | 0 | 1 | - | [enlace](https://universate.co/wp-content/uploads/2023/12/cuadernillo-de-preguntas-saber-11-lectura-critica-2019.pdf) | - |
| `icfes-2019-matematicas` | 0 | 1 | - | [enlace](https://universate.co/wp-content/uploads/2023/12/cuadernillo-de-preguntas-saber-11-matematicas-2019.pdf) | - |

### Saber 11 2021: 193 elegibles

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-02_practica_lectura` | 22 | 19 | 22 oficial | [enlace](http://icfes.acendra.com.co/wp-content/uploads/2024/12/02_practica_lectura.pdf) | - |
| `icfes-04_practica_matematicas` | 20 | 26 | 20 oficial | [enlace](http://icfes.acendra.com.co/wp-content/uploads/2024/12/04_practica_matematicas.pdf) | - |
| `icfes-06_practica_sociales` | 48 | 0 | 48 oficial | [enlace](http://icfes.acendra.com.co/wp-content/uploads/2024/12/06_practica_sociales.pdf) | - |
| `icfes-08_practica_ciencias` | 36 | 13 | 36 oficial | [enlace](http://icfes.acendra.com.co/wp-content/uploads/2024/12/08_practica_ciencias.pdf) | - |
| `icfes-10_practica_ingles-e1` | 24 | 1 | 24 oficial | [enlace](http://icfes.acendra.com.co/wp-content/uploads/2024/12/10_practica_ingles.pdf) | - |
| `icfes-10_practica_ingles-e2` | 25 | 0 | 25 oficial | [enlace](http://icfes.acendra.com.co/wp-content/uploads/2024/12/10_practica_ingles.pdf) | - |
| `icfes-icfes-2021-ciencias-cuadernillo` | 3 | 1 | 3 oficial | [enlace](https://web.archive.org/web/20210820141019id_/https://www.icfes.gov.co/documents/20143/1713188/Cuadernillo+de+preguntas+Ciencias+Naturales+Saber+11-2021.pdf) | - |
| `icfes-icfes-2021-matematicas-cuadernillo` | 12 | 2 | 12 oficial | [enlace](https://web.archive.org/web/20210820154126id_/https://www.icfes.gov.co/documents/20143/1713188/Cuadernillo+de+preguntas+Matematicas+Saber+11-2021.pdf) | - |
| `icfes-icfes-2021-sociales-cuadernillo` | 3 | 8 | 3 oficial | [enlace](https://web.archive.org/web/20211005234206id_/https://www.icfes.gov.co/documents/20143/1713188/Cuadernillo+de+preguntas+Sociales+y+Ciudadanas+Saber+11-2021.pdf) | - |

### Saber 11 (explicadas): 1 elegibles

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-01_explicadas_lectura` | 1 | 1 | 1 oficial | [enlace](http://icfes.acendra.com.co/wp-content/uploads/2024/12/01_explicadas_lectura.pdf) | - |

### Saber 11 2024: 12 elegibles

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-16-octubre-cuadernillo-ingles-saber-11-2024-e1` | 8 | 0 | 8 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2025/12/16-octubre-cuadernillo-ingles-saber-11-2024.pdf) | - |
| `icfes-16-octubre-cuadernillo-ingles-saber-11-2024-e2` | 4 | 0 | 4 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2025/12/16-octubre-cuadernillo-ingles-saber-11-2024.pdf) | - |

### Saber 11 2025: 0 elegibles

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-22-diciembre-cuadernillo-de-preguntas-ciencias-naturales-saber-11-2025` | 0 | 12 | - | [enlace](https://www.icfes.gov.co/wp-content/uploads/2025/12/22-diciembre-cuadernillo-de-preguntas-ciencias-naturales-saber-11-2025.pdf) | - |

### Saber 11 2026: 101 elegibles

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-09-marzo_cuadernillo-de-preguntas-matematicas-saber-11-2026` | 37 | 0 | 37 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2026/04/09-Marzo_Cuadernillo-de-Preguntas-Matematicas-Saber-11-2026.pdf) | - |
| `icfes-16-feb-cuadernillo-de-preguntas-lectura-critica-saber-11-2026` | 42 | 5 | 42 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2026/03/16-feb-cuadernillo-de-preguntas-lectura-critica-saber-11-2026.pdf) | - |
| `icfes-24-feb-cuadernillo-preguntas-ciencias-naturales-saber-11-2026` | 22 | 0 | 22 oficial | [enlace](https://www.icfes.gov.co/wp-content/uploads/2026/03/24-feb-cuadernillo-preguntas-ciencias-naturales-saber-11-2026.pdf) | - |

### Evaluar para Avanzar 2021: 173 elegibles

Prueba formativa del ICFES para grado 11, no el Saber 11. Enlaces de Google Drive publicados en <https://sites.google.com/view/evaluar-para-avanzar-2021/>, salvo los de universate.co.

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-epa-2021-ciencias-1` | 20 | 0 | 20 dos soluciones | [enlace](https://universate.co/wp-content/uploads/2023/12/Cuadernillo-Ciencias_Naturales-11-2021.pdf) | - |
| `icfes-epa-2021-ingles-1` | 20 | 0 | 20 dos soluciones | [enlace](https://universate.co/wp-content/uploads/2023/12/Cuadernillo-Ingles-11-2021.pdf) | - |
| `icfes-epa-2021-ingles-2` | 22 | 0 | 16 oficial, 6 dos soluciones | [enlace](https://drive.google.com/file/d/1BnluXVMth08mwFG1Zo8WnzelA7-JQCZU) | [guía](https://drive.google.com/file/d/10pSLQY-AF2Blh2RMlW3elmhIiIlL4ll9) |
| `icfes-epa-2021-lectura-1` | 17 | 0 | 17 dos soluciones | [enlace](https://universate.co/wp-content/uploads/2023/12/Cuadernillo-LecturaCritica-11-2021.pdf) [enlace](https://universate.co/wp-content/uploads/2023/12/Matematicas-Grado.11-2021.pdf) | - |
| `icfes-epa-2021-lectura-2` | 18 | 2 | 15 oficial, 3 dos soluciones | [enlace](https://drive.google.com/file/d/1mkWzgxjSM7mGP0GhvTbnxvIZB8lVZkqp) | [guía](https://drive.google.com/file/d/1gSzbziY2g61inICZ_2wWoxOpsev0ztUU) |
| `icfes-epa-2021-matematicas-1` | 19 | 0 | 19 dos soluciones | [enlace](https://universate.co/wp-content/uploads/2023/12/Matematicas-Grado.11-2021.pdf) | - |
| `icfes-epa-2021-matematicas-2` | 20 | 0 | 18 oficial, 2 dos soluciones | [enlace](https://drive.google.com/file/d/1yCt_sdAhzXpV96ou_1kGMtyT-KUzi-Sx) | [guía](https://drive.google.com/file/d/10M06gP62ooec89GiXWSE2pfkoEodqn2c) |
| `icfes-epa-2021-sociales-1` | 19 | 1 | 19 dos soluciones | [enlace](https://universate.co/wp-content/uploads/2023/12/Cuadernillo-SocialesyCiudadanas-11-2021.pdf) | - |
| `icfes-epa-2021-sociales-2` | 18 | 1 | 18 oficial | [enlace](https://drive.google.com/file/d/1R3emY3eyx_ezkICTb1poNK-JOlPbuDyP) | [guía](https://drive.google.com/file/d/1ZVgEAkY6y2TU16J6MIkqsh3nijmOkWnF) |

### Evaluar para Avanzar 2022: 98 elegibles

Prueba formativa del ICFES para grado 11, no el Saber 11. Enlaces de Google Drive publicados en <https://sites.google.com/view/evaluar-para-avanzar-2021/>, salvo los de universate.co.

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-epa-2022-ciencias-1` | 20 | 0 | 20 oficial | [enlace](https://universate.co/wp-content/uploads/2023/12/Cuadernillo-Ciencias_Naturales-11-2022.pdf) | [guía](https://drive.google.com/file/d/1ZBmWu5TlsDLQUG2wNbxOZRWYvowoqaWZ) |
| `icfes-epa-2022-ingles-1` | 23 | 0 | 23 oficial | [enlace](https://drive.google.com/file/d/1YpHAWHFJTUfW3boExl1ImnFrx0cq-Swu) | [guía](https://drive.google.com/file/d/1koFRc_DXbL2iX_7Epbt4oDZE0HZ8WvQ2) |
| `icfes-epa-2022-lectura-1` | 15 | 3 | 15 oficial | [enlace](https://drive.google.com/file/d/1gjvASgQ_BprxSk5EuJW4u3bbAMY0kNr6) | [guía](https://drive.google.com/file/d/1CYoYVDqzPYe6801q2mMwW2_2q-4FOBCD) |
| `icfes-epa-2022-matematicas-1` | 20 | 0 | 20 oficial | [enlace](https://drive.google.com/file/d/1cUrklBMlc6zT0ttpPqpuiKGN0N1oE_Op) [enlace](https://drive.google.com/file/d/1apG7e4Lcu99gyzSTRMMiQOA4LvstbeF6) | [guía](https://drive.google.com/file/d/1cUrklBMlc6zT0ttpPqpuiKGN0N1oE_Op) |
| `icfes-epa-2022-sociales-1` | 20 | 0 | 20 oficial | [enlace](https://drive.google.com/file/d/1JbL265Whe87aPgiQ0O5sQeCPQUcOa3ih) | [guía](https://drive.google.com/file/d/1cYZZwZqwsJVjCsyO_os-VfJq3Q57SZxG) |

### Evaluar para Avanzar 2023: 114 elegibles

Prueba formativa del ICFES para grado 11, no el Saber 11. Enlaces de Google Drive publicados en <https://sites.google.com/view/evaluar-para-avanzar-2021/>, salvo los de universate.co.

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-epa-2023-ciencias-1` | 7 | 1 | 7 oficial | [enlace](https://drive.google.com/file/d/1Vd0JC9PvU91V903ZJFJKZVidfgpXP0FD) | [guía](https://drive.google.com/file/d/1V8v7THI5PX08hhoZsksW3g4E7f0d86Ej) |
| `icfes-epa-2023-ciencias-2` | 19 | 1 | 19 oficial | [enlace](https://drive.google.com/file/d/1pt4Vmcz0mrKFhJ03DPyMYOreSh-aWkqI) | [guía](https://drive.google.com/file/d/1j21dnzKH6yov0s6YH3EbvBdH6Bu5vaMb) |
| `icfes-epa-2023-ingles-1` | 10 | 0 | 10 oficial | [enlace](https://drive.google.com/file/d/1d1NzzZ9_1GPMAsr_9nAyWBnJeXR7902l) | [guía](https://drive.google.com/file/d/13ApO1cEQ-NKwx_TXlXTVrzyx3tlDtRFk) |
| `icfes-epa-2023-ingles-2` | 24 | 1 | 24 oficial | [enlace](https://drive.google.com/file/d/1q4KX6nhBDFTIdIFW3srC8tBmEYQON2qe) | [guía](https://drive.google.com/file/d/1agjTLeQb2PuL55uMvOgVHTvtsljtKnK7) |
| `icfes-epa-2023-lectura-1` | 2 | 0 | 2 oficial | [enlace](https://drive.google.com/file/d/1BaWV3usY0AaKwOIGQOGSPHdwJHfle7W9) | [guía](https://drive.google.com/file/d/1xzilKKFnDnDszm33zKO_RduTFCV-T8VX) |
| `icfes-epa-2023-lectura-2` | 16 | 2 | 16 oficial | [enlace](https://drive.google.com/file/d/1JZlcp4sH6BJ00KQt1wnhcjQtJ7xEt0L9) | [guía](https://drive.google.com/file/d/1JwogtMOpyCWrGprbZ9DDArWAdVzEEsqF) |
| `icfes-epa-2023-matematicas-1` | 2 | 1 | 2 oficial | [enlace](https://drive.google.com/file/d/1RkaaYaAVJRjh1Ij44xp4zTy13PFIrMyM) | [guía](https://drive.google.com/file/d/1NyRm_O9LEs7A9EyFcj06Q-ZZjQrhl8T2) |
| `icfes-epa-2023-matematicas-2` | 18 | 1 | 18 oficial | [enlace](https://drive.google.com/file/d/1x0i8ofbJpR9NhkrAteXWsALadkJnx6EJ) | [guía](https://drive.google.com/file/d/1owwki2uDjw0bEQJvKIEL96RxBcvZIRIk) |
| `icfes-epa-2023-sociales-2` | 16 | 4 | 16 oficial | [enlace](https://drive.google.com/file/d/1XpI_xUWBqmSurGOMx2tcnvvpThBL1OGP) | [guía](https://drive.google.com/file/d/1tGdgYZYZ_Kzqe8t6MP71chcZL7aQUFY8) |

### Examen aplicado (reservado): 480 elegibles

Copias de cuadernillos marcados "uso exclusivo del Icfes". El dueño decidió subirlos a producción el 2026-11-09; la revisión legal sigue pendiente. Sus escaneos originales llevaban datos del examinado y se borraron, por eso no hay sha256.

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `icfes-reservado-2024-1-s1-ciencias` | 22 | 5 | 22 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-1-s1-lectura` | 46 | 3 | 46 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-1-s1-matematicas` | 20 | 4 | 20 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-1-s1-sociales` | 23 | 1 | 23 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-2-s1-ciencias` | 55 | 4 | 55 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-2-s1-lectura` | 21 | 4 | 21 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-2-s1-matematicas` | 42 | 8 | 42 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-2-s1-sociales` | 12 | 4 | 12 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-2-s2-ciencias` | 14 | 4 | 14 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-2-s2-ingles` | 54 | 0 | 54 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-2-s2-matematicas` | 27 | 2 | 27 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2024-2-s2-sociales` | 22 | 3 | 22 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2025-2-s1-ciencias` | 13 | 0 | 13 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2025-2-s1-lectura` | 31 | 2 | 31 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2025-2-s1-matematicas` | 4 | 1 | 4 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2025-2-s1-sociales` | 24 | 1 | 24 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2025-2-s2-ciencias` | 3 | 0 | 3 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2025-2-s2-ingles` | 23 | 0 | 23 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2025-2-s2-matematicas` | 9 | 1 | 9 dos soluciones | ver archivo reservado | - |
| `icfes-reservado-2025-2-s2-sociales` | 15 | 0 | 15 dos soluciones | ver archivo reservado | - |

### Otro: 100 elegibles

| Cuadernillo | Elegibles | Fuera | Clave | Fuente | Guía de claves |
|---|---|---|---|---|---|
| `ai-generated` | 100 | 0 | 100 IA | `docs/seed-bank/` | - |

"Fuera" suma duplicadas, en espera y excluidas para revisión de una persona. Las 62 en espera de la última carga, con su motivo, están en `content/revision-banco/2026-11-09-ampliacion-2-en-espera.json`.

En la última carga además se descartaron, sin crear fila, 96 preguntas que ya estaban en el banco y 261 repetidas dentro del mismo lote.

## Encontradas y no usadas

No las vuelvas a procesar sin un motivo nuevo.

| Fuente | Qué es | Por qué no entró |
|---|---|---|
| `content/saber11-formato-viejo/cuadernillo-saber11-2012.pdf` | Saber 11 2012, unas 180 preguntas, clave impresa | Formato anterior a 2014; pendiente de decisión |
| `content/saber11-formato-viejo/cuadernillo-saber11-2016.pdf` | Copia del cuadernillo de 2014 | Mismo contenido que 2014 |
| Resto de `content/saber11-formato-viejo/` | Materias sueltas, anteriores a 2014 | Filosofía, Historia y Geografía no caben en la taxonomía |
| `content/altopuntaje/` (5 PDF) | Cuadernillos por área | Sin clave impresa; mismas preguntas que los de 2019 y 2021 |
| universate.co, copias de Evaluar para Avanzar 2022 y 2023 | `Cuadernillo-*-11-2022.pdf`, `Cuadernillo-*-11-1.pdf` | Iguales a las de Google Drive, salvo Ciencias 2022, que sí se usó |
| `content/icfes-extra/mirror-*` e `icfes-2021-ingles-cuadernillo-b`, `icfes-guia-2017-1-b`, `icfes-2026-lectura-cuadernillo-sept` | Espejos y reediciones | Duplicados. La edición de septiembre de 2026 de Lectura aún tiene unas 3 preguntas nuevas |
| `content/icfes-extra/icfes-guia-2018-*`, `2021-*`, `2022-1`, `2025-*`, `2026-*`, `icfes-mr-*` | Guías y marcos de referencia | Unas 2 a 9 preguntas de ejemplo cada una, sin clave impresa |
| matematicasievg.wordpress.com, `guia-{cienciasnaturales,lecturacritica,matematicas}-11-1.pdf` | Guías docentes de Evaluar para Avanzar, edición 2020 | Coinciden 25 a 39 % con el Cuadernillo 1 de 2021: son de otra edición |
| `www2.icfes.gov.co/documents/39286/...` | Servidor antiguo del ICFES | No respondió el 2026-11-09 |

## Por conseguir

| Fuente | Qué podría aportar | Estado |
|---|---|---|
| Archive.org, lista en `content/icfes-extra/pending-wayback.tsv` | 27 archivos: cuadernillos de 2019 a 2022, preguntas explicadas y guías | Bloqueado por límite de consultas; el dueño debe escribirles antes de reintentar |
| Guías docentes faltantes de Evaluar para Avanzar | Claves oficiales de 2021 Cuadernillo 1 (las 106 preguntas marcadas por nosotros) | Sin localizar la edición correcta |
| <https://iedjesusdenazaret.wordpress.com/pruebas/> | Saber 3, 5, 7 y 9 de 2002 a 2015 | Sin descargar; sirve para grados 6 a 9 |
| <https://www.gimnasiosantorey.edu.co/gsr/cuadernillos-evaluar-para-avanzar/> | Evaluar para Avanzar, otros grados | Sin descargar |
| <https://www.valledelcauca.gov.co/documentos/13089/cuadernillos-pruebas-saber-11-ano-2019/> | Cuadernillos de 2019 | Sin descargar; compara huellas primero |
| examenes.lat, elestudiante.com.co, icfesresultados.com, SlideShare, Scribd, PDFCOFFEE | Copias de terceros | Sin explorar; no son fuente primaria |
