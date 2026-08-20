import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useCurrentStudent } from '../lib/student-session.ts'
import BrandMark from '../components/BrandMark.tsx'
import ThemeToggle from '../components/ThemeToggle.tsx'
import { Mascot } from '../components/Mascot.tsx'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

/**
 * The landing page.
 *
 * Brand register: this is the one surface where design *is* the product, so it
 * commits where the app is restrained — a violet field behind the hero, display
 * type at poster scale, and Nico as the protagonist rather than an ornament.
 *
 * The copy deliberately refuses the category script. "Diagnóstico · Seguimiento
 * · 5 áreas" describes every ICFES app ever built and is therefore worth
 * nothing; what this one actually does differently is name the level, put an
 * honest band around the score, and separate knowing from guessing. Those are
 * the three things on the page.
 */
function LandingPage() {
  const { session, isReady } = useCurrentStudent()
  const isSignedIn = isReady && session != null

  return (
    <div className="landing">
      <header className="landing-bar">
        <span className="landing-brand">
          <BrandMark size={22} strokeWidth={2.4} />
          Aprendo
        </span>
        <div className="landing-bar-actions">
          <ThemeToggle />
          {isSignedIn ? null : (
            <Link to="/login" className="landing-bar-link no-underline">
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main>
        {/* Hero — asymmetric on purpose: the claim leads, Nico answers it. */}
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1 className="landing-title">
              Estudiar más no sube tu puntaje.
              <em> Estudiar lo que te falta, sí.</em>
            </h1>
            <p className="landing-lede">
              Aprendo mide en qué nivel del ICFES estás, área por área, y te dice qué practicar
              hoy para subir al siguiente. Con preguntas reales del Saber 11.
            </p>

            <div className="landing-cta">
              {isSignedIn ? (
                <>
                  <Link to="/app" className="btn-primary landing-cta-main no-underline">
                    Continuar donde ibas
                    <ArrowRight size={18} />
                  </Link>
                  <span className="landing-cta-note">Sesión activa: {session.email}</span>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn-primary landing-cta-main no-underline">
                    Empezar mi nivelación
                    <ArrowRight size={18} />
                  </Link>
                  <span className="landing-cta-note">
                    15 preguntas de un área. Sin tarjeta, sin trucos.
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="landing-hero-mascot">
            <Mascot mood="idle" size="xl" />
            <p className="landing-hero-speech">
              Yo soy Nico.<br />
              Te acompaño.
            </p>
          </div>
        </section>

        {/* What it actually tells you — real product artifacts, not icon cards.
            Each block is a different shape because each answers a different
            question; three identical boxes would say they were interchangeable. */}
        <section className="landing-proof">
          <h2 className="landing-h2">Lo que vas a saber de ti</h2>

          <div className="landing-proof-grid">
            <article className="landing-proof-level">
              <p className="landing-proof-label">Tu nivel oficial, por área</p>
              <p className="landing-proof-value">Nivel 3</p>
              <div className="landing-levelbar" role="img" aria-label="Nivel 3 de 4">
                <span className="is-on" />
                <span className="is-on" />
                <span className="is-on" />
                <span />
              </div>
              <p className="landing-proof-note">
                Te faltan <strong>7 puntos</strong> para Nivel 4 en Matemáticas.
              </p>
              <p className="landing-proof-copy">
                Los mismos cuatro niveles que usa el ICFES y que tu colegio nombra. No un
                porcentaje inventado.
              </p>
            </article>

            <article className="landing-proof-score">
              <p className="landing-proof-label">Tu puntaje global estimado</p>
              <p className="landing-proof-value">
                312 <span>/ 500</span>
              </p>
              <div className="landing-scoretrack" role="img" aria-label="Entre 297 y 327 de 500">
                <span className="landing-scoretrack-range" />
                <span className="landing-scoretrack-mark" />
              </div>
              <p className="landing-proof-note">Rango probable: 297–327</p>
              <p className="landing-proof-copy">
                Siempre con su margen. Un estimado hecho con 30 preguntas y uno hecho con 600 no
                son la misma afirmación, y no te los vamos a mostrar igual.
              </p>
            </article>

            <article className="landing-proof-confidence">
              <p className="landing-proof-label">Qué sabes y qué adivinaste</p>
              <ul className="landing-quadrant">
                <li className="is-danger">
                  <strong>Error de concepto</strong>
                  <span>Estabas seguro y fallaste. Lo más urgente.</span>
                </li>
                <li className="is-warn">
                  <strong>Frágil</strong>
                  <span>Acertaste, pero dudando. En el examen puede no repetirse.</span>
                </li>
              </ul>
              <p className="landing-proof-copy">
                Después de responder te preguntamos si estabas seguro. Así una respuesta con
                suerte deja de contar como dominio.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-close">
          <Mascot mood="cheering" size="lg" />
          <h2 className="landing-h2">Empieza por un área. Quince preguntas.</h2>
          <p className="landing-close-copy">
            No necesitas saber por dónde arrancar — para eso es la nivelación. Al terminar ya
            tienes tu nivel y tu ruta.
          </p>
          <Link
            to={isSignedIn ? '/app' : '/login'}
            className="btn-primary landing-cta-main no-underline"
          >
            {isSignedIn ? 'Continuar' : 'Empezar ahora'}
            <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <span>Aprendo · preparación ICFES Saber 11</span>
        <span>Preguntas oficiales del ICFES</span>
      </footer>
    </div>
  )
}
