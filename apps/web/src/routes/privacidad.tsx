import { Link, createFileRoute } from '@tanstack/react-router'
import { Wordmark } from '../components/BrandMark.tsx'
import { CONTACT_EMAIL } from '../lib/contact.ts'

export const Route = createFileRoute('/privacidad')({
  component: PrivacyPage,
})

/**
 * Política de tratamiento de datos (Ley 1581 de 2012, Decreto 1377 de 2013).
 * Describes what the code actually does; when the product changes what it
 * collects or who receives it, this page changes in the same commit.
 */
function PrivacyPage() {
  return (
    <div className="legal">
      <Link to="/" className="no-underline">
        <Wordmark />
      </Link>
      <h1>Política de tratamiento de datos personales</h1>
      <p>Aplica a quienes usan Aprendo: estudiantes, docentes y administradores de colegios.</p>

      <h2>Qué datos tratamos</h2>
      <ul>
        <li>Tu nombre y tu correo electrónico, para tu cuenta.</li>
        <li>
          Lo que haces al estudiar: tus respuestas, el tiempo en cada pregunta, qué tan seguro dijiste estar,
          las preguntas que marcaste o tachaste y los reportes de preguntas con problemas.
        </li>
        <li>Lo que derivamos de eso: tu nivel por área, tu puntaje estimado y tu plan de estudio.</li>
        <li>Tus conversaciones con el tutor de inteligencia artificial.</li>
        <li>Si estás en un colegio: a qué colegio y curso perteneces y con qué rol.</li>
      </ul>

      <h2>Para qué</h2>
      <p>
        Para prepararte para el Saber 11: medir tu nivel, recomendarte qué estudiar y, si tu colegio usa
        Aprendo, mostrarle a tus docentes tu nivel para que te acompañen. No vendemos tus datos ni los usamos
        para publicidad.
      </p>

      <h2>Quién más los recibe</h2>
      <ul>
        <li>Tus docentes y los administradores de tu colegio ven tu nivel y tu actividad mientras estés en un curso. Pueden leer, nunca responder por ti.</li>
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
        respetando su interés superior. Su madre, padre o representante legal autoriza el tratamiento; cuando
        el estudiante entra por su colegio, el colegio recoge esa autorización.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes conocer, actualizar y corregir tus datos, pedir que los borremos y revocar tu autorización. Para
        borrarlo todo, entra a <Link to="/cuenta">Tu cuenta</Link> y elige «Eliminar mi cuenta»: se borran tus
        respuestas, tu progreso y tus conversaciones con el tutor, y sales de tus colegios.
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
    </div>
  )
}
