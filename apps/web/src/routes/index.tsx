import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Wordmark } from '../components/BrandMark.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'
import { CONTACT_EMAIL } from '../lib/contact.ts'
import { useCurrentStudent } from '../lib/student-session.ts'
import { SITE_URL, publicHead } from '../lib/site.ts'

export const Route = createFileRoute('/')({
  head: () => {
    const head = publicHead({"title":"Aprendo: el nivel ICFES de cada estudiante, para colegios","description":"Aprendo es una plataforma de preparación para el Saber 11 del ICFES, para colegios de Colombia: ubica a cada estudiante de grado 11 en los niveles del examen, le arma un plan diario y le muestra al docente quién necesita apoyo y en qué competencia.","path":"/"})
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
          description: 'Plataforma de preparación para el examen Saber 11 para colegios de Colombia. No está afiliada al ICFES.',
          areaServed: { '@type': 'Country', name: 'Colombia' },
          ...(CONTACT_EMAIL != null ? { email: CONTACT_EMAIL } : {}),
        },
        { '@type': 'WebSite', url: `${SITE_URL}/`, name: 'Aprendo', inLanguage: 'es-CO', publisher: { '@id': `${SITE_URL}/#org` } },
      ],
    }
    return { ...head, scripts: [{ type: 'application/ld+json', children: JSON.stringify(jsonLd) }] }
  },
  component: LandingPage,
})

/** A made-up class, labelled as such: the page shows the instrument, not a claim. */
const SAMPLE_ROWS = [
  { name: 'Valentina R.', levels: ['Nivel 3', 'Nivel 2', 'Nivel 3', 'Nivel 2', 'A2'], note: null },
  { name: 'Santiago M.', levels: ['Nivel 2', 'Nivel 1', '—', 'Nivel 2', 'A1'], note: 'Nivel 1 en Matemáticas' },
  { name: 'Mariana G.', levels: ['Nivel 4', 'Nivel 3', 'Nivel 3', 'Nivel 3', 'B1'], note: null },
  { name: 'Juan D. P.', levels: ['—', '—', '—', '—', '—'], note: 'Sin nivelación' },
]
const AREAS = ['Lectura', 'Matemáticas', 'Ciencias', 'Sociales', 'Inglés']

/**
 * The landing, written for the person who decides whether a school buys:
 * what Aprendo measures, what a teacher sees, where the questions come from,
 * how minors' data is handled, and how to get in touch. No prices: there is no
 * price list to show.
 */
function LandingPage() {
  const { session, isReady } = useCurrentStudent()
  const isSignedIn = isReady && session != null
  const contactHref = CONTACT_EMAIL == null ? null : `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Aprendo para mi colegio')}`

  return (
    <div className="landing">
      <header className="landing-bar">
        <Wordmark subtitle="Saber 11" />
        <div className="landing-bar-actions">
          <ThemeToggle />
          <Link to={isSignedIn ? '/app' : '/login'} className="btn-ghost no-underline">
            {isSignedIn ? 'Ir a mi cuenta' : 'Entrar'}
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div>
            <h1 className="landing-title">El nivel ICFES de cada estudiante, área por área, antes del examen.</h1>
            <p className="landing-lede">
              Aprendo es una plataforma de preparación para el Saber 11 del ICFES, para colegios de Colombia.
              Ubica a sus estudiantes de grado 11 en los niveles del examen, les arma un plan de estudio diario
              y le muestra a cada docente quién necesita apoyo y en qué competencia.
            </p>
            <div className="landing-cta">
              {contactHref != null ? (
                <a href={contactHref} className="btn-primary no-underline">
                  Hablar con nosotros
                  <ArrowRight size={18} aria-hidden />
                </a>
              ) : null}
              <Link to={isSignedIn ? '/app' : '/login'} className="btn-secondary no-underline">
                {isSignedIn ? 'Continuar donde iba' : 'Soy estudiante: entrar'}
              </Link>
            </div>
          </div>

          <figure className="landing-artifact sheet">
            <div className="landing-artifact-head">
              <p className="landing-artifact-title">11A · Nivel por área</p>
              <span className="text-xs text-[var(--text-tertiary)]">Panel docente</span>
            </div>
            {/* On a phone the sample scrolls sideways instead of wrapping "Nivel 3". */}
            <div className="overflow-x-auto">
            <table className="data-table landing-sample">
              <thead>
                <tr>
                  <th scope="col">Estudiante</th>
                  {AREAS.map((area) => (
                    <th key={area} scope="col">{area}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_ROWS.map((row) => (
                  <tr key={row.name}>
                    <th scope="row">
                      {row.name}
                      {row.note != null ? <span className="cell-note margin-note">{row.note}</span> : null}
                    </th>
                    {row.levels.map((level, index) => (
                      <td key={AREAS[index]} className={level === 'Nivel 1' ? 'is-low' : undefined}>
                        {level}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <figcaption>Ejemplo con estudiantes ficticios. «—» quiere decir que aún no hay respuestas suficientes para dar un nivel.</figcaption>
          </figure>
        </section>

        <section className="landing-section" aria-labelledby="measures-title">
          <h2 id="measures-title" className="landing-h2">Qué mide, y con cuánta evidencia</h2>
          <dl className="landing-terms">
            <div>
              <dt>Nivelación por área</dt>
              <dd>
                Quince preguntas sin ayuda ubican al estudiante en los mismos cuatro niveles de desempeño
                que reporta el ICFES (Pre A1 a B1 en inglés). Sin un mínimo de respuestas no se afirma
                ningún nivel.
              </dd>
            </div>
            <div>
              <dt>Puntaje global estimado</dt>
              <dd>
                De 0 a 500, siempre con su rango probable, y solo cuando las cinco áreas tienen evidencia.
                Mientras falte un área, se dice cuál falta.
              </dd>
            </div>
            <div>
              <dt>Plan de cada día</dt>
              <dd>
                Lecciones, práctica y repasos según lo que el estudiante más necesita, hasta la fecha de su
                examen. Simulacros cronometrados como la prueba real.
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

        <section className="landing-section landing-split" aria-labelledby="teacher-title">
          <div>
            <h2 id="teacher-title" className="landing-h2">Lo que ve el docente</h2>
            <p className="landing-copy">
              Cada curso tiene su código. Los estudiantes se unen con él y el docente ve, sin hacer nada más,
              qué enseñar esta semana a todo el curso, qué grupos pequeños armar, con quién hablar uno a uno,
              las preguntas que más falla el grupo y su desempeño por competencia ICFES. Puede asignar práctica
              al curso o a un grupo y ver quién la hizo.
            </p>
          </div>
          <div>
            <h2 className="landing-h2">Y lo que no puede hacer</h2>
            <p className="landing-copy">
              Responder por un estudiante, calificarlo o ver sus respuestas en vivo. El docente asigna
              práctica; solo el estudiante practica y presenta sus simulacros. Así el nivel que aparece en el
              panel es del estudiante.
            </p>
          </div>
        </section>

        <section className="landing-section landing-split" aria-labelledby="source-title">
          <div>
            <h2 id="source-title" className="landing-h2">De dónde salen las preguntas</h2>
            <p className="landing-copy">
              De los cuadernillos que el ICFES ha publicado, sin modificarlas y con su fuente. Cada pregunta
              pasa un control de su clave, su área y su tema antes de usarse, y los estudiantes pueden
              reportar la que esté mal. Estamos
              construyendo un banco propio de Aprendo con el mismo proceso de verificación.
            </p>
          </div>
          <div>
            <h2 className="landing-h2">Datos de menores de edad</h2>
            <p className="landing-copy">
              Cada estudiante es dueño de su cuenta. El colegio ve su nivel mientras esté en un curso, y si
              la cuenta se elimina se borra todo lo que el estudiante produjo, como pide la Ley 1581 de 2012.
              Detalles en la <Link to="/privacidad">política de tratamiento de datos</Link>.
            </p>
          </div>
        </section>

        {contactHref != null ? (
          <section className="landing-section" aria-labelledby="contact-title">
            <h2 id="contact-title" className="landing-h2">Llevar Aprendo a su colegio</h2>
            <p className="landing-copy">
              Escríbanos con el nombre del colegio y cuántos estudiantes de grado 11 tienen. Le respondemos con
              una propuesta para su colegio.
            </p>
            <div className="landing-cta">
              <a href={contactHref} className="btn-primary no-underline">
                {CONTACT_EMAIL}
              </a>
            </div>
          </section>
        ) : null}
      </main>

      <footer className="landing-footer">
        <span>Aprendo · preparación para el Saber 11. No estamos afiliados al ICFES.</span>
        <nav aria-label="Legal">
          <Link to="/terminos">Términos</Link>
          <Link to="/privacidad">Tratamiento de datos</Link>
        </nav>
      </footer>
    </div>
  )
}
