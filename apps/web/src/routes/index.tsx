import { Link, createFileRoute } from '@tanstack/react-router'
import { SESSION_KIND_CONFIG, getConfiguredQuestionCount } from '@aprendo/convex/sessionKinds'
import { DAILY_GOAL_OPTIONS } from '@aprendo/convex/studyPlan'
import { ArrowRight, BookOpen, Check, House, Trophy, UserRound, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Wordmark } from '../components/BrandMark.tsx'
import { PublicFooter } from '../components/PublicPage.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'
import { CONTACT_EMAIL } from '../lib/contact.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { SITE_URL, publicHead } from '../lib/site.ts'

export const Route = createFileRoute('/')({
  head: () => {
    const head = publicHead({
      title: 'Aprendo: tu plan diario para el Saber 11',
      description:
        'Prepárate para el Saber 11 con un diagnóstico de 40 minutos, un plan para cada día y un tutor que te guía con preguntas. Gratis durante el piloto.',
      path: '/',
    })
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
          description: 'Preparación para el examen Saber 11 para estudiantes y colegios de Colombia. No está afiliada al ICFES.',
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
const GOAL_OPTIONS = `${DAILY_GOAL_OPTIONS.slice(0, -1).join(', ')} o ${DAILY_GOAL_OPTIONS.at(-1)}`

/**
 * The landing, written first for a student of grado 11 (the pilot is B2C and
 * free) and then, briefly, for teachers and schools. It wears the student app's
 * palette A, and every product picture is the app itself in HTML with made-up
 * data, captioned as an example.
 */
function LandingPage() {
  const { session, isReady } = useCurrentStudent()
  const isSignedIn = isReady && session != null

  return (
    <div className="landing">
      <header className="lp-bar">
        <Wordmark subtitle="Saber 11" />
        <div className="lp-bar-actions">
          <ThemeToggle />
          <Link to={isSignedIn ? '/app' : '/login'} className="lp-btn is-quiet no-underline">
            {isSignedIn ? 'Ir a mi cuenta' : 'Entrar'}
          </Link>
        </div>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-hero-text">
            <h1 id="hero-title" className="lp-title">
              Tu plan diario para el Saber 11
            </h1>
            <p className="lp-lede">
              Haces un diagnóstico de {DIAGNOSTIC_MINUTES} minutos y Aprendo te dice qué estudiar cada día,
              empezando por donde más puntos puedes ganar. Es gratis mientras dure el piloto.
            </p>
            <div className="lp-cta">
              <StartCta isSignedIn={isSignedIn} label="Empezar gratis" />
              {isSignedIn ? null : (
                <Link to="/login" className="lp-btn is-secondary no-underline">
                  Ya tengo cuenta
                </Link>
              )}
            </div>
          </div>
          <TodayFragment />
        </section>

        <section className="lp-section" aria-labelledby="start-title">
          <h2 id="start-title" className="lp-h2">Así empiezas</h2>
          <ol className="lp-steps">
            <li>
              <span className="lp-figure">{DIAGNOSTIC_MINUTES} min</span>
              <h3>Un diagnóstico, sin ayuda</h3>
              <p>
                {DIAGNOSTIC_QUESTIONS} preguntas de las cinco áreas, con reloj y sin tutor, como en el examen. Así
                sabemos desde dónde arrancas.
              </p>
            </li>
            <li>
              <span className="lp-figure">5 áreas</span>
              <h3>Un nivel en cada una</h3>
              <p>
                Cada área queda en un nivel de desempeño como los que reporta el ICFES. Es preliminar: la
                práctica lo va ajustando.
              </p>
            </li>
            <li>
              <span className="lp-figure">1 paso</span>
              <h3>Lo que toca hoy</h3>
              <p>
                Escoges cuántas preguntas al día ({GOAL_OPTIONS}). Cada día ves qué sigue y por qué, sin tener
                que decidirlo tú.
              </p>
            </li>
          </ol>
        </section>

        <section className="lp-section lp-guide" aria-labelledby="guide-title">
          <GuidedFragment />
          <div>
            <h2 id="guide-title" className="lp-h2">Si te equivocas, te pregunta</h2>
            <p className="lp-copy">
              Aprendo no te muestra la respuesta de una. Te pregunta qué te llevó a esa opción y te guía con
              otra pregunta hasta que llegues tú. La respuesta llega después de intentarlo, no antes.
            </p>
            <p className="lp-copy">
              Al responder también dices si estabas seguro o si adivinaste. Un acierto de suerte no cuenta como
              algo que ya sabes.
            </p>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="measures-title">
          <h2 id="measures-title" className="lp-h2">Qué mide y qué cuenta</h2>
          <p className="lp-copy">
            Tu esfuerzo y lo que sabes van por separado. Los puntos y la racha premian que practiques; el nivel
            de cada tema solo sube cuando respondes bien.
          </p>
          <dl className="lp-terms">
            <div>
              <dt>Racha y meta diaria</dt>
              <dd>
                Cada día que practicas suma a tu racha, y un escudo la cuida si un día se te pasa. Si quieres,
                te escribimos al correo para recordártela.
              </dd>
            </div>
            <div>
              <dt>Nivel por tema</dt>
              <dd>Cada tema va de Sin empezar a Dominado según lo que respondes. Los puntos no lo mueven.</dd>
            </div>
            <div>
              <dt>Puntaje global estimado</dt>
              <dd>
                De 0 a 500 y con su rango probable, solo cuando las cinco áreas tienen evidencia. Es una
                estimación, no un resultado oficial.
              </dd>
            </div>
            <div>
              <dt>Simulacros con reloj</dt>
              <dd>Las dos sesiones de la prueba, cronometradas, para que el día del examen nada te tome por sorpresa.</dd>
            </div>
          </dl>
        </section>

        <section className="lp-band" aria-labelledby="teacher-title">
          <div className="lp-band-inner">
            <div>
              <h2 id="teacher-title" className="lp-h2">Para docentes y colegios</h2>
              <p className="lp-copy">
                El docente crea su curso y los estudiantes entran con un código. Cada semana ve qué enseñar a
                todo el curso, qué grupos pequeños armar y con quién hablar uno a uno.
              </p>
              <dl className="lp-band-terms">
                <div>
                  <dt>Plan de la semana</dt>
                  <dd>Asigna práctica al curso o a un grupo y ve quién la hizo.</dd>
                </div>
                <div>
                  <dt>Prueba periódica</dt>
                  <dd>El colegio programa sus rondas y ve resultados por curso y por área.</dd>
                </div>
              </dl>
              <p className="lp-copy">
                El docente no responde ni califica por un estudiante, así el nivel que ve es del estudiante.
              </p>
              <div className="lp-cta">
                <ContactCta />
              </div>
            </div>
            <TeacherFragment />
          </div>
        </section>

        <section className="lp-section lp-split" aria-labelledby="source-title">
          <div>
            <h2 id="source-title" className="lp-h2">De dónde salen las preguntas</h2>
            <p className="lp-copy">
              Practicas con cuadernillos que el ICFES publicó, sin cambiarlos y con su fuente, y con el banco
              original de Aprendo: preguntas escritas por Aprendo con ayuda de inteligencia artificial. Ninguna
              entra a una sesión sin clave, área y tema, y puedes reportar la que veas mal.
            </p>
            <p className="lp-copy">
              Un colegio con licencia trabaja solo con el banco original. Las preguntas del ICFES no hacen parte
              de lo que un colegio paga.
            </p>
          </div>
          <div>
            <h2 className="lp-h2">Tus datos</h2>
            <p className="lp-copy">
              Tu cuenta es tuya: puedes descargar tus datos o borrarla cuando quieras. Si eres menor de edad, te
              pedimos confirmar que tu acudiente sabe que usas Aprendo. En la liga de un curso solo aparecen tu
              apodo y tu avatar, nunca tu nombre.
            </p>
            <p className="lp-copy">
              No vendemos datos ni los usamos para publicidad. Detalles en la{' '}
              <Link to="/privacidad">política de tratamiento de datos</Link>.
            </p>
          </div>
        </section>

        <section className="lp-close" aria-labelledby="close-title">
          <h2 id="close-title" className="lp-h2">Empieza por el diagnóstico</h2>
          <p className="lp-copy">Son {DIAGNOSTIC_MINUTES} minutos. Al terminar ya tienes tu plan de hoy.</p>
          <div className="lp-cta">
            <StartCta isSignedIn={isSignedIn} label="Crear mi cuenta" />
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}

/** The student's way in: sign-up, or back to the app when already signed in. */
function StartCta({ isSignedIn, label }: { isSignedIn: boolean; label: string }) {
  if (isSignedIn) {
    return (
      <Link to="/app" className="lp-btn is-primary no-underline">
        Seguir donde iba
        <ArrowRight size={18} aria-hidden />
      </Link>
    )
  }
  return (
    <Link to="/login" search={{ modo: 'registro' }} className="lp-btn is-primary no-underline">
      {label}
      <ArrowRight size={18} aria-hidden />
    </Link>
  )
}

/** A school can always act: with no inbox configured, the CTA opens a trial account. */
function ContactCta() {
  if (CONTACT_EMAIL == null) {
    return (
      <Link to="/login" search={{ modo: 'registro' }} className="lp-btn is-inverse no-underline">
        Crear una cuenta de prueba
      </Link>
    )
  }
  return (
    <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Aprendo para mi colegio')}`} className="lp-btn is-inverse no-underline">
      Hablar con nosotros
    </a>
  )
}

// The student app's own area colours, whatever the page's theme.
const AREAS = [
  { label: 'Lectura crítica', color: '#6d3fc0', level: 'Nivel 3', share: 70 },
  { label: 'Matemáticas', color: '#097d52', level: 'Nivel 1', share: 25 },
  { label: 'Ciencias naturales', color: '#0a6fb0', level: 'Nivel 2', share: 45 },
  { label: 'Sociales', color: '#b4540a', level: 'Nivel 2', share: 35 },
  { label: 'Inglés', color: '#b3257a', level: 'A1', share: 40 },
]

const WEEK = [
  { day: 'L', state: 'done' },
  { day: 'M', state: 'done' },
  { day: 'M', state: 'done' },
  { day: 'J', state: 'today' },
  { day: 'V', state: '' },
  { day: 'S', state: '' },
  { day: 'D', state: '' },
]

/** The student's Hoy on a computer: the rail, the goal and next step, the week and the areas. */
function TodayFragment() {
  return (
    <figure className="lp-figure-wrap lp-hero-figure">
      <div
        data-ui
        role="img"
        aria-label="Ejemplo de la pantalla Hoy: meta de 6 de 10 preguntas, el siguiente paso Practica Probabilidad y conteo con un botón para empezar, la semana con tres días hechos y el nivel de cada área."
        className="lp-app"
      >
        <div className="lp-app-rail" aria-hidden>
          <span className="lp-app-brand">Aprendo</span>
          <span className="is-active"><House />Hoy</span>
          <span><BookOpen />Aprende</span>
          <span><Trophy />Retos</span>
          <span><UserRound />Yo</span>
        </div>
        <div className="lp-app-main">
          <p className="lp-app-hello">Hola, Valentina</p>
          <p className="lp-app-facts">Racha de 3 días · 1 escudo</p>
          <div className="lp-app-goal">
            <span>
              <b>Meta de hoy</b>6 de 10 preguntas
            </span>
            <i>
              <i />
            </i>
          </div>
          <div className="lp-app-next">
            <small>Tu siguiente paso</small>
            <b>Practica Probabilidad y conteo</b>
            <span>Es el tema de Matemáticas donde más puntos del global puedes ganar.</span>
            <span className="lp-app-meta">
              <i style={{ '--area': '#097d52' } as CSSProperties} />
              Matemáticas · 10 min
            </span>
            <em>Empezar</em>
          </div>
        </div>
        <div className="lp-app-side">
          <p className="lp-app-h">Tu semana</p>
          <div className="lp-app-week">
            {WEEK.map((item, index) => (
              <span key={index} className={item.state}>
                <i>{item.state === 'done' ? <Check /> : null}</i>
                {item.day}
              </span>
            ))}
          </div>
          <p className="lp-app-h">Tus áreas</p>
          <div className="lp-app-areas">
            {AREAS.map((area) => (
              <div key={area.label} style={{ '--area': area.color } as CSSProperties}>
                <span>
                  <i />
                  {area.label}
                  <small>{area.level}</small>
                </span>
                <b>
                  <b style={{ width: `${area.share}%` }} />
                </b>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption>Ejemplo de la pantalla Hoy, con datos ficticios.</figcaption>
    </figure>
  )
}

/** A wrong answer opens a question: "Todavía no", then why it was chosen. */
function GuidedFragment() {
  return (
    <figure className="lp-figure-wrap">
      <div
        data-ui
        role="img"
        aria-label="Ejemplo de una pregunta respondida mal: la aplicación dice «Todavía no» y pregunta qué hizo elegir esa opción."
        className="lp-guide-ui"
      >
        <div className="lp-guide-bar">
          <X aria-hidden />
          <span className="lp-guide-beads">
            <i className="done" />
            <i className="done" />
            <i className="current" />
            <i />
            <i />
          </span>
          <span>3/5</span>
        </div>
        <div className="lp-guide-sheet">
          <p className="lp-guide-q">
            Una receta usa 3 tazas de harina por cada 2 de azúcar. Con 12 tazas de harina, ¿cuántas de azúcar
            necesitas?
          </p>
          <div className="lp-guide-opts">
            <span><em>A</em>6</span>
            <span><em>B</em>8</span>
            <span className="is-wrong"><em>C</em>11<X aria-hidden /></span>
            <span><em>D</em>18</span>
          </div>
        </div>
        <div className="lp-guide-ask">
          <p>Todavía no</p>
          <b>¿Qué te hizo elegir la C?</b>
          <span>Le sumé 9 a las dos cantidades</span>
          <span>Hice otra cuenta y me dio 11</span>
          <span>La adiviné</span>
        </div>
      </div>
      <figcaption>Ejemplo de la práctica guiada, con una pregunta de muestra.</figcaption>
    </figure>
  )
}

/** The teacher's week, cut down to the topic for the whole class. */
function TeacherFragment() {
  return (
    <figure className="lp-figure-wrap">
      <div
        data-ui
        role="img"
        aria-label="Ejemplo del panel docente: el tema para enseñar esta semana a todo el curso, con cuántos estudiantes están por debajo de Familiar."
        className="lp-teacher-ui"
      >
        <p className="lp-teacher-head">
          <b>11A</b>
          <span>32 estudiantes</span>
        </p>
        <p className="lp-app-h">Esta semana con todo el curso</p>
        <div className="lp-teacher-row">
          <span className="lp-app-meta">
            <i style={{ '--area': '#097d52' } as CSSProperties} />
            Matemáticas
          </span>
          <b>Razones, proporciones y porcentajes</b>
          <span>18 de 29 están por debajo de Familiar. Clase corta y una votación en parejas.</span>
        </div>
        <p className="lp-app-h">En grupo pequeño</p>
        <div className="lp-teacher-row">
          <span className="lp-app-meta">
            <i style={{ '--area': '#6d3fc0' } as CSSProperties} />
            Lectura crítica
          </span>
          <b>Hechos y detalles explícitos</b>
          <span>6 estudiantes</span>
        </div>
      </div>
      <figcaption>Ejemplo del panel docente, con un curso ficticio.</figcaption>
    </figure>
  )
}
