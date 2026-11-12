import { Link, createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '../components/PublicPage.tsx'
import { DATA_CONTROLLER, publicHead } from '../lib/site.ts'

export const Route = createFileRoute('/terminos')({
  head: () => publicHead({"title":"Términos de uso | Aprendo","description":"Términos de uso de Aprendo, la plataforma de preparación para el Saber 11 para colegios de Colombia.","path":"/terminos"}),
  component: TermsPage,
})

/** Términos de uso, in plain Spanish and limited to what the product does. */
function TermsPage() {
  return (
    <LegalPage title="Términos de uso" updated="11 de noviembre de 2026">
      <h2>Qué es Aprendo</h2>
      <p>
        Una herramienta de preparación para el examen Saber 11. Los niveles y puntajes que muestra son
        estimaciones hechas con tus respuestas en Aprendo: no son resultados oficiales y no garantizan un
        puntaje en el examen. Aprendo no está afiliado al ICFES.
      </p>

      <h2>Quién ofrece Aprendo</h2>
      <p>
        {DATA_CONTROLLER.legalName}, NIT {DATA_CONTROLLER.nit}, con domicilio en {DATA_CONTROLLER.address}.
        Correo de contacto: {DATA_CONTROLLER.email}.
      </p>

      <h2>El piloto</h2>
      <p>
        Mientras dure el piloto, Aprendo es gratuito y sin fines comerciales: no cobramos ni vendemos acceso.
        Las preguntas de los cuadernillos del ICFES se muestran con su fuente y solo para que estudies.
      </p>

      <h2>Las preguntas</h2>
      <p>
        Las hay de dos tipos, y cada una dice de dónde viene. Las escritas por Aprendo con inteligencia
        artificial, que son las que usa un colegio con licencia, y las de los cuadernillos publicados por el
        ICFES, que se muestran con su fuente y sin modificar. Las explicaciones generadas con inteligencia
        artificial se marcan como tales y pueden tener errores: repórtalos desde la pregunta.
      </p>

      <h2>Tu cuenta</h2>
      <p>
        Es personal. Responde tú: si estás en un colegio, tus docentes ven tu nivel para acompañarte, y lo
        que ven solo sirve si las respuestas son tuyas. No compartas tu contraseña.
      </p>

      <h2>El tutor</h2>
      <p>
        El tutor de inteligencia artificial está disponible al practicar y al revisar, nunca durante el
        diagnóstico o un simulacro. Tiene un límite diario de mensajes.
      </p>

      <h2>Colegios</h2>
      <p>
        Un colegio usa Aprendo con una licencia de cupos y vigencia. Cuando la licencia vence, sus estudiantes
        conservan su cuenta y su progreso, pero nadie nuevo puede unirse a sus cursos hasta renovarla.
      </p>

      <h2>Tus datos</h2>
      <p>
        Los tratamos según la <Link to="/privacidad">política de tratamiento de datos</Link>. Puedes eliminar
        tu cuenta en cualquier momento desde <Link to="/cuenta">Tu cuenta</Link>.
      </p>
    </LegalPage>
  )
}
