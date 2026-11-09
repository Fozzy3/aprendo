import { describe, expect, test } from 'bun:test'
import {
  checkCrop,
  checkDuplicateStem,
  checkGroupRange,
  checkKatex,
  checkKeyPresent,
  checkMissingFigure,
  checkOptionCount,
  checkOptionsFilled,
  checkOptionsUnique,
  checkPageFurniture,
  checkPrintedKey,
  checkTaxonomy,
  checkUrlsResolve,
  duplicateStemIndex,
  markdownImageUrls,
  matchOcrPage,
  runDeterministicChecks,
  similarityGate,
  validateGuide,
} from '../src/auditChecks'

const option = (label: string, bodyMarkdown: string) => ({ label, bodyMarkdown })
const ABCD = [option('A', 'uno'), option('B', 'dos'), option('C', 'tres'), option('D', 'cuatro')]
const question = (overrides: object = {}) => ({
  bodyMarkdown: '¿Cuánto es dos más uno?',
  options: ABCD,
  answerCorrectOption: 'C',
  subjectId: 'matematicas',
  categoryId: 'matematicas.number_proportionality',
  primarySubtopicId: 'matematicas.number_proportionality.ratios_proportions_percent',
  ...overrides,
})

describe('key', () => {
  test('a key that is one of the labels passes', () => {
    expect(checkKeyPresent(question()).result).toBe('pass')
  })

  test('no key is a hard failure', () => {
    expect(checkKeyPresent(question({ answerCorrectOption: undefined })).result).toBe('fail')
  })

  test('a key outside the labels is a hard failure', () => {
    expect(checkKeyPresent(question({ answerCorrectOption: 'F' })).result).toBe('fail')
  })

  test('a printed key read again that differs from the stored key fails', () => {
    expect(checkPrintedKey(question(), 'A').result).toBe('fail')
    expect(checkPrintedKey(question(), 'C').result).toBe('pass')
  })

  test('with no printed key there is nothing to compare', () => {
    expect(checkPrintedKey(question(), undefined).result).toBe('pass')
  })
})

describe('options', () => {
  test('the shapes the bank really has are valid: A-C, A-D and A-H', () => {
    const letters = (count: number) => 'ABCDEFGH'.slice(0, count).split('').map((label) => option(label, label))
    expect(checkOptionCount(letters(3)).result).toBe('pass')
    expect(checkOptionCount(letters(4)).result).toBe('pass')
    expect(checkOptionCount(letters(8)).result).toBe('pass')
  })

  test('any other count fails', () => {
    expect(checkOptionCount([option('A', 'x'), option('B', 'y')]).result).toBe('fail')
    expect(checkOptionCount('ABCDE'.split('').map((label) => option(label, label))).result).toBe('fail')
  })

  test('labels must run from A without gaps', () => {
    expect(checkOptionCount([option('A', 'x'), option('B', 'y'), option('D', 'z')]).result).toBe('fail')
  })

  test('an empty option fails: it is a figure the text layer dropped', () => {
    expect(checkOptionsFilled([option('A', 'x'), option('B', '  ')]).result).toBe('fail')
  })

  test('an option that is only an image is not empty', () => {
    expect(checkOptionsFilled([option('A', '![](https://x.co/a.png)'), option('B', 'y')]).result).toBe('pass')
  })

  test('duplicate options fail, ignoring case and spacing', () => {
    expect(checkOptionsUnique([option('A', 'Dos pesos'), option('B', ' dos  pesos ')]).result).toBe('fail')
    expect(checkOptionsUnique(ABCD).result).toBe('pass')
  })

  test('two options that are both images are not duplicates of each other', () => {
    const images = [option('A', '![](https://x.co/a.png)'), option('B', '![](https://x.co/b.png)')]
    expect(checkOptionsUnique(images).result).toBe('pass')
  })
})

describe('figures and pages', () => {
  test('text that points at a figure with no image anywhere is flagged', () => {
    const result = checkMissingFigure(question({ bodyMarkdown: 'Según la gráfica, ¿qué ocurre?' }), null)
    expect(result.result).toBe('warn')
  })

  test('a crop, a markdown image or a group crop counts as the figure', () => {
    const body = 'Según la gráfica, ¿qué ocurre?'
    expect(checkMissingFigure(question({ bodyMarkdown: body, renderedStemImageId: 's' }), null).result).toBe('pass')
    expect(checkMissingFigure(question({ bodyMarkdown: `${body} ![](https://x.co/a.png)` }), null).result).toBe('pass')
    expect(checkMissingFigure(question({ bodyMarkdown: body }), { contextMarkdown: '', renderedContextImageId: 's' }).result).toBe('pass')
  })

  test('page furniture left in a stem is flagged', () => {
    expect(checkPageFurniture('Lee el texto.\nSaber 11.º 7\nContinúa.').result).toBe('warn')
    expect(checkPageFurniture('RESPONDA LAS PREGUNTAS 4 A 7\nTexto').result).toBe('warn')
    expect(checkPageFurniture('www.icfes.gov.co\nTexto').result).toBe('warn')
    expect(checkPageFurniture('¿Cuál es la capital de Boyacá?').result).toBe('pass')
  })

  test('group range against the members that were extracted', () => {
    expect(checkGroupRange({ firstNumber: 4, lastNumber: 7, memberCount: 4 }).result).toBe('pass')
    expect(checkGroupRange({ firstNumber: 4, lastNumber: 7, memberCount: 3 }).result).toBe('warn')
    expect(checkGroupRange(null).result).toBe('pass')
  })

  test('an image that does not resolve fails, a relative OCR path never resolves', () => {
    expect(checkUrlsResolve(['img-0.jpeg'], []).result).toBe('fail')
    expect(checkUrlsResolve(['https://x.co/a.png'], ['https://x.co/a.png']).result).toBe('fail')
    expect(checkUrlsResolve(['https://x.co/a.png'], []).result).toBe('pass')
  })

  test('reads every markdown image', () => {
    expect(markdownImageUrls('a ![](x.png) b ![alt](https://y.co/z)')).toEqual(['x.png', 'https://y.co/z'])
  })

  test('crop sanity', () => {
    expect(checkCrop(question(), null).result).toBe('pass')
    expect(checkCrop(question(), { size: 40_000, contentType: 'image/png' }).result).toBe('pass')
    expect(checkCrop(question(), { size: 40_000, contentType: 'application/pdf' }).result).toBe('warn')
    expect(checkCrop(question(), { size: 12, contentType: 'image/png' }).result).toBe('warn')
  })

  test('a question shown as a scan with no crop fails', () => {
    expect(checkCrop(question({ stemDisplay: 'scan' }), null).result).toBe('fail')
  })
})

describe('katex', () => {
  test('well-formed math passes', () => {
    expect(checkKatex('El valor de $\\frac{1}{2}$ y $$x^{2}$$').result).toBe('pass')
  })

  test('an unclosed dollar is flagged', () => {
    expect(checkKatex('El valor de $x').result).toBe('warn')
  })

  test('unbalanced braces inside math are flagged', () => {
    expect(checkKatex('$\\frac{1{2}$').result).toBe('warn')
  })

  test('an unclosed environment is flagged', () => {
    expect(checkKatex('$\\begin{matrix} 1 $').result).toBe('warn')
  })

  test('an escaped dollar is not math', () => {
    expect(checkKatex('Cuesta \\$500').result).toBe('pass')
  })
})

describe('duplicates and taxonomy', () => {
  test('finds the earlier row with the same text, ignoring case, accents and spacing', () => {
    const index = duplicateStemIndex([
      { _id: 'a', bodyMarkdown: 'Cuál es  el área' },
      { _id: 'b', bodyMarkdown: 'cuál es el Área' },
      { _id: 'c', bodyMarkdown: 'otra cosa' },
    ])
    expect(index.get('b')).toBe('a')
    expect(index.has('a')).toBe(false)
    expect(index.has('c')).toBe(false)
  })

  test('the same short stem under two passages is not a duplicate', () => {
    const index = duplicateStemIndex([
      { _id: 'a', bodyMarkdown: '¿Qué sugiere el autor?', groupId: 'g1' },
      { _id: 'b', bodyMarkdown: '¿Qué sugiere el autor?', groupId: 'g2' },
    ])
    expect(index.size).toBe(0)
  })

  test('a duplicate is flagged with the row it repeats', () => {
    expect(checkDuplicateStem('a').result).toBe('warn')
    expect(checkDuplicateStem('a').detail).toContain('a')
    expect(checkDuplicateStem(undefined).result).toBe('pass')
  })

  test('taxonomy ids must exist and belong together', () => {
    expect(checkTaxonomy(question()).result).toBe('pass')
    expect(checkTaxonomy(question({ primarySubtopicId: 'no.existe' })).result).toBe('fail')
    expect(checkTaxonomy(question({ subjectId: 'ingles' })).result).toBe('fail')
  })
})

describe('runDeterministicChecks', () => {
  test('runs every check once and a clean item has no failure', () => {
    const checks = runDeterministicChecks({ question: question(), group: null, unresolvedUrls: [], crop: null })
    expect(checks.map((check) => check.id).sort()).toEqual([
      'crop_sanity', 'duplicate_stem', 'group_range', 'katex', 'key_present', 'missing_figure',
      'option_count', 'options_filled', 'options_unique', 'page_furniture', 'printed_key', 'taxonomy_valid', 'urls_resolve',
    ])
    expect(checks.every((check) => check.result === 'pass')).toBe(true)
  })

  test('collects the images of the stem, the options and the group', () => {
    const checks = runDeterministicChecks({
      question: question({ options: [option('A', '![](rel.png)'), ...ABCD.slice(1)] }),
      group: null,
      unresolvedUrls: [],
      crop: null,
    })
    expect(checks.find((check) => check.id === 'urls_resolve')?.result).toBe('fail')
  })
})

describe('matchOcrPage', () => {
  const pages = [
    { pageNumber: 1, markdown: 'Portada del cuadernillo de preguntas.' },
    { pageNumber: 2, markdown: 'El agua se evapora cuando la temperatura aumenta en el recipiente abierto.' },
  ]

  test('finds the page by approximate text, tolerating OCR noise', () => {
    expect(matchOcrPage('El agua se evapora cuando la temperatura aumenta en el recipiente.', pages)).toBe(2)
  })

  test('returns null when nothing is close', () => {
    expect(matchOcrPage('Texto que no aparece en ninguna página del documento escaneado.', pages)).toBeNull()
  })
})

describe('similarityGate', () => {
  const corpus = [{ id: 'icfes-1', text: 'En un páramo de Boyacá se estudia una cadena alimentaria simplificada que incluye frailejones y venados' }]

  test('a paraphrase that keeps long runs of the source is stopped', () => {
    const verdict = similarityGate('En un páramo de Boyacá se estudia una cadena alimentaria simplificada con conejos', corpus)
    expect(verdict.ok).toBe(false)
    expect(verdict.matchId).toBe('icfes-1')
  })

  test('new text passes', () => {
    expect(similarityGate('Una tienda de Pereira vende tenis con descuento durante la semana del estudiante', corpus).ok).toBe(true)
  })

  test('a text too short to shingle is compared whole', () => {
    expect(similarityGate('Hola mundo', [{ id: 'x', text: 'Hola mundo' }]).ok).toBe(false)
  })

  test('an empty corpus always passes', () => {
    expect(similarityGate('cualquier texto', []).ok).toBe(true)
  })
})

describe('validateGuide', () => {
  const step = (prompt: string) => ({
    prompt,
    choices: [{ text: 'Sí', correct: true }, { text: 'No' }],
  })
  const diagnose = (label: string) => ({
    prompt: `¿Qué te hizo elegir la ${label}?`,
    choices: [{ text: 'Sumé mal' }, { text: 'La adiviné' }],
  })
  const item = { options: ABCD, answerCorrectOption: 'C' }
  const guide = (overrides: object = {}) => ({
    hint: '¿Qué operación pide el enunciado?',
    byOption: {
      A: { diagnose: diagnose('A'), steps: [step('¿Sumaste los dos números?')] },
      B: { diagnose: diagnose('B'), steps: [step('¿Sumaste los dos números?')] },
      D: { diagnose: diagnose('D'), steps: [step('¿Sumaste los dos números?')] },
    },
    reveal: 'Dos más uno son tres. Es una suma directa.',
    ...overrides,
  })

  test('a good guide has no problems', () => {
    expect(validateGuide(item, guide())).toEqual([])
  })

  test('every wrong option needs a path', () => {
    const { A: _A, ...rest } = guide().byOption
    expect(validateGuide(item, guide({ byOption: rest })).join()).toContain('A')
  })

  test('the key has no wrong-answer path', () => {
    const byOption = { ...guide().byOption, C: { diagnose: diagnose('C'), steps: [step('¿Seguro?')] } }
    expect(validateGuide(item, guide({ byOption })).length).toBeGreaterThan(0)
  })

  test('the hint may not name the key', () => {
    expect(validateGuide(item, guide({ hint: '¿Ya miraste la opción C?' })).length).toBeGreaterThan(0)
    expect(validateGuide(item, guide({ hint: 'Piensa si la respuesta es tres.' })).length).toBeGreaterThan(0)
  })

  test('a step may not hand over the key text', () => {
    const byOption = { ...guide().byOption, A: { diagnose: diagnose('A'), steps: [{ prompt: '¿Cuál es el total?', choices: [{ text: 'Tres', correct: true }, { text: 'Dos' }] }] } }
    expect(validateGuide(item, guide({ byOption })).length).toBeGreaterThan(0)
  })

  test('a capital letter that is not an option reference is fine', () => {
    expect(validateGuide(item, guide({ hint: '¿La vitamina C es soluble en agua?' }))).toEqual([])
  })

  test('a step over twenty words is refused', () => {
    const long = `¿${Array(21).fill('palabra').join(' ')}?`
    const byOption = { ...guide().byOption, A: { diagnose: diagnose('A'), steps: [step(long)] } }
    expect(validateGuide(item, guide({ byOption })).join()).toContain('20')
  })

  test('at most three steps', () => {
    const byOption = { ...guide().byOption, A: { diagnose: diagnose('A'), steps: [step('¿a?'), step('¿b?'), step('¿c?'), step('¿d?')] } }
    expect(validateGuide(item, guide({ byOption })).length).toBeGreaterThan(0)
  })

  test('one question per step', () => {
    const byOption = { ...guide().byOption, A: { diagnose: diagnose('A'), steps: [step('¿Sumaste? ¿Restaste?')] } }
    expect(validateGuide(item, guide({ byOption })).length).toBeGreaterThan(0)
  })

  test('a step needs exactly one correct choice', () => {
    const byOption = { ...guide().byOption, A: { diagnose: diagnose('A'), steps: [{ prompt: '¿Sumaste?', choices: [{ text: 'Sí' }, { text: 'No' }] }] } }
    expect(validateGuide(item, guide({ byOption })).length).toBeGreaterThan(0)
  })

  test('the diagnose step has no right answer', () => {
    const byOption = { ...guide().byOption, A: { diagnose: { prompt: '¿Por qué?', choices: [{ text: 'x', correct: true }, { text: 'y' }] }, steps: [step('¿a?')] } }
    expect(validateGuide(item, guide({ byOption })).length).toBeGreaterThan(0)
  })

  test('a very short key text is not treated as a leak', () => {
    const shortKey = { options: [option('A', '5'), option('B', '6'), option('C', '7')], answerCorrectOption: 'A' }
    const byOption = {
      B: { diagnose: diagnose('B'), steps: [step('¿Son 5 lados?')] },
      C: { diagnose: diagnose('C'), steps: [step('¿Son 5 lados?')] },
    }
    expect(validateGuide(shortKey, guide({ byOption }))).toEqual([])
  })
})
