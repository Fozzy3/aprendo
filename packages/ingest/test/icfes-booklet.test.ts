import { describe, expect, test } from 'bun:test'
import {
  parseAnswerKey,
  parseBooklet,
  referencesArtwork,
  usableQuestions,
} from '../src/icfes-booklet'
import { guessSubtopic } from '../src/icfes-subtopic-guess'
import taxonomyContract from '../../../docs/taxonomy.v1.json'

describe('parseAnswerKey', () => {
  // The booklets print the key in two columns. An earlier version let the
  // optional performance-level group swallow the first digit of the second
  // column, so `1  A   26  C` was read as 1→A and 6→C: half the key was lost
  // and the other half was silently wrong.
  test('reads both columns of a two-column key', () => {
    const key = parseAnswerKey(`
Tabla de respuestas correctas

  1    A         26    C
  2    C         27    A
 25    A         50    A
`)
    expect(key.get(1)?.option).toBe('A')
    expect(key.get(26)?.option).toBe('C')
    expect(key.get(2)?.option).toBe('C')
    expect(key.get(27)?.option).toBe('A')
    expect(key.get(50)?.option).toBe('A')
    expect(key.get(6)).toBeUndefined()
  })

  test('keeps the performance level when the key carries one', () => {
    const key = parseAnswerKey(`
 3    E            A1
 4    B          Pre A1
20    D            B1
`)
    expect(key.get(3)).toEqual({ option: 'E', level: 'A1' })
    expect(key.get(4)).toEqual({ option: 'B', level: 'Pre A1' })
    expect(key.get(20)).toEqual({ option: 'D', level: 'B1' })
  })

  test('ignores numbers too large to be a question', () => {
    expect(parseAnswerKey('\n 2021    A\n').get(2021)).toBeUndefined()
  })
})

describe('referencesArtwork', () => {
  test('flags wording that depends on something the text layer cannot carry', () => {
    for (const text of [
      'En la figura, los círculos sombreados representan las paradas.',
      'Según la tabla, el valor de x es',
      'La siguiente ecuación representa la reacción',
      'De acuerdo con la gráfica anterior',
    ]) {
      expect(referencesArtwork(text)).toBe(true)
    }
  })

  test('leaves plain prose alone', () => {
    expect(referencesArtwork('¿Cuál de las siguientes afirmaciones es correcta?')).toBe(false)
  })
})

const BOOKLET = `
¿Qué contiene este cuadernillo?
Preguntas de la prueba que fueron utilizadas en aplicaciones anteriores del
examen. ¡Recuerda! El examen Saber 11.° evalúa competencias para elegir la respuesta
correcta.

RESPONDA LAS PREGUNTAS 1 Y 2 DE ACUERDO CON LA SIGUIENTE INFORMACIÓN

         Uno de los escenarios donde empezó a codearse el vallenato con la música que
         escuchaba la burguesía fue el de las colitas. Era este el nombre que recibían
         los finales de fiesta de la clase adinerada, y durante el sarao los trabajadores
         pasaban la fiesta en la cocina a punta de acordeón, guacharaca y caja.

         Tomado de: Samper, D. (1997). 100 años de vallenato.

         Pregunta 1

         El autor introduce la cita con el fin de

               A.   reforzar la tesis principal del texto, según la cual las colitas
                    fueron divulgadoras del género.
               B.   señalar una posición discutible.
               C.   legitimar la tesis principal.
               D.   convencer al lector.

         Pregunta 2

         Según el texto, las piquerias

               A.   propagaron el género.
               B.   lo extinguieron.
               C.   no existieron.
               D.   eran europeas.

         Pregunta 3

         En la figura se representa una ruta de buses.

               A.   Uno.
               B.   Dos.
               C.   Tres.
               D.   Cuatro.

Tabla de respuestas correctas

  1    B         3    A
  2    A
`

describe('parseBooklet', () => {
  const questions = parseBooklet(BOOKLET)

  test('finds every question with its options and printed answer', () => {
    expect(questions.map((q) => q.number)).toEqual([1, 2, 3])
    expect(questions[0]?.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(questions[0]?.correctOption).toBe('B')
    expect(questions[1]?.correctOption).toBe('A')
  })

  // The failure this whole module exists to avoid: a Lectura Crítica item
  // without its passage is unanswerable, and shipping one reproduces the
  // grouping bug the project already fixed once.
  test('gives every member of a group the same passage', () => {
    expect(questions[0]?.contextMarkdown).toContain('vallenato')
    expect(questions[1]?.contextMarkdown).toContain('vallenato')
    expect(questions[0]?.contextKey).toBe(questions[1]?.contextKey)
  })

  test('keeps the instruction heading out of the passage', () => {
    expect(questions[0]?.contextMarkdown).not.toContain('RESPONDA')
  })

  test('keeps the licence and cover blurb out of the passage', () => {
    for (const question of questions) {
      expect(question.contextMarkdown ?? '').not.toContain('¡Recuerda!')
      expect(question.contextMarkdown ?? '').not.toContain('cuadernillo')
    }
  })

  test('drops the source credit from the passage', () => {
    expect(questions[0]?.contextMarkdown).not.toContain('Tomado de')
  })

  // Option D of Lectura question 1 once absorbed the next group's heading and
  // its entire 2000-character passage, because option continuation had no
  // stopping rule.
  test('an option stops at the blank line, not at the end of the document', () => {
    const optionA = questions[0]?.options.find((o) => o.label === 'A')
    expect(optionA?.text).toBe(
      'reforzar la tesis principal del texto, según la cual las colitas fueron divulgadoras del género.',
    )
    for (const option of questions[0]?.options ?? []) {
      expect(option.text).not.toContain('Pregunta')
      expect(option.text.length).toBeLessThan(200)
    }
  })

  test('marks the question that needs a figure', () => {
    expect(questions[2]?.needsArtwork).toBe(true)
    expect(questions[0]?.needsArtwork).toBe(false)
  })
})

describe('usableQuestions', () => {
  const questions = parseBooklet(BOOKLET)

  test('keeps only what a student can actually answer', () => {
    expect(usableQuestions(questions).map((q) => q.number)).toEqual([1, 2])
  })

  test('drops a question whose printed answer names an option it does not have', () => {
    const broken = [
      { ...questions[0]!, correctOption: 'F' },
    ]
    expect(usableQuestions(broken)).toHaveLength(0)
  })

  test('drops a question with no printed answer at all', () => {
    const broken = [{ ...questions[0]!, correctOption: undefined }]
    expect(usableQuestions(broken)).toHaveLength(0)
  })
})

describe('guessSubtopic', () => {
  const taxonomy = taxonomyContract as {
    subjects: Array<{
      id: string
      categories: Array<{ id: string; subtopics: Array<{ id: string }> }>
    }>
  }
  const validIds = new Set<string>()
  for (const subject of taxonomy.subjects) {
    for (const category of subject.categories) {
      validIds.add(category.id)
      for (const subtopic of category.subtopics) validIds.add(subtopic.id)
    }
  }

  // Six of the Sociales ids in the first draft of the rule table did not exist
  // in the taxonomy. Every one of those questions would have been stored with a
  // tag nothing could ever match, and no error would have been raised anywhere.
  test('every id the rules can produce exists in the taxonomy', () => {
    for (const subjectId of ['lectura_critica', 'matematicas', 'ciencias_naturales', 'sociales_ciudadanas']) {
      const guess = guessSubtopic(subjectId, 'texto sin ninguna señal temática particular')
      expect(guess).not.toBeNull()
      expect(validIds).toContain(guess!.categoryId)
      expect(validIds).toContain(guess!.subtopicId)
    }
  })

  test('picks the subtopic the wording actually points at', () => {
    expect(guessSubtopic('matematicas', 'Calcula el área y el perímetro del cilindro')?.subtopicId)
      .toBe('matematicas.geometry_measurement.perimeter_area_volume')
    expect(guessSubtopic('matematicas', '¿Cuál es la probabilidad de que al azar salga cara?')?.subtopicId)
      .toBe('matematicas.data_statistics_chance.probability_counting')
  })

  test('matches regardless of accents', () => {
    const withAccents = guessSubtopic('matematicas', 'La función y su gráfica')
    const without = guessSubtopic('matematicas', 'La funcion y su grafica')
    expect(withAccents?.subtopicId).toBe(without!.subtopicId)
  })

  // A tag from a single incidental word must not be trusted to place a student.
  test('reports low confidence when nothing matched', () => {
    expect(guessSubtopic('matematicas', 'zzz qqq')?.confidence).toBe(0)
  })

  test('confidence rises with independent term hits', () => {
    const weak = guessSubtopic('ciencias_naturales', 'La energía del sistema')!
    const strong = guessSubtopic('ciencias_naturales', 'La energía, el calor y la temperatura del sistema térmico')!
    expect(strong.confidence).toBeGreaterThan(weak.confidence)
  })

  test('returns null for a subject with no rules', () => {
    expect(guessSubtopic('ingles', 'anything at all')).toBeNull()
  })
})
