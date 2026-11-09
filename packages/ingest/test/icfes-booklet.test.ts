import { describe, expect, test } from 'bun:test'
import {
  groupSlots,
  inlineAnswer,
  parseAnswerKey,
  parseBooklet,
  parseExamAnswerKeys,
  referencesArtwork,
  figureQuestions,
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

  // The 2026 booklets say "respuestas correctas" on their cover. Scanning from
  // there reads the whole document, so any `7 B` shaped fragment in a question
  // becomes a key for a number the real table does not list.
  test('starts at the key table, not at a mention on the cover', () => {
    const key = parseAnswerKey(`
Al final encontrará las respuestas correctas, con su explicación.

La figura 7 B muestra el recorrido.

Tabla de respuestas correctas
  1    A
  2    C
`)
    expect(key.get(1)?.option).toBe('A')
    expect(key.get(7)).toBeUndefined()
  })

  // The 2026 table puts the assessed statement between number and letter, and
  // the middle line of a wrapped statement shares a row with both. Those rows
  // were skipped: 13 of the 50 Ciencias Naturales keys.
  test('reads a row whose statement sits between the number and the letter', () => {
    const key = parseAnswerKey(`
Tabla de respuestas correctas
   3                                                                 C
   4       naturaleza con base en observaciones, patrones y          B
`)
    expect(key.get(3)?.option).toBe('C')
    expect(key.get(4)?.option).toBe('B')
  })

  test('a booklet with only a weak heading still reads its key', () => {
    const key = parseAnswerKey(`
Respuestas correctas
  4    D
`)
    expect(key.get(4)?.option).toBe('D')
  })

  test('ignores numbers too large to be a question', () => {
    expect(parseAnswerKey('\n 2021    A\n').get(2021)).toBeUndefined()
  })
})

describe('parseExamAnswerKeys', () => {
  // The Inglés booklets print two exams whose numbers both restart at 1, so a
  // single key map lets the second table overwrite the first.
  test('keeps each exam of a two-exam booklet apart', () => {
    const keys = parseExamAnswerKeys(`
Tabla de respuestas correctas
Examen 1         Dificultad
  1    B          Pre A1
  2    E          Pre A1
Tabla de respuestas correctas
Examen 2         Dificultad
  1    F            A1
  2    C            A1
`)
    expect(keys.get(1)?.get(1)).toEqual({ option: 'B', level: 'Pre A1' })
    expect(keys.get(2)?.get(1)).toEqual({ option: 'F', level: 'A1' })
    expect(keys.get(2)?.get(2)?.option).toBe('C')
  })

  test('reads the heading printed on one line, with a dash', () => {
    const keys = parseExamAnswerKeys(`
Tabla de respuestas correctas - Examen 1
     1          B         Pre A1
Tabla de respuestas correctas - Examen 2
     1          C           A1
`)
    expect(keys.get(1)?.get(1)?.option).toBe('B')
    expect(keys.get(2)?.get(1)?.option).toBe('C')
  })

  test('a single-exam booklet has no exam sections', () => {
    expect(parseExamAnswerKeys('Tabla de respuestas correctas\n 1  A\n').size).toBe(0)
  })
})

describe('inlineAnswer', () => {
  // The explained booklets and the 2017 guides print the answer beside each
  // question instead of in a table at the end.
  test.each([
    ['Respuesta correcta: B', 'B'],
    ['  Respuesta correcta                    D', 'D'],
    ['Respuesta correcta:          D', 'D'],
    ['Respuesta correcta de la descripción 1: B', 'B'],
    ['la respuesta correcta a esta pregunta se encuentra en la opción B.', 'B'],
    ['  encuentra en la opción D.', 'D'],
  ])('reads %s', (line, option) => {
    expect(inlineAnswer(`texto previo\n${line}\ntexto posterior`)).toBe(option)
  })

  test('a heading without a letter is not an answer', () => {
    expect(inlineAnswer('Posición   Respuesta correcta\n 1   A')).toBeUndefined()
    expect(inlineAnswer('Esta es la opción de respuesta correcta, pues')).toBeUndefined()
  })

  test('the first printed answer wins', () => {
    expect(inlineAnswer('Respuesta correcta: A\nOpciones no válidas: B La opción B')).toBe('A')
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

  // Six to eight questions per booklet set their options in a row or print only
  // the labels because each option is a drawing. All of them were dropped, and
  // the two-per-row ones kept option B's text inside option A.
  test('splits options printed side by side in one row', () => {
    const [question] = parseBooklet(`
         Pregunta 1

         ¿Cuál es el resultado?

               A.   diez          B.   veinte
               C.   treinta       D.   cuarenta
`)
    expect(question?.options).toEqual([
      { label: 'A', text: 'diez' },
      { label: 'B', text: 'veinte' },
      { label: 'C', text: 'treinta' },
      { label: 'D', text: 'cuarenta' },
    ])
  })

  test('keeps a question whose options are only drawings, and flags it', () => {
    const [question] = parseBooklet(`
         Pregunta 1

         ¿Cuál modelo representa el gas?

                        A.            B.            C.            D.
`)
    expect(question?.options.map((option) => option.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(question?.options.every((option) => option.text === '')).toBe(true)
    expect(question?.needsArtwork).toBe(true)
  })

  test('reads a label-only row split by tabs', () => {
    const [question] = parseBooklet(`
         Pregunta 1

         ¿Cuál es la medida?

                A.\t\tB.\t\tC.\t\tD.
`)
    expect(question?.options.map((option) => option.label)).toEqual(['A', 'B', 'C', 'D'])
  })

  // The figure questions of the 2025-2026 booklets print their options at the
  // left margin, so the indent rule dropped them whole.
  test('reads options printed at the left margin', () => {
    const [first, second] = parseBooklet(`
Pregunta 1

¿Cuál gráfica muestra los resultados?

A.         B.

C.         D.

Pregunta 2

¿Cuál procedimiento es adecuado?

A.    Medir primero la muestra.
B.    Medir después la muestra.
`)
    expect(first?.options.map((option) => option.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(second?.options.map((option) => option.text)).toEqual([
      'Medir primero la muestra.',
      'Medir después la muestra.',
    ])
    expect(second?.contextMarkdown).toBeUndefined()
  })

  test('the page footer after the last option does not continue it', () => {
    const [question] = parseBooklet(`
Pregunta 1

¿Cuánto mide?

   A.   16 cm.
   D.   64 cm.
                                                                                    17
                                                                  Cuadernillo de preguntas
                                                                                    .
                                                                  Prueba Matemáticas

Pregunta 2

Otra.

   A.   1
   B.   2
`)
    expect(question?.options[1]?.text).toBe('64 cm.')
  })

  test('a label mentioned in the option text is not a new option', () => {
    const [question] = parseBooklet(`
         Pregunta 1

         ¿Cuál afirmación es cierta?

               A.   la opción B. es la mejor
               B.   ninguna
`)
    expect(question?.options.map((option) => option.label)).toEqual(['A', 'B'])
    expect(question?.options[0]?.text).toBe('la opción B. es la mejor')
  })

  test('reads the answer printed beside the question when there is no table', () => {
    const [question] = parseBooklet(`
         Pregunta 1

         ¿Cuál es la medida?

               A.   uno
               B.   dos

         Respuesta correcta: B
`)
    expect(question?.correctOption).toBe('B')
  })

  // A guide has no key table, so the weak heading matches the first inline
  // answer and every `3 B` shaped fragment after it reads as a key.
  test('the answer beside the question beats a key-shaped row elsewhere', () => {
    const [question] = parseBooklet(`
         Pregunta 3

         ¿Cuál es la medida?

               A.   uno
               B.   dos

         Respuesta correcta: B

         El nivel 3 A corresponde a esta pregunta.
`)
    expect(question?.correctOption).toBe('B')
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

describe('groupSlots', () => {
  // The loader ships questions to Convex in slices of twenty. Working groups
  // out per slice split a passage over questions 19-22 into two groups of two.
  test('a passage that straddles a slice boundary stays one group', () => {
    const questions = [17, 18, 19, 20, 21, 22, 23].map((number) => ({
      number,
      contextKey: number >= 19 && number <= 22 ? 'g19-22' : undefined,
    }))
    const slots = groupSlots(questions)

    expect(slots.slice(0, 2)).toEqual([null, null])
    expect(slots[6]).toBeNull()
    expect(slots.slice(2, 6)).toEqual([19, 20, 21, 22].map((_, position) => ({
      key: 'g19-22',
      firstNumber: 19,
      lastNumber: 22,
      memberCount: 4,
      position,
    })))
  })

  // An item can be unusable (no key, needs a figure) and dropped from the run,
  // so the range is the members that remain, not the printed heading.
  test('counts only the members that are actually present', () => {
    const slots = groupSlots([
      { number: 4, contextKey: 'g4-7' },
      { number: 6, contextKey: 'g4-7' },
      { number: 7, contextKey: 'g4-7' },
    ])
    expect(slots.map((slot) => [slot?.firstNumber, slot?.lastNumber, slot?.memberCount, slot?.position]))
      .toEqual([[4, 7, 3, 0], [4, 7, 3, 1], [4, 7, 3, 2]])
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
    for (const subjectId of ['lectura_critica', 'matematicas', 'ciencias_naturales', 'sociales_ciudadanas', 'ingles']) {
      const guess = guessSubtopic(subjectId, 'texto sin ninguna señal temática particular')
      expect(guess).not.toBeNull()
      expect(validIds).toContain(guess!.categoryId)
      expect(validIds).toContain(guess!.subtopicId)
    }
  })

  // English is tagged like every other area: a sign, a gap, a reading item.
  test('tags an English item from its wording', () => {
    expect(guessSubtopic('ingles', '¿Dónde puede ver estos avisos?')?.subtopicId)
      .toBe('ingles.pragmatics_functions.notices_instructions_signage')
    expect(guessSubtopic('ingles', 'Seleccione la palabra correcta para el espacio (18) del texto.')?.subtopicId)
      .toBe('ingles.grammar_language_use.verb_tenses_forms')
    expect(guessSubtopic('ingles', 'What is the writer trying to do in this text?')?.subtopicId)
      .toBe('ingles.reading_inferential.inferences_conclusions')
    expect(guessSubtopic('ingles', 'zzz qqq')?.subtopicId).toBe('ingles.reading_literal.explicit_info_paraphrase')
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
    expect(guessSubtopic('historia', 'anything at all')).toBeNull()
  })
})

describe('figureQuestions', () => {
  const parsed = (overrides: object) => ({
    number: 1, stem: 'Según la gráfica…', options: [{ label: 'A', text: 'x' }, { label: 'B', text: 'y' }, { label: 'C', text: 'z' }],
    correctOption: 'B', needsArtwork: true, ...overrides,
  })

  // A third of the bank was discarded for leaning on a figure, and its crops
  // became orphans. With a printed key and a crop a person can read them.
  test('a figure question with a printed key is kept for review', () => {
    expect(figureQuestions([parsed({})]).map((q) => q.number)).toEqual([1])
  })

  test('a plain question is not a figure question', () => {
    expect(figureQuestions([parsed({ needsArtwork: false })])).toEqual([])
  })

  test('no printed key, or a key that is not an option, is left out', () => {
    expect(figureQuestions([parsed({ correctOption: undefined })])).toEqual([])
    expect(figureQuestions([parsed({ correctOption: 'H' })])).toEqual([])
  })

  test('usable and figure questions never overlap', () => {
    const all = [parsed({ number: 1 }), parsed({ number: 2, needsArtwork: false })]
    const usable = usableQuestions(all).map((q) => q.number)
    const figure = figureQuestions(all).map((q) => q.number)
    expect(usable.filter((n) => figure.includes(n))).toEqual([])
    expect([...usable, ...figure].sort()).toEqual([1, 2])
  })
})
