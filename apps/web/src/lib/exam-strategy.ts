/**
 * Saber 11 test-taking strategy (F35): points a student wins without knowing
 * more. Fixed text, not generated. A draft for the teaching team to review
 * (plans/ruta-mejora-pedagogica.md, F35).
 */
export const GENERAL_STRATEGY = [
  'Una respuesta equivocada no resta: responde todas, aunque sea descartando opciones.',
  'Ritmo oficial: unos 2 minutos y 15 segundos por pregunta. Si una te atasca, márcala y vuelve al final.',
  'En los bloques que comparten un texto o una gráfica, léelo una vez con calma y responde todas sus preguntas seguidas.',
]

export const AREA_STRATEGY: Record<string, string[]> = {
  lectura_critica: [
    'Lee primero la pregunta: así sabes qué buscar en el texto.',
    'Separa lo que el texto dice de lo que tú opinas: la respuesta está en el texto.',
    'Si preguntan por la intención del autor, busca el propósito de todo el texto, no un detalle.',
  ],
  matematicas: [
    'No hay calculadora: estima y descarta las opciones que no tienen sentido.',
    'Dibuja la situación y revisa las unidades antes de calcular.',
    'A veces es más rápido probar las opciones en el enunciado que despejar.',
  ],
  ciencias_naturales: [
    'En gráficas y tablas, mira primero los ejes, las unidades y qué variable cambia.',
    'En preguntas de experimentos, identifica qué se controla y qué se mide.',
  ],
  sociales_ciudadanas: [
    'Identifica los actores y qué quiere cada uno antes de elegir.',
    'Distingue hechos de opiniones, y piensa en las consecuencias de cada decisión.',
    'En ciudadanas, el marco es la Constitución de 1991 y los derechos fundamentales.',
  ],
  ingles: [
    'Las primeras partes son de avisos y vocabulario: respóndelas rápido para ahorrar tiempo.',
    'En lectura, busca en el texto las palabras clave de la pregunta.',
  ],
}
