import { Link, createFileRoute } from '@tanstack/react-router'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import { ArrowRight, BookOpen, House, Trophy, UserRound, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Wordmark } from '../components/BrandMark.tsx'
import { PublicFooter } from '../components/PublicPage.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'
import { CONTACT_EMAIL } from '../lib/contact.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { SITE_URL, publicHead } from '../lib/site.ts'
import { getSubjectTheme } from '../lib/subject-theme.ts'
import { belowShareLabel } from '../lib/teacher-display.ts'

export const Route = createFileRoute('/')({
  head: () => {
    const head = publicHead({"title":"Aprendo: preparación Saber 11 para colegios de Colombia","description":"Aprendo mide a cada estudiante de grado 11 en las cinco áreas del Saber 11 y le entrega a su docente el plan concreto de la semana. Para colegios de Colombia.","path":"/"})
    if (SITE_URL == null) return head
    // Organization, not EducationalOrganization: Aprendo makes software, it is not a school.
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${SITE_URL}/#org`,
          name: 'Aprendo',
          url: `${SITE_URL}/`,
          logo: `${SITE_URL}/icon-512.png`,
          description: 'Plataforma de preparación para el examen Saber 11 para colegios de Colombia. No está afiliada al ICFES.',
          areaServed: { '@type': 'Country', name: 'Colombia' },
          ...(CONTACT_EMAIL != null ? { email: CONTACT_EMAIL } : {}),
        },
        { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, url: `${SITE_URL}/`, name: 'Aprendo', inLanguage: 'es-CO', publisher: { '@id': `${SITE_URL}/#org` } },
      ],
    }
    return { ...head, scripts: [{ type: 'application/ld+json', children: JSON.stringify(jsonLd) }] }
  },
  component: LandingPage,
})

const DIAGNOSTIC_QUESTIONS = getConfiguredQuestionCount(SESSION_KIND_CONFIG.diagnostic)
const DIAGNOSTIC_MINUTES = (SESSION_KIND_CONFIG.diagnostic.timeLimitMs ?? 0) / 60_000

/**
 * The landing, written for the person who decides whether a school buys: what
 * Aprendo measures, what a teacher gets, how a student studies, where the
 * questions come from, how minors' data is handled, and how to get in touch.
 * Everything shown of the product is an interface fragment with made-up data,
 * labelled as an example: no school, number or result here is a real one.
 */
function LandingPage() {
  const { session, isReady } = useCurrentStudent()
  const isSignedIn = isReady && session != null

  return (
    <div className="landing">
      {/* The red cover: bar, promise and the two ways in. The class sheet lies across its edge. */}
      <div className="landing-cover">
        <header className="landing-bar">
          <Wordmark subtitle="Saber 11" />
          <div className="landing-bar-actions">
            <ThemeToggle />
            <Link to={isSignedIn ? '/app' : '/login'} className="btn-ghost no-underline">
              {isSignedIn ? 'Ir a mi cuenta' : 'Entrar'}
            </Link>
          </div>
        </header>
        <section className="landing-hero fade-in">
          <h1 className="landing-title">Saber 11: sepa qué enseñar cada semana</h1>
          <div className="landing-hero-lead">
            <p className="landing-lede">
              Aprendo mide a cada estudiante de grado 11 en las cinco áreas del examen y le entrega a su
              docente un plan concreto para la semana. Una plataforma para colegios de Colombia.
            </p>
            <div className="landing-cta">
              <ContactCta label="Hablar con nosotros" />
              <Link to={isSignedIn ? '/app' : '/login'} className="btn-secondary no-underline">
                {isSignedIn ? 'Continuar donde iba' : 'Soy estudiante: entrar'}
              </Link>
            </div>
          </div>
        </section>
      </div>

      <main>
        <div className="landing-sheet">
          <ClassReportFragment />
        </div>

        <section className="landing-section" aria-labelledby="start-title">
          <h2 id="start-title" className="landing-h2">Así empieza cada estudiante</h2>
          <p className="landing-copy">
            Un solo diagnóstico, el primer día, y desde ahí un plan que se ajusta con cada respuesta.
          </p>
          <ol className="landing-steps">
            <li>
              <span className="landing-step-figure">{DIAGNOSTIC_QUESTIONS}</span>
              <h3>Diagnóstico general</h3>
              <p>
                {DIAGNOSTIC_QUESTIONS} preguntas de las cinco áreas, sin tutor y con {DIAGNOSTIC_MINUTES} minutos de
                reloj, como en el examen.
              </p>
            </li>
            <li>
              <span className="landing-step-figure">5</span>
              <h3>Un nivel por área</h3>
              <p>
                Cada área queda en los niveles de desempeño que reporta el ICFES, marcada como preliminar hasta que
                la práctica la confirme.
              </p>
            </li>
            <li>
              <span className="landing-step-figure">1</span>
              <h3>Un paso para hoy</h3>
              <p>
                Cada día abre con la siguiente lección o práctica y su porqué, empezando donde el estudiante más
                puede subir.
              </p>
            </li>
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="measures-title">
          <h2 id="measures-title" className="landing-h2">Qué mide, y con cuánta evidencia</h2>
          <p className="landing-copy">
            Son estimaciones hechas con las respuestas en Aprendo, no resultados oficiales. Cuando no hay
            evidencia suficiente, no aparece un número.
          </p>
          <dl className="landing-terms">
            <div>
              <dt>Puntaje global estimado</dt>
              <dd>
                De 0 a 500, siempre con su rango probable, y solo cuando las cinco áreas tienen evidencia.
                Mientras falte un área, se dice cuál falta.
              </dd>
            </div>
            <div>
              <dt>Simulacros con reloj</dt>
              <dd>
                Las dos sesiones de la prueba real, cronometradas. Con ambas, el puntaje global de 0 a 500 de
                ese simulacro.
              </dd>
            </div>
            <div>
              <dt>Saber o adivinar</dt>
              <dd>
                Después de cada respuesta el estudiante dice si estaba seguro. Un acierto con suerte no
                cuenta como dominio, y un error con seguridad se marca como concepto por corregir.
              </dd>
            </div>
          </dl>
        </section>

        <section className="landing-band" aria-labelledby="student-title">
          <div className="landing-band-inner">
            <div>
              <h2 id="student-title" className="landing-h2">Se estudia respondiendo, no leyendo respuestas</h2>
              <p className="landing-copy">
                Cuando un estudiante se equivoca, Aprendo no le muestra la respuesta: le pregunta qué lo llevó
                a esa opción y lo guía con otra pregunta hasta que la encuentre. La respuesta llega después del
                intento, no antes.
              </p>
              <p className="landing-copy">
                Cada día abre con un siguiente paso y el porqué, y cada tema muestra su nivel, de Sin empezar
                a Dominado. Los puntos y la racha cuentan esfuerzo y nunca cambian ese nivel.
              </p>
            </div>
            <figure className="ui-figure">
              <div className="ui-phones">
                <TodayFragment />
                <GuidedFragment />
              </div>
              <figcaption>Ejemplo de la aplicación del estudiante en un teléfono, con datos ficticios.</figcaption>
            </figure>
          </div>
        </section>

        <section className="landing-section landing-teacher" aria-labelledby="teacher-title">
          <div>
            <h2 id="teacher-title" className="landing-h2">Lo que recibe el docente</h2>
            <dl className="landing-terms">
              <div>
                <dt>Plan de la semana</dt>
                <dd>
                  Qué enseñar a todo el curso, qué grupos pequeños armar, con quién hablar uno a uno y qué
                  preguntas falla más el curso. Asigna práctica al curso o a un grupo con un clic y ve quién la
                  hizo.
                </dd>
              </div>
              <div>
                <dt>Prueba periódica del colegio</dt>
                <dd>
                  El colegio programa sus rondas: la misma forma para cada grado, sellada hasta que cierra, con
                  resultados por curso y por área.
                </dd>
              </div>
              <div>
                <dt>Plan de mejora</dt>
                <dd>
                  Con los resultados de una ronda, el docente genera un plan con una acción por cada tema débil.
                  En el ciclo siguiente ve cuántos siguen por debajo de Familiar, y la próxima ronda muestra el
                  después.
                </dd>
              </div>
            </dl>
            <h3 className="landing-h3">Y lo que no puede hacer</h3>
            <p className="landing-copy">
              Responder por un estudiante, calificarlo o ver sus respuestas en vivo. El docente asigna práctica;
              solo el estudiante practica y presenta sus simulacros. Así el nivel que aparece en el panel es del
              estudiante.
            </p>
          </div>
          <CycleFragment />
        </section>

        <section className="landing-section landing-split" aria-labelledby="source-title">
          <div>
            <h2 id="source-title" className="landing-h2">De dónde salen las preguntas</h2>
            <p className="landing-copy">
              Un colegio con licencia trabaja solo con el banco original de Aprendo: preguntas escritas por
              Aprendo con inteligencia artificial, y cada una dice de dónde viene. Ninguna entra a una sesión
              sin clave, área y tema, y los estudiantes pueden reportar la que esté mal. Aún no llevan la
              firma de un docente de área.
            </p>
            <p className="landing-copy">
              Quienes no están en un colegio con licencia también pueden practicar con cuadernillos que el ICFES
              publicó, sin modificarlos y con su fuente. Esas preguntas no hacen parte de lo que un colegio paga.
            </p>
          </div>
          <div>
            <h2 className="landing-h2">Datos de menores de edad</h2>
            <p className="landing-copy">
              Cada estudiante es dueño de su cuenta. El colegio ve su nivel y su actividad mientras esté en un
              curso. La liga está apagada hasta que el colegio la activa, y en ella solo aparecen apodo y avatar,
              nunca el nombre, y nunca frente al docente.
            </p>
            <p className="landing-copy">
              El estudiante puede descargar sus datos o eliminar su cuenta cuando quiera. No vendemos datos ni
              los usamos para publicidad. Detalles en la{' '}
              <Link to="/privacidad">política de tratamiento de datos</Link>.
            </p>
          </div>
        </section>

        <section className="landing-contact" aria-labelledby="contact-title">
          <div className="landing-contact-inner">
            <h2 id="contact-title" className="landing-h2">Llevar Aprendo a su colegio</h2>
            <p className="landing-copy">
              {CONTACT_EMAIL != null
                ? 'Escríbanos con el nombre del colegio y cuántos estudiantes de grado 11 tienen. Le respondemos con una propuesta para su colegio.'
                : 'Cree una cuenta y presente el diagnóstico como lo haría un estudiante.'}
            </p>
            <div className="landing-cta">
              <ContactCta label={CONTACT_EMAIL ?? ''} />
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

/** A rector can always act: with no inbox configured, the CTA opens a trial account. */
function ContactCta({ label }: { label: string }) {
  if (CONTACT_EMAIL == null) {
    return (
      <Link to="/login" search={{ modo: 'registro' }} className="btn-primary no-underline">
        Crear una cuenta de prueba
        <ArrowRight size={18} aria-hidden />
      </Link>
    )
  }
  return (
    <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Aprendo para mi colegio')}`} className="btn-primary no-underline">
      {label}
      <ArrowRight size={18} aria-hidden />
    </a>
  )
}

const LEVEL_NAMES = ['Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4']

const EXAMPLE_CLASS = [
  { subjectId: 'lectura_critica', levels: [3, 11, 13, 3], none: 2, average: 61 },
  { subjectId: 'matematicas', levels: [9, 12, 7, 1], none: 3, average: 52 },
  { subjectId: 'ciencias_naturales', levels: [5, 14, 9, 1], none: 3, average: 57 },
  { subjectId: 'sociales_ciudadanas', levels: [4, 13, 10, 2], none: 3, average: 59 },
  { subjectId: 'ingles', levels: [6, 12, 9, 2], none: 3, average: 55 },
]

/** The class report of the teacher panel (`teacher.$classGroupId.tsx`), same classes, example data. */
function ClassReportFragment() {
  return (
    <figure className="ui-figure">
      <div
        data-ui
        role="img"
        aria-label="Ejemplo del informe de un curso: los estudiantes por nivel en cada área y el tema que se debe enseñar esta semana."
        className="ruled-page ui-report"
      >
        <div className="ruled-page-margin">
          <p className="ruled-page-date">Colegio de ejemplo</p>
          <dl className="margin-facts">
            <div>
              <dt>Estudiantes</dt>
              <dd>32</dd>
            </div>
            <div>
              <dt>Necesitan atención</dt>
              <dd>7</dd>
            </div>
          </dl>
        </div>
        <div className="ruled-page-body">
          <div className="ruled-page-head">
            <p className="page-title">11A</p>
            <p className="page-lede">Grado 11</p>
          </div>
          <div className="ruled-section">
            <p className="section-title">El curso por área</p>
            <ul className="area-chart-rows">
              {EXAMPLE_CLASS.map((row) => {
                const theme = getSubjectTheme(row.subjectId)
                return (
                  <li key={row.subjectId} className="area-chart-row" style={{ '--subject-color': theme.color } as CSSProperties}>
                    <span className="area-chart-label">
                      <span className="subject-dot" />
                      {theme.label}
                    </span>
                    <span className="level-stack">
                      {row.levels.map((count, index) => (
                        <span key={LEVEL_NAMES[index]} className={`level-stack-segment level-${index + 1}`} style={{ flexGrow: count }}>
                          {count}
                        </span>
                      ))}
                      <span className="level-stack-segment level-none" style={{ flexGrow: row.none }}>
                        {row.none}
                      </span>
                    </span>
                    <span className="area-chart-level">
                      <strong>{row.average}</strong>
                      <span className="area-chart-score">promedio</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="area-chart-legend">
              {LEVEL_NAMES.map((name, index) => (
                <span key={name} className="inline-flex items-center gap-1.5">
                  <span className={`level-swatch level-${index + 1}`} />
                  {name}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <span className="level-swatch level-none" />
                sin nivel aún
              </span>
            </p>
          </div>
          <div className="ruled-section">
            <p className="section-title">Esta semana con todo el curso</p>
            <div className="ruled-row">
              <span className="ruled-row-main">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="subject-dot" style={{ '--subject-color': getSubjectTheme('matematicas').color } as CSSProperties} />
                  Razones, proporciones y porcentajes
                </span>
                <span className="ruled-row-note">
                  18 de 29 (62%) están por debajo de Familiar. Clase corta de 15–20 min y una votación en parejas.
                </span>
                <span className="mt-2 flex flex-wrap gap-2">
                  <span className="btn-secondary btn-sm">Asignar práctica al curso</span>
                  <span className="btn-ghost btn-sm">Guía de clase</span>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <figcaption>Ejemplo del panel docente, con un curso ficticio. Sin evidencia suficiente, un estudiante queda «sin nivel aún».</figcaption>
    </figure>
  )
}

const EXAMPLE_CYCLE = [
  { topic: 'Razones, proporciones y porcentajes', tier: 'Todo el curso', before: { belowCount: 18, evidencedCount: 29 }, after: { belowCount: 9, evidencedCount: 29 } },
  { topic: 'Hechos y detalles explícitos', tier: 'Grupo', before: { belowCount: 6, evidencedCount: 8 }, after: { belowCount: 3, evidencedCount: 8 } },
  { topic: 'Ecuaciones e inecuaciones', tier: 'Grupo', before: { belowCount: 5, evidencedCount: 7 }, after: { belowCount: 5, evidencedCount: 7 } },
]

/** The before-and-after table of the teaching cycle (`ClassCycle.tsx`), example data. */
function CycleFragment() {
  return (
    <figure className="ui-figure ui-cycle">
      <div data-ui className="page-sheet">
        <p className="section-title">Ciclo de enseñanza</p>
        <p className="text-sm text-[var(--text-secondary)]">Terminó el 24 oct. Así cambió el curso:</p>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tema</th>
                <th>Para</th>
                <th className="is-number">Al empezar</th>
                <th className="is-number">Hoy</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_CYCLE.map((row) => (
                <tr key={row.topic}>
                  <td>{row.topic}</td>
                  <td>{row.tier}</td>
                  <td className="is-number">{belowShareLabel(row.before)}</td>
                  <td className="is-number">{belowShareLabel(row.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <figcaption>Ejemplo con datos ficticios: cuántos estudiantes estaban por debajo de Familiar al empezar y hoy.</figcaption>
    </figure>
  )
}

// The student app's own area colours, whatever the page's theme.
const AREAS = [
  { label: 'Matemáticas', color: '#097d52', level: 'Nivel 2', done: 3, total: 8 },
  { label: 'Lectura crítica', color: '#6d3fc0', level: 'Nivel 3', done: 4, total: 6 },
]

/** The student's Hoy: the next step and why, then the areas in words. */
function TodayFragment() {
  return (
    <div
      data-ui
      role="img"
      aria-label="Ejemplo de la pantalla Hoy: el siguiente paso, Practica Geometría plana, con el porqué y un botón para empezar, y el avance de cada área."
      className="ui-phone"
    >
      <div className="ui-today">
        <p className="ui-today-title">Hola, Valentina</p>
        <p className="ui-today-status"><span>Racha de 6 días</span><span>40 XP hoy</span></p>
        <p className="ui-today-h">Tu siguiente paso</p>
        <div className="ui-today-next">
          <b>Practica Geometría plana</b>
          <span>Es donde más puntos del global puedes ganar.</span>
          <small>Matemáticas · 10 min</small>
          <em>Empezar</em>
        </div>
        <p className="ui-today-h">Tus áreas</p>
        <div className="ui-today-areas">
          {AREAS.map((area) => (
            <div key={area.label} style={{ '--area': area.color } as CSSProperties}>
              <span className="ui-today-area-top"><b>{area.label}</b>{area.level}</span>
              <i><i style={{ width: `${(area.done / area.total) * 100}%` }} /></i>
              <small>{area.done} de {area.total} temas en Competente o más</small>
            </div>
          ))}
        </div>
      </div>
      <div className="ui-album-tabs">
        <span className="is-active"><House aria-hidden />Hoy</span>
        <span><BookOpen aria-hidden />Aprende</span>
        <span><Trophy aria-hidden />Retos</span>
        <span><UserRound aria-hidden />Yo</span>
      </div>
    </div>
  )
}

/** A wrong answer opens a question: "Todavía no", then why it was chosen. */
function GuidedFragment() {
  return (
    <div
      data-ui
      role="img"
      aria-label="Ejemplo de una pregunta respondida mal: la aplicación dice «Todavía no» y pregunta qué hizo elegir esa opción."
      className="ui-phone"
    >
      <div className="ui-guide-bar">
        <X aria-hidden />
        <span className="ui-guide-beads">
          <i className="done" />
          <i className="done" />
          <i className="current" />
          <i />
          <i />
        </span>
        <span className="ui-guide-slot">3/5</span>
      </div>
      <div className="ui-guide-sheet">
        <p className="ui-guide-q">Una receta usa 3 tazas de harina por cada 2 de azúcar. Con 12 tazas de harina, ¿cuántas de azúcar necesitas?</p>
        <div className="ui-guide-opt"><em>A</em>6</div>
        <div className="ui-guide-opt"><em>B</em>8</div>
        <div className="ui-guide-opt is-wrong"><em>C</em>11<X aria-hidden /></div>
        <div className="ui-guide-opt"><em>D</em>18</div>
      </div>
      <div className="ui-guide-ask">
        <p>Todavía no</p>
        <div className="ui-guide-title">¿Qué te hizo elegir la C?</div>
        <span className="ui-guide-chip">Le sumé 9 a las dos cantidades</span>
        <span className="ui-guide-chip">Hice otra cuenta y me dio 11</span>
        <span className="ui-guide-chip">La adiviné</span>
      </div>
    </div>
  )
}
