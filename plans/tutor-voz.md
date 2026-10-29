# Tutor por voz (speech to speech)

Estado: **fase 0 construida** (2026-10-29, `apps/web/src/lib/speech.ts` y el chat del tutor). Fases 1 y 2 sin construir.

Meta: el estudiante le habla al tutor de una pregunta y el tutor le responde
hablando, con el mismo método socrático del chat (`packages/convex/src/tutor.ts`).

## Lo que ya existe y se reusa

- Un hilo de chat por pregunta (`practiceTutorThreads`), con streaming (`thread.streamText`, `saveStreamDeltas`).
- Guardas: `assertIsStudent`, `canUseTutor` (el tutor nunca se abre en nivelación ni en simulacro en curso), cupo diario `LLM_DAILY_LIMITS`, `abortPracticeTutorStream`.
- El prompt del tutor (alcance, fiabilidad, método socrático).

La voz debe ser **otra entrada y otra salida del mismo tutor**, no un tutor nuevo. Si no, hay dos cerebros con dos juegos de reglas que probar.

## Opciones

| | A. Navegador (Web Speech API) | B. En cascada: STT → tutor actual → TTS | C. Voz nativa (Gemini Live / OpenAI Realtime) |
|---|---|---|---|
| Cómo | `SpeechRecognition` + `speechSynthesis` en el cliente | Audio → Convex transcribe → `sendPracticeTutorMessage` → texto por frases → TTS | El navegador habla directo con el modelo por WebRTC/WebSocket con un token efímero que emite Convex |
| Latencia | ~1 s | ~2–3 s | ~0,5 s, con interrupción natural |
| Costo extra | 0 | STT ~$0,003/min + TTS ~$0,015/min | Gemini Live ~$0,02/min · gpt-realtime ~$0,05–0,11/min |
| Mismo tutor y reglas | Sí | **Sí** | No: otro modelo, el prompt va en la sesión y hay que volver a probar las guardas |
| Soporte | Sin STT en Firefox, voces de calidad variable en Android, Chrome manda el audio a Google | Todo navegador con `MediaRecorder` | Todo navegador moderno |
| Riesgo | Calidad y privacidad que no controlamos | Bajo | Costo, auditoría y guardas |

Precios aproximados de fuentes de terceros y de la página de Gemini (oct 2026). Hay que confirmarlos antes de construir.

## Recomendación

1. **Fase 0, un día de prueba (A):** botón de micrófono solo donde exista `SpeechRecognition`, y respuesta leída con `speechSynthesis`. Sirve para medir si los estudiantes de verdad usan la voz. No se cobra ni se guarda audio.
2. **Fase 1, el producto (B):** pulsar para hablar sobre el tutor actual. Es la que conserva el método, las guardas y el cupo.
3. **Fase 2, solo si los datos lo justifican (C):** conversación libre con interrupciones. Se hace cuando la fase 1 muestre uso sostenido y la latencia sea la queja principal.

## Arquitectura de la fase 1

```
Navegador (ReviewTutor)                    Convex                          Proveedores
──────────────────────                     ──────                          ───────────
[mantén para hablar]
MediaRecorder (opus/mp4, ≤60 s) ──bytes──▶ action tutor.transcribe ──────▶ STT (es, con vocabulario
                                           · assertIsStudent, canUseTutor     del área como prompt)
                                           · cupo de segundos de voz
                              ◀──texto──── · no guarda el audio
muestra la transcripción (editable)
        │
        └──────────────────────────────▶  action sendPracticeTutorMessage
                                           (mode: 'voz' → reglas de voz
                                            en el prompt)  ──────────────▶ LLM actual (stream)
stream del texto ◀──── useUIMessages ───── deltas guardados en el hilo
corta por frases ──frase──────────────────▶ httpAction /tts (auth) ────────▶ TTS (voz es-CO/es-MX)
cola de <audio>   ◀──audio en stream──────
[tocar = callar] ──────────────────────────▶ abortPracticeTutorStream
```

Piezas nuevas, todas pequeñas:

- **`transcribeTutorAudio` (action):** recibe `v.bytes()` con tope de tamaño, aplica las mismas guardas que el chat y devuelve el texto. El audio no se guarda.
- **Modo voz en el prompt:** un bloque más en `buildTutorSystemPrompt` para cuando el mensaje llega por voz. Sin LaTeX (las fórmulas se dicen en palabras: "x al cuadrado más tres"), máximo dos frases y sin listas. Las opciones se nombran por letra. La pregunta sigue en pantalla, así que el tutor puede decir "mira la gráfica".
- **`/tts` (httpAction):** recibe una frase, la pasa al proveedor y devuelve el audio en stream. El cliente pide cada frase apenas termina en el stream de texto, así la primera se oye antes de que el modelo acabe.
- **Cupo:** sumar `voiceSeconds` al conteo diario (por ejemplo 10 min al día individual y 20 en colegio), junto al de mensajes.
- **Cliente:** un botón de micrófono en `ReviewTutor`. El estudiante ve la transcripción antes de enviarla, porque el STT se equivoca con nombres y fórmulas. Mientras suena, el botón dice "Detener".

## Riesgos y reglas

- **Menores de edad.** La mayoría de usuarios tiene 16–17 años. La voz es un dato personal y la Ley 1581 de 2012 exige cuidado reforzado con menores. Reglas: no guardar audio, guardar solo la transcripción en el hilo, pedir el micrófono solo al tocar el botón, actualizar `/privacidad`, y en colegios contar con la autorización del colegio. Revisar la retención de datos del proveedor (preferir uno con retención cero).
- **Matemáticas habladas.** Escuchar una ecuación larga no sirve. El tutor la nombra en voz y la deja escrita en el chat: la voz complementa la pantalla, no la reemplaza.
- **Exámenes.** La voz hereda `canUseTutor`: nada de voz en nivelación ni en simulacro en curso.
- **Inglés.** El Saber 11 de inglés no evalúa habla ni escucha (es lectura y uso del idioma). No construir pronunciación ni conversación en inglés por esta razón.
- **Ruido en el salón.** Pulsar para hablar evita que el micrófono quede abierto. Por eso la fase 1 no hace detección de voz continua.
- **iOS.** El audio solo suena tras un gesto del usuario. La cola de `<audio>` se "desbloquea" en el mismo toque del micrófono.

## Por qué la voz encaja con el método

El método socrático es diálogo de turnos cortos, y la voz los vuelve naturales. Además, pedirle al estudiante que **explique su razonamiento en voz alta** (autoexplicación) es de las técnicas de estudio con más evidencia. El tutor ya cierra pidiendo "dilo con tus palabras", y hablando eso cuesta menos que escribir.

## Fase 2 (si llega)

El servidor emite un token efímero con el prompt y el contexto de la pregunta ya fijados. Así el cliente no puede cambiar las instrucciones, y el token caduca cuando termina el cupo (por ejemplo 5 min). El navegador habla directo con el modelo. Las transcripciones de ambos lados vuelven a una mutación que las guarda en el mismo hilo, para que el estudiante vea la conversación en texto y el docente siga viendo el uso.
