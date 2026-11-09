import { Link, createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '../components/PublicPage.tsx'
import { CONTACT_EMAIL } from '../lib/contact.ts'
import { publicHead } from '../lib/site.ts'

export const Route = createFileRoute('/privacidad')({
  head: () => publicHead({"title":"Política de tratamiento de datos | Aprendo","description":"Cómo trata Aprendo los datos de estudiantes, docentes y colegios, según la Ley 1581 de 2012.","path":"/privacidad"}),
  component: PrivacyPage,
})

/**
 * Política de tratamiento de datos (Ley 1581 de 2012, Decreto 1377 de 2013).
 * Describes what the code actually does; when the product changes what it
 * collects or who receives it, this page changes in the same commit.
 */
function PrivacyPage() {
  return (
    <LegalPage title="Política de tratamiento de datos personales" updated="8 de noviembre de 2026">
      <p>Aplica a quienes usan Aprendo: estudiantes, docentes y administradores de colegios.</p>

      <h2>Qué datos tratamos</h2>
      <ul>
        <li>Tu nombre y tu correo electrónico, para tu cuenta.</li>
        <li>
          Lo que haces al estudiar: tus respuestas, el tiempo en cada pregunta, qué tan seguro dijiste estar,
          las preguntas que marcaste o tachaste y los reportes de preguntas con problemas.
        </li>
        <li>Lo que derivamos de eso: tu nivel por área, tu puntaje estimado, tu plan de estudio, tus puntos de esfuerzo, tus medallas y tu racha.</li>
        <li>Tus conversaciones con el tutor de inteligencia artificial.</li>
        <li>
          Tu apodo y tu avatar, si los eliges. El apodo sale de una lista cerrada de palabras y el avatar se
          arma con partes dibujadas: no pedimos ni guardamos fotos tuyas.
        </li>
        <li>Si estás en un colegio: a qué colegio y curso perteneces y con qué rol.</li>
      </ul>

      <h2>Para qué</h2>
      <p>
        Para prepararte para el Saber 11: medir tu nivel, recomendarte qué estudiar y, si tu colegio usa
        Aprendo, mostrarle a tus docentes tu nivel para que te acompañen. No vendemos tus datos ni los usamos
        para publicidad.
      </p>

      <h2>La liga del curso</h2>
      <p>
        Es opcional para el colegio y está apagada hasta que el colegio la activa. Cuenta puntos de esfuerzo,
        nunca aciertos ni niveles, y se reinicia cada semana. Solo aparece si participan al menos 5 estudiantes
        del curso, con tu apodo y tu avatar, nunca con tu nombre; si no eliges apodo, sales como «Anónimo».
        Ves a dos compañeros arriba y dos abajo de ti, y en la mitad de abajo ves cuánto te falta, no tu
        puesto. Tus docentes y tu colegio no ven la liga. Puedes salirte cuando quieras, y el cambio es
        inmediato.
      </p>

      <h2>Quién más los recibe</h2>
      <ul>
        <li>Tus docentes y los administradores de tu colegio ven tu nivel y tu actividad mientras estés en un curso. Pueden asignarte práctica, nunca responder por ti ni ver tus respuestas mientras resuelves.</li>
        <li>Si eliges una carrera, tus docentes la ven junto a tu nivel, para orientarte. Puedes cambiarla en Progreso.</li>
        <li>Si le hablas al tutor con el micrófono, el dictado lo hace tu navegador: en Chrome, por ejemplo, Google procesa ese audio. Aprendo no recibe ni guarda el audio, solo el texto que tú decides enviar.</li>
        <li>Convex, que aloja la aplicación y su base de datos.</li>
        <li>
          OpenRouter y el proveedor del modelo de lenguaje, que reciben el texto de tus mensajes al tutor y de
          la pregunta que estás revisando, para responderte.
        </li>
        <li>Resend, que envía los correos de confirmación y de cambio de contraseña.</li>
      </ul>
      <p>Algunos de estos servicios guardan la información fuera de Colombia.</p>

      <h2>Menores de edad</h2>
      <p>
        La mayoría de estudiantes de grado 11 son menores de edad. Tratamos sus datos solo para su educación y
        respetando su interés superior. Su madre, padre o acudiente que sea su representante legal autoriza el
        tratamiento; cuando el estudiante entra por su colegio, el colegio recoge esa autorización. Si eres
        menor de edad y entras por tu cuenta, tu madre, padre o acudiente debe estar de acuerdo. Aprendo no
        guarda datos de tu madre, padre o acudiente.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes conocer, actualizar y corregir tus datos, pedir que los borremos y revocar tu autorización. Para
        llevarte una copia, entra a <Link to="/cuenta">Tu cuenta</Link> y elige «Descargar mis datos». Para
        borrarlo todo, elige ahí mismo «Eliminar mi cuenta»: se borran tus respuestas, tu progreso, tus puntos,
        tu apodo, tu avatar y tus conversaciones con el tutor, y sales de tus colegios y de la liga.
        {CONTACT_EMAIL != null ? (
          <>
            {' '}Para cualquier otra solicitud escríbenos a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </>
        ) : null}
      </p>

      <h2>Datos que se conservan</h2>
      <p>
        Al eliminar una cuenta conservamos solo conteos anónimos de cuántos estudiantes eligieron cada opción de
        una pregunta, que no permiten identificar a nadie.
      </p>
    </LegalPage>
  )
}
