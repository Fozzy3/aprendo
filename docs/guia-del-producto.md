# Guía del producto Aprendo

Esta guía explica, para leer de corrido, todo lo que hace Aprendo hoy. Describe lo que el código hace, no lo que el plan promete. Cuando algo existe solo en el plan, lo digo.

Fecha de corte: 9 de octubre de 2026.

Cada funcionalidad lleva una de dos etiquetas:

- ✅ Funciona: el código existe y hace lo que se describe. Si además depende de un paso del dueño (correr un proceso en el servidor), la sección lo dice con «requiere que el dueño corra…».
- 🗺️ Planeado: está en el plan, pero no hay código.

Dos advertencias generales antes de empezar:

1. Gran parte del trabajo de las Fases 14, 15 y 16 está en el árbol de trabajo sin commit. El tracker (`plans/redesign.md`) da las tres por completas, con typecheck, lint y tests en verde. "Funciona" aquí significa que el código está escrito y tiene tests, no que esté publicado.
2. Ninguna pantalla de las Fases 14, 15 y 16 se ha probado todavía en un navegador real.

## Índice

1. [Qué es Aprendo en una página](#que-es)
2. [Las funcionalidades, área por área](#areas)
   - 2.1 [Entrada: landing, cuenta, nivelación, navegación y diseño](#entrada)
   - 2.2 [Hoy y planificación](#hoy)
   - 2.3 [Aprender: Ruta, Temario, lecciones y maestría](#aprender)
   - 2.4 [Practicar: tipos de sesión, selección, repaso, constructor, reto, confianza y tutor](#practicar)
   - 2.5 [La pantalla de resolver y las herramientas de examen](#resolver)
   - 2.6 [Exámenes y resultados: niveles ICFES, simulacros, reportes y revisión](#examenes)
   - 2.7 [Progreso y medición](#progreso)
   - 2.8 [Contenido, administración y plataforma](#contenido)
3. [De dónde salió cada idea](#ideas)
4. [Lo que decidimos no construir](#no-construir)
5. [Reglas que protegen al estudiante y al negocio](#reglas)
6. [Lo que falta y lo que tiene que hacer el dueño](#falta)
7. [Glosario](#glosario)

---

<a id="que-es"></a>
## 1. Qué es Aprendo en una página

Aprendo es una plataforma para preparar el ICFES Saber 11. Está pensada para estudiantes colombianos de grado 11, la mayoría estudiando desde el celular.

La idea central del rediseño cabe en una frase del tracker: pasar de "banco de preguntas más chat de IA" a "compañero de estudio guiado". Las preguntas sirven como evidencia de lo que el estudiante sabe. La IA enseña. La taxonomía oficial del ICFES (5 áreas, 33 subtemas) es el mapa por el que se navega.

La meta es que Aprendo se sienta como un tutor personal que sabe qué hay que dominar para el ICFES, te dice qué estudiar hoy, te enseña el concepto, te pone a practicar y mide si avanzas.

### El recorrido de un estudiante, de punta a punta

Imaginemos a Laura, de grado 11 en Bogotá.

**Llega y se registra.** Abre Aprendo y ve el titular «Estudiar más no sube tu puntaje. Estudiar lo que te falta, sí.» junto a Nico, la mascota, un oso de anteojos. Toca «Empezar mi nivelación», crea su cuenta con correo y contraseña y entra de inmediato, sin confirmar el correo.

**Se nivela.** Antes de poder usar el resto de la app tiene que nivelarse en al menos un área. Elige Matemáticas: 15 preguntas en 30 minutos, sin tutor y sin ver si acierta. Antes de que arranque el reloj, una pantalla le explica las reglas. Al terminar ve su nivel ICFES (por ejemplo «Nivel 2», 48/100), qué significa ese nivel en palabras del ICFES, cuántos puntos le faltan para el Nivel 3 y los dos subtemas que más le costaron. Con eso se abre el resto de la app.

**Aterriza en Hoy.** Cada vez que entra, Hoy la saluda con su racha, un plan del día de 2 a 4 tareas con minutos estimados, la cuenta regresiva a su examen, cuánto le falta para su meta de puntaje, cuántas horas ha estudiado esta semana y un resumen semanal escrito por la IA.

**Aprende.** La Ruta le muestra un camino de subtemas, uno tras otro, hacia su siguiente nivel. Cada subtema tiene una lección escrita por la IA, con un ejemplo cotidiano colombiano y, a veces, una demo interactiva para explorar.

**Practica.** Desde la lección, la Ruta o el Temario lanza 10 preguntas del subtema. También puede pedir una práctica recomendada, repasar sus errores, armar una práctica a su medida o hacer un reto de dominio que puede subir o bajar su nivel. Al responder puede declarar si estaba segura, si dudó o si adivinó.

**Hace un simulacro.** Cuando quiere medirse en serio presenta el examen completo: Sesión 1 (120 preguntas, 4 h 30), un descanso y Sesión 2 (134 preguntas, 4 h 30), como el día real. La pantalla de resolver imita el examen en papel: puede marcar preguntas, tachar opciones, ocultar el reloj y ver si va a tiempo. Al final recibe un reporte por área. El puntaje global estimado de 0 a 500, con su rango probable, solo sale si el simulacro sirvió preguntas de las 5 áreas; hoy no pasa, porque Inglés no tiene preguntas.

**Revisa.** En la revisión ve cada pregunta como la imprime el ICFES, por qué su opción parecía correcta, por qué las otras no lo son, qué porcentaje de estudiantes eligió cada opción y un tutor de IA al lado al que le puede preguntar.

**Ve su progreso.** En Progreso ve su nivel ICFES por área, su puntaje global estimado con meta, cuánto ha mejorado, en qué subtemas está fuerte o débil y un calendario con los días que estudió.

**Día del examen.** A dos días o menos de la fecha que puso, el plan de Hoy se aligera: solo repaso y una victoria rápida, o directamente «Hoy toca descansar: duerme bien y llega con la cabeza fresca».

Todo esto hoy es gratis y abierto a cualquiera con correo. La capa comercial (pase de pago, prueba sin registro, reporte para acudientes) y el panel para colegios están planeados en las Fases 17 y 18.

---

<a id="areas"></a>
## 2. Las funcionalidades, área por área

Cada funcionalidad sigue el mismo orden: qué ve el estudiante, cómo funciona por dentro, por qué existe, sus límites y dónde vive en el código. Las rutas de código son relativas a la raíz del repo.

Algunas funcionalidades tocan varias áreas (la nivelación, la confianza declarada, el reporte de problemas). Las describo una sola vez y desde las demás áreas remito a esa descripción.

<a id="entrada"></a>
### 2.1 Entrada: landing, cuenta, nivelación, navegación y diseño

#### Landing pública (página de inicio) ✅

*Lo que ve el estudiante.* Al abrir Aprendo ve el titular «Estudiar más no sube tu puntaje. Estudiar lo que te falta, sí.», a Nico diciendo «Yo soy Nico. Te acompaño.» y el botón «Empezar mi nivelación», con la nota «15 preguntas de un área. Sin tarjeta, sin trucos.». Debajo, la sección «Lo que vas a saber de ti» muestra tres ejemplos: un nivel por área (Nivel 3, barra de 3 de 4, «Te faltan 7 puntos para Nivel 4 en Matemáticas»), un puntaje global estimado (312/500, rango 297 a 327) y el cuadrante de confianza («Error de concepto» y «Frágil»). Cierra con «Empieza por un área. Quince preguntas.». Si ya inició sesión, el botón dice «Continuar donde ibas» y muestra su correo.

*Cómo funciona.* Es la ruta `/`. Solo consulta si hay sesión iniciada para decidir adónde llevan los botones: a `/app` si la hay, a `/login` si no. Las cifras de las tres tarjetas están escritas a mano como ejemplo; no son datos del estudiante. La cabecera tiene el logo, el selector de tema y el enlace «Entrar». El pie dice «Aprendo · preparación ICFES Saber 11» y «Preguntas oficiales del ICFES».

*Por qué.* Es la cara de la marca. El comentario del código dice que evita el guion típico del sector («Diagnóstico · Seguimiento · 5 áreas») y vende las tres cosas que distinguen al producto: nivel oficial por área, puntaje con margen honesto y separar saber de adivinar.

*Límites.* Las tarjetas son fijas. No hay precios, términos ni política de privacidad (planeados en la Fase 17). El pie dice «Preguntas oficiales del ICFES» aunque la atribución formal también es de la Fase 17. No se puede probar sin registrarse: todo botón lleva a `/login`.

`apps/web/src/routes/index.tsx`; estilos `.landing*` en `apps/web/src/styles.css`

#### Registro e inicio de sesión ✅

*Lo que ve el estudiante.* En `/login` escribe correo y contraseña (mínimo 8 caracteres) y pulsa «Entrar». Con «¿Aún no tienes cuenta? Crea una» pasa a «Crea tu cuenta» y entra de inmediato, sin confirmar el correo. Si ya tenía sesión, ve «Sesion activa» con su correo y un botón «Continuar». Los errores salen en rojo, por ejemplo «No pudimos iniciar sesión.» o el mensaje que devuelva el servidor. (El código también tiene «La contraseña debe tener al menos 8 caracteres.», pero casi nunca se ve, porque el botón queda deshabilitado mientras la contraseña sea más corta.)

*Cómo funciona.* Usa Better Auth montado sobre Convex, con correo y contraseña, sin verificación de correo y con inicio de sesión automático al registrarse. El correo también se guarda como nombre. El botón queda deshabilitado mientras falte el correo o la contraseña tenga menos de 8 caracteres. Hay una función que convierte los errores de Better Auth en texto legible para no mostrar «[object Object]».

*Por qué.* Hace falta una cuenta para guardar intentos, nivel y progreso. Se eligió el registro mínimo para que el estudiante llegue rápido a la nivelación.

*Límites.* No hay recuperación de contraseña (Fase 17), ni inicio con Google, ni verificación de correo. Los errores del servidor de Better Auth pueden salir en inglés. Faltan tildes en «Sesion activa» y en la etiqueta «Sesion» de la cabecera. No se piden nombre, colegio ni grado.

`apps/web/src/routes/login.tsx`; `apps/web/src/lib/auth-client.ts`; `packages/convex/src/auth.ts`

#### Perfil de estudiante y sesión que sobrevive a la recarga ✅

*Lo que ve el estudiante.* Nada en especial: al crear la cuenta se le crea su perfil, y si recarga la página sigue dentro sin parpadeos.

*Cómo funciona.* Cuando Better Auth crea un usuario, Aprendo normaliza el correo (sin espacios, en minúsculas). Si ya existía un estudiante con ese correo, lo vuelve a vincular; si no, crea uno nuevo. Al cambiar el correo se sincroniza y al borrar el usuario se borra el estudiante. En el servidor, la página lee el token de la cookie antes de pintar. En el navegador ya no se repite esa lectura, porque antes provocaba un bucle de peticiones que dejaba páginas en blanco. Toda consulta de datos de un estudiante verifica que pertenezca a quien la pide («No tienes acceso a este estudiante.»).

*Por qué.* Separa la identidad (la cuenta) de los datos de aprendizaje (el estudiante). La verificación de propiedad cerró un hueco de seguridad encontrado en la Fase 7: cualquier estudiante podía leer las sesiones de otro pasando su identificador.

*Límites.* Al borrar un usuario se borra su fila de estudiante, pero no se ve en el código una limpieza de sus sesiones ni intentos. No hay pantalla de perfil.

`packages/convex/src/auth.ts`; `apps/web/src/routes/__root.tsx`; `apps/web/src/lib/student-session.ts`

#### Entrada a la app y redirecciones ✅

*Lo que ve el estudiante.* Después de entrar ve un momento a Nico pensando con «Preparando tu ruta…». Si no se ha nivelado, va a la Nivelación; si ya lo hizo, a Hoy. La vieja dirección `/dashboard` también lo trae aquí.

*Cómo funciona.* `/app` pregunta al backend el estado del estudiante y navega a `/today` si tiene alguna nivelación (o el diagnóstico antiguo) completa, o a `/diagnostic` si no. Sin sesión, a `/login`.

*Por qué.* Un solo punto decide adónde va cada uno, así el login y la landing no repiten esa lógica.

*Límites.* Hay una consulta parecida en el backend (`getCurrentStudentAppState`) que nadie usa.

`apps/web/src/routes/app.tsx`; `packages/convex/src/students.ts`

#### La puerta de nivelación ✅

*Lo que ve el estudiante.* Mientras no termine al menos una nivelación, si intenta abrir Hoy, Ruta, Temario, Progreso, Historial o una lección, Nico aparece con «Primero nivélate en un área. Con eso se abre el resto de la app.» y lo lleva a la Nivelación. Si abre Práctica, lo lleva directo a la Nivelación, sin ese mensaje. Basta con terminar una sola área, de cualquier materia y con cualquier puntaje.

*Cómo funciona.* El backend revisa si el estudiante tiene alguna sesión de nivelación o de diagnóstico antiguo en estado completado. Devuelve también qué áreas ya niveló y si tiene una nivelación a medias. En la web, un guardián común aplica la regla a todas las pantallas; el hub de Práctica no usa ese guardián: tiene su propia copia de la regla y redirige sin mostrar a Nico. En el servidor, crear una sesión de práctica recomendada, por tema, repaso, simulacro, a tu medida o reto se rechaza con «Nivélate en al menos un área antes de iniciar esta práctica.».

*Por qué.* La Fase 8 cambió la entrada. Antes era un diagnóstico único de 20 preguntas (4 por área) y ahora es una nivelación por área. Medir primero hace que el nivel y la ruta tengan base. Quien ya había hecho el diagnóstico antiguo entra sin repetir nada.

*Límites.* El puntaje no importa para abrir la app: basta con entregar, aunque se dejen preguntas en blanco. Una sesión cronometrada que vence mientras el estudiante está fuera queda como abandonada y no abre la puerta. Las pantallas de resolver y revisar no usan el guardián; las protege la verificación de propiedad en el servidor.

`packages/convex/src/students.ts`; `packages/convex/src/sessions.ts`; `apps/web/src/lib/use-student-guard.ts`

#### Pantalla de Nivelación por área ✅

*Lo que ve el estudiante.* En `/diagnostic` ve a Nico, el título «¿En qué nivel estás?» y el texto «Elige un área y responde 15 preguntas sin ayuda…». Hay 5 tarjetas, una por área (Lectura Crítica, Matemáticas, Ciencias Naturales, Sociales y Ciudadanas, Inglés), cada una con «15 preguntas · 30 min» y su color y emoji. Las áreas ya niveladas llevan el chip verde «Nivelada». Una nivelación a medias dice «En curso · toca para continuar» y se retoma sin pasar por la intro. Cuando ya tiene un área, el título cambia a «Nivela otra área» y aparece «Ir a mi plan de hoy». La cabecera dice «Sin tutor · medimos tu nivel». También puede lanzarla desde el hub de Práctica.

*Cómo funciona.* La nivelación son 15 preguntas de una sola área, con 30 minutos (120 segundos por pregunta), sin tutor y sin retroalimentación hasta el final. Solo usa preguntas del grupo de mayor confianza del banco (el pool `diagnostic`). Elige primero las preguntas que el estudiante nunca ha visto y luego rellena con las vistas, en orden estable del banco. A diferencia de la práctica, no ajusta la dificultad al estudiante: mide. Si varias preguntas comparten un texto, entran todas o ninguna. Si ya hay una nivelación vigente de esa área, la reutiliza en vez de crear otra. Se resuelve dentro de la misma pantalla en modo de pantalla completa y al terminar va al resultado.

*Por qué.* Medir el nivel de una materia a la vez, en 30 minutos, en lugar de un examen largo antes de recibir algo útil. La página queda disponible después para nivelar las otras cuatro áreas o volver a nivelarse.

*Límites.* Con 15 preguntas el nivel es una estimación gruesa: cada pregunta vale unos 6,7 puntos. Si el banco tiene menos de 15 preguntas usables del área, la sesión sale más corta. Si no tiene ninguna, sale «Todavía no hay preguntas de {Área} cargadas. Prueba con otra área.» (hoy pasa con Inglés, que tiene 0 preguntas). La cabecera no tiene botón «Salir» y el logo lleva a la landing.

`apps/web/src/routes/diagnostic.tsx`; `packages/convex/src/sessionKinds.ts`; `packages/convex/src/sessions.ts`; `packages/convex/src/questionPool.ts`

#### Intro antes de una sesión cronometrada ✅

*Lo que ve el estudiante.* Al elegir una nivelación o un simulacro, antes de que arranque el reloj ve, por ejemplo, «Nivelación de Matemáticas · 15 preguntas · 30 min» y tres reglas: «Sin tutor y sin explicaciones hasta el final.», «El reloj sigue corriendo si sales.» y «Si se acaba el tiempo, se entrega sola». Puede pulsar «Empezar» o «Elegir otra área».

*Cómo funciona.* Solo «Empezar» crea la sesión. Si ya hay una sesión igual sin terminar y con reloj vigente, se salta la intro y entra directo, para no anunciar «30 min» cuando quedan 4. El reloj es una marca de tiempo del servidor: la sesión vence en el momento de inicio más el límite. Por accesibilidad, al abrir el foco va al título y al cancelar vuelve al botón de origen.

*Por qué.* El reloj no se pausa, y el estudiante tiene que saberlo antes de empezar. Bluebook hace lo mismo antes de cada módulo cronometrado.

*Límites.* La práctica a tu medida «Con reloj» no pasa por esta intro. El aviso de 30 minutos que tiene el examen real no está construido.

`apps/web/src/components/TimedSessionIntro.tsx`; `apps/web/src/lib/resume-session.ts`

#### Resultado de la nivelación ✅

*Lo que ve el estudiante.* Al entregar llega a una pantalla de resultado, no a la revisión. El título cambia según el caso: «¡Ya tienes tu primer nivel!» (primera nivelación), «¡Subiste de nivel en Matemáticas!» (sube respecto a su nivelación anterior de esa área) o «Tu nivel en {área}». Ve el nivel en grande («Nivel 2», «48/100»), una barra de 4 segmentos con el color del área, «2 de 4 niveles ICFES», «antes estabas en el 1» si había una nivelación anterior, y el descriptor oficial del nivel. Debajo, «Para llegar a Nivel 3 · te faltan 3 puntos» con el descriptor del siguiente nivel (o «Estás en el nivel más alto»). En «Por dónde empezar» salen los 2 subtemas que más le costaron («Acertaste 1 de 3») con «Ver la lección» y «Practicar». Después, las áreas que le faltan por nivelar con la nota «Con las cinco áreas medidas te damos tu puntaje global estimado». Al final, «Revisar pregunta por pregunta». Si respondió menos de 12 preguntas aparece «Estimación preliminar».

*Cómo funciona.* Puntaje = aciertos sobre preguntas servidas, por 100, redondeado. Las preguntas en blanco cuentan como error, como en el ICFES. El nivel sale de los cortes oficiales (ver [Niveles ICFES oficiales](#niveles-icfes)). Puntos que faltan = corte del siguiente nivel menos el puntaje, redondeado hacia arriba. Los subtemas débiles son los que tienen al menos un fallo, ordenados por menor precisión y luego por más fallos. Nico celebra solo en la primera nivelación o cuando sube de nivel con al menos 12 respuestas.

*Por qué.* Es el primer momento en que el producto le dice algo al estudiante sobre sí mismo, como la revelación de puntaje de Bluebook. Usa los mismos 4 niveles que el ICFES y el colegio, y siempre ofrece un siguiente paso concreto.

*Límites.* El puntaje de 0 a 100 es la precisión cruda sobre el banco de Aprendo, no un puntaje equiparado del ICFES. El «antes estabas en» compara solo con la nivelación anterior de esa área, no con el nivel de Progreso, que usa Elo y puede diferir. Los subtemas débiles salen de pocas preguntas. El puntaje global solo aparece con las 5 áreas medidas.

`apps/web/src/components/NivelacionResult.tsx`; `apps/web/src/lib/result-display.ts`; `packages/convex/src/examReport.ts`

#### Diagnóstico inicial antiguo (20 preguntas) ✅

*Lo que ve el estudiante.* Ya no se puede iniciar. Quien lo hizo antes del cambio entra a la app sin repetir nada.

*Cómo funciona.* Sigue configurado (4 preguntas por área, 20 en total, sin reloj), pero no se puede lanzar. Cuenta como ubicación para abrir la app, aunque no marca ninguna área como «Nivelada».

*Por qué.* Compatibilidad con estudiantes anteriores a la Fase 8.

*Límites.* Un estudiante que solo hizo el diagnóstico antiguo ve las 5 áreas sin el chip «Nivelada».

`packages/convex/src/sessionKinds.ts`

#### Navegación principal: Hoy, Ruta, Práctica, Progreso ✅

*Lo que ve el estudiante.* Arriba ve el logo «Aprendo · Preparación Saber 11», 4 pestañas en forma de píldora (Hoy, Ruta, Práctica, Progreso), su correo, el selector de tema y «Salir». La pestaña activa se pinta violeta con contorno grueso. En el Temario o en una lección, la pestaña activa es Ruta. En el Historial, es Progreso.

*Cómo funciona.* 4 pestañas cubren 6 secciones: el Temario cuelga de Ruta y el Historial de Progreso. Por debajo de 1200 px de ancho se oculta el correo para que la cabecera quepa en una fila. Un borde transparente reservado evita que la barra salte al cambiar de pestaña.

*Por qué.* Es la arquitectura de información del rediseño: 4 entradas en vez de 6, para no engordar la barra.

*Límites.* No hay enlace al panel de administración. La pantalla de Nivelación usa su propia cabecera.

`apps/web/src/components/StudentAppShell.tsx`

#### Barra inferior en el teléfono y modo de pantalla completa ✅

*Lo que ve el estudiante.* En el celular, las 4 secciones bajan a una barra fija abajo, al alcance del pulgar. Arriba quedan el logo, el tema y «Salir». Mientras resuelve o revisa preguntas desaparecen la barra y la cabecera, y la pregunta ocupa toda la pantalla.

*Cómo funciona.* A 780 px o menos de ancho aparece la barra inferior, que respeta el área segura del iPhone. En resolver y revisar, la pantalla usa la altura visible real del teléfono, en lugar de una medida antigua que escondía los botones Anterior, Siguiente y Terminar en Android.

*Por qué.* La mayoría de estudiantes colombianos estudia en el teléfono.

*Límites.* Falta `viewport-fit=cover`, así que el área segura del iPhone puede no rellenarse del todo. No se ha probado en un navegador real.

`apps/web/src/components/StudentAppShell.tsx`; `apps/web/src/styles.css`

#### Cerrar sesión ✅

*Lo que ve el estudiante.* Pulsa «Salir»; el texto cambia a «Saliendo…» y vuelve a la landing.

*Cómo funciona.* Cierra la sesión y recarga la página completa para limpiar todo lo guardado en memoria. Ignora clics repetidos.

*Por qué.* Para equipos compartidos, como el del colegio o una sala de internet.

*Límites.* Solo existe en la cabecera principal. La pantalla de Nivelación no tiene «Salir».

`apps/web/src/components/StudentAppShell.tsx`

#### Tema claro, oscuro y automático ✅

*Lo que ve el estudiante.* Un botón redondo con sol, luna o medio círculo cambia el tema: claro, oscuro, automático, y vuelta a empezar. La preferencia se recuerda y la página no parpadea al cargar.

*Cómo funciona.* Se guarda en el navegador. Un pequeño script corre antes del primer pintado y aplica el tema correcto. En modo automático sigue al sistema operativo en vivo. Las demos de las lecciones, que corren aisladas, también siguen el tema.

*Por qué.* Comodidad para estudiar de noche. Hay una sola fuente del tema para que no se desincronicen los colores (antes había dos copias y divergieron).

*Límites.* La etiqueta de accesibilidad del botón está en inglés. La preferencia es por navegador, no por cuenta.

`apps/web/src/components/ThemeToggle.tsx`; `apps/web/src/routes/__root.tsx`

#### Nico, la mascota ✅

*Lo que ve el estudiante.* Nico es un oso de anteojos violeta oscuro con manchas crema. Aparece en momentos clave: de pie y celebrando en la landing, inclinando la cabeza en las cargas largas, esperando en la Nivelación y feliz cuando ya hay un área nivelada, celebrando el primer nivel, una subida de nivel o el descanso entre las dos sesiones del simulacro, y durmiendo con «zz» cuando no hay historial. También sale en estados como «Esta sesión venció» o «Todavía no puedo medir nada».

*Cómo funciona.* Es un dibujo vectorial con 5 estados de ánimo (quieto, feliz, pensando, celebrando, durmiendo) y 4 tamaños. Parpadea, respira, salta al celebrar. Todas las animaciones se apagan si el sistema pide reducir movimiento. Sus colores se aclaran en modo oscuro.

*Por qué.* Una identidad propia y colombiana: el oso de anteojos es el único oso nativo de Sudamérica. Se descartó un búho a propósito porque es el de Duolingo. La regla es que Nico va en los momentos importantes, no en cada transición.

*Límites.* No habla ni da consejos personalizados. Solo celebra en umbrales reales.

`apps/web/src/components/Mascot.tsx`

#### Pantallas de carga ✅

*Lo que ve el estudiante.* Al entrar a la app ve a Nico pensando con un mensaje como «Preparando tu ruta…». Al cambiar de pestaña dentro de la app solo ve tres puntitos con un texto como «Calculando tu nivel…».

*Cómo funciona.* Hay dos componentes de espera: uno de pantalla completa con Nico, que sale una vez por visita, y uno pequeño dentro de la app ya pintada. Reemplazaron unas 20 variantes que había antes.

*Por qué.* Coherencia, y Nico reservado para la espera real.

`apps/web/src/components/FullScreenLoader.tsx`

#### Sistema de diseño juvenil: violeta y dorado ✅

*Lo que ve el estudiante.* Una estética entre Duolingo y Brilliant: fondo blanco o lavanda, botones violeta con contorno grueso y una sombra dura que se hunde 2 px al presionarlos, esquinas muy redondeadas, títulos en Bricolage Grotesque y texto en Hanken Grotesk. En modo oscuro, el fondo es azul noche.

*Cómo funciona.* Todo vive en una sola hoja de estilos (unas 5.600 líneas). Colores principales: violeta de marca `#6c4cf1`, dorado `#ffc93c`, verde de acierto `#21c08b` y rojo de error `#ff5d5d`. Hay una convención de forma: la sombra dura significa "se puede presionar" y el contorno de 2 px significa "superficie". Un puente conecta estos colores con la librería de componentes shadcn, así esos componentes ya usan la paleta.

*Por qué.* La Fase 6 cambió la identidad de crema y coral a violeta sin rehacer las pantallas: cambió los colores base y unas 200 clases los heredaron. Los colores de acierto y error nunca dependen del color de marca. Hubo un bug en que los errores se pintaban con el color de marca y solo se veían rojos porque la marca era coral.

*Límites.* La hoja de estilos es muy grande. El plan pide usar los componentes shadcn en vez de seguir añadiendo clases a mano. La identidad antigua (crema, coral, Fraunces y Manrope) está derogada.

`apps/web/src/styles.css`; `apps/web/src/components/ui/*`

#### Color, emoji y logo por área ✅

*Lo que ve el estudiante.* Cada área tiene su color y su emoji en todas las pantallas: Lectura Crítica rosa, Matemáticas azul, Ciencias Naturales turquesa, Sociales naranja e Inglés morado. El color aparece como un punto, no en todo el borde. El logo de Aprendo son tres capas apiladas en violeta.

*Cómo funciona.* Los cinco colores comparten luminosidad y saturación; solo cambia el tono. Los tonos se eligieron lejos del rojo de error, el dorado, el verde de acierto y el violeta de marca.

*Por qué.* Reconocer el área de un vistazo sin confundirla con "acertaste" o "fallaste". Antes Ciencias tenía el mismo tono que "correcto" y Lectura casi el mismo que "error".

`apps/web/src/lib/subject-theme.ts`; `apps/web/src/components/BrandMark.tsx`

---

<a id="hoy"></a>
### 2.2 Hoy y planificación

#### La pantalla Hoy ✅

*Lo que ve el estudiante.* Es la pantalla de inicio. Ve un saludo según la hora de su dispositivo («Buenos días» antes de las 12, «Buenas tardes» antes de las 19, «Buenas noches» después), el subtítulo «Un paso más cerca de tu Saber 11.» y, en este orden: racha, «Tu plan de hoy», cuenta regresiva al examen, brecha a la meta de puntaje, «Tu tiempo de estudio», «Foco de la semana», «Continúa donde quedaste» y, si existe, el resumen «Tu semana» del coach. Mientras carga ve «Preparando tu día…».

*Cómo funciona.* Hoy hace cuatro consultas en vivo al backend. La principal lee de una vez todos los intentos, sesiones y agregados del estudiante y devuelve racha, semana, plan del examen, puntaje global, tiempo de estudio y plan del día.

*Por qué.* Es el centro de la promesa: un tutor que te dice qué estudiar hoy. Imita la misión diaria de Khan Academy y la pantalla de inicio de Duolingo.

*Límites.* Cada carga recorre todos los intentos del estudiante. El código anota que, si el historial crece mucho, habrá que guardar la racha precalculada.

`apps/web/src/components/TodayPage.tsx`; `packages/convex/src/today.ts`

#### Racha y días activos ✅

*Lo que ve el estudiante.* Una tarjeta con una llama: «Racha: 5 días» y «Esta semana: 3/5 días». Si ayer practicó y hoy todavía no, la racha sigue viva.

*Cómo funciona.* Un día cuenta si hay al menos una respuesta ese día, en hora de Colombia (el día cambia a medianoche de Bogotá). La racha empieza a contar en hoy si hubo actividad, o en ayer si no, y sigue hacia atrás mientras haya días seguidos. La semana va de lunes a domingo, la misma que usa el coach. La meta de la semana son 5 días, fija.

*Por qué.* Crear hábito, como Duolingo y Khan.

*Límites.* La meta de 5 días no se puede cambiar y es independiente de la meta de horas. Cuenta respuestas de sesiones todavía abiertas. No hay "congelador de racha" ni recompensas.

`packages/convex/src/today.ts`; `packages/convex/src/colombiaTime.ts`

#### Tu plan de hoy ✅

*Lo que ve el estudiante.* Una tarjeta con 2 a 4 tareas numeradas. Cada una tiene ícono, título, una razón (por ejemplo «Funciones y gráficas (Matemáticas) es donde más puntos del global puedes ganar.»), minutos estimados y el total (unos 40 min). Tocar una tarea la abre; el botón grande «Empezar» abre la primera. Las tareas con reloj (nivelación, simulacro) pasan antes por la intro cronometrada, con «Volver al plan». Un estudiante nuevo podría ver: «1) Nivelación de Lectura Crítica. Aún no tienes nivel en Lectura Crítica. Sin él no hay puntaje global. 30 min. 2) Lección: {subtema}. 10 min». A 2 días o menos del examen solo ve repaso y una victoria rápida. Si no hay ninguna de las dos, ve «Hoy toca descansar» con «Tu examen está muy cerca. Hoy nada pesado: duerme bien y llega con la cabeza fresca.».

*Cómo funciona.* Las reglas, en orden:

1. Ordena todos los subtemas con preguntas disponibles, practicados o no, por cuántos puntos del global pueden dar. Los que nunca se practicaron cuentan como Sin empezar, con dominio 0. La cuenta combina el peso del área (3 para las cuatro principales, 1 para Inglés), cuánto le falta al área (un área sin medir cuenta como 50) y cuánto le falta al subtema. El "principal" es el de más ganancia que no esté en Competente ni Dominado. La "victoria rápida" es el subtema en Familiar más cerca de Competente (el de mayor dominio), sin importar su ganancia, y nunca el mismo que el principal.
2. Si faltan 0 a 2 días para el examen: solo repaso y victoria rápida.
3. Si no queda ningún área sin nivelar (nivelada o con 12 respuestas o más): si nunca hizo un simulacro completo, o la última Sesión 2 fue hace 28 días o más, propone «Simulacro · Sesión 1» (270 min). Si hizo la Sesión 1 y le falta la 2, desde el día siguiente propone «Simulacro · Sesión 2». El simulacro va primero y le siguen hasta 3 tareas normales.
4. Además arma candidatos en este orden: nivelación del área pendiente con más peso (30 min), lección del subtema principal si está sin empezar o solo intentado (10 min), práctica del principal (10 preguntas, 20 min; si no hay principal, práctica del área con más puntos por ganar), victoria rápida (20 min), repaso de errores (2 min por pregunta pendiente, hasta 10), y al final un reto de dominio (6 preguntas, 12 min) si ya practicó 3 subtemas o una práctica recomendada (10 preguntas, 20 min).

Toma tareas hasta 4, mínimo 2, y para cuando los minutos llegan a la meta semanal dividida entre 5 (por defecto, 180 / 5 = 36 minutos).

*Por qué.* Traduce la secuencia que recomienda el mundo SAT (Khan, College Board, Magoosh): medir primero, trabajar donde rinden los puntos según los pesos oficiales, intercalar una victoria rápida, volver a medirse cada mes y aligerar los últimos días.

*Límites.* Inglés tiene 0 preguntas, así que nunca queda nivelado ni con evidencia. Por eso, cuando las cuatro áreas principales ya están niveladas, el plan propone «Nivelación de Inglés», y esa tarea falla con «Todavía no hay preguntas de Inglés cargadas». Por la misma razón, la regla del simulacro nunca se activa hoy. Los 2 minutos por pregunta y 10 por lección son supuestos fijos. Reemplazó el botón único de práctica recomendada y la tarjeta separada de repaso que tenía Hoy.

`packages/convex/src/studyPlan.ts`; `apps/web/src/components/DailyPlan.tsx`

#### Fecha del examen y cuenta regresiva ✅

*Lo que ve el estudiante.* Sin fecha, ve «¿Cuándo presentas el ICFES? Con la fecha, tu plan deja de ser una sugerencia y pasa a tener rumbo.» con un selector de fecha. Con fecha, ve un número grande de días y un mensaje que cambia con la distancia: más de 90 días, «Tienes tiempo. Úsalo.»; 31 a 90, «Ya se ve en el calendario.»; 8 a 30, «Recta final.»; 0 a 7, «Es esta semana.» (el mismo día, «¡es hoy!»); si ya pasó, «Tu examen ya pasó. Actualiza la fecha si vas a presentarlo de nuevo.». Debajo: «10 semanas · a tu ritmo te alcanzan unas 30 sesiones más.». Con el lápiz cambia la fecha.

*Cómo funciona.* La fecha se guarda a mediodía local, porque medianoche en hora universal caería a las 7 p. m. del día anterior en Bogotá y toda la cuenta saldría corrida un día. Semanas = días restantes entre 7, hacia arriba. El ritmo es días activos por semana desde que empezó, o 5 si no hay historia. Sesiones proyectadas = semanas por ritmo.

*Por qué.* Con fecha, el plan tiene un presupuesto de tiempo. El tono cambia a propósito: "faltan 8 meses" debe sentirse como espacio y "faltan 3 días" no.

*Límites.* Las "sesiones" proyectadas en realidad son días activos. La pantalla no permite borrar la fecha. No hay calendario oficial del ICFES cargado: la fecha la pone el estudiante.

`packages/convex/src/examPlan.ts`; `apps/web/src/components/ExamCountdown.tsx`

#### Brecha a la meta y veredicto "vas a tiempo" ✅

*Lo que ve el estudiante.* Bajo la cuenta regresiva: «Te faltan 50 puntos para tu meta de 350. Tu global estimado: 300 (entre 235 y 365). Quedan 10 semanas: unos 5 puntos por semana.». Si hay suficiente historia, un chip verde «Vas a tiempo: subes unos 7 puntos por semana.» o uno dorado «A tu ritmo actual (2 puntos por semana) no llegas. Sube la dosis de práctica.». Sin meta, «Ponte una meta de puntaje global» con el enlace «Ponerme una meta», que lleva a Progreso. Si ya la alcanzó, «Ya alcanzaste tu meta de 350» y «Súbela si quieres apuntar más alto.». Sin fecha, «Pon la fecha de tu examen para saber a qué ritmo subir.». A 2 días o menos del examen, o con el examen pasado, no hay veredicto, solo un consejo de repasar o de actualizar la fecha. Sin puntaje global todavía, «Aún no hay puntaje global» con cada área y lo que le falta, por ejemplo «Nivel 2 · 8 pts para Nivel 3» junto al nombre del área, o «Sin nivel aún».

*Cómo funciona.* Brecha = meta menos estimado. Puntos por semana necesarios = brecha entre semanas restantes. Para el veredicto, Aprendo reconstruye cuál era el puntaje global del estudiante al cierre de cada semana activa (solo desde que las 5 áreas tienen 12 o más respuestas) y traza una línea de tendencia. Necesita al menos 3 semanas para opinar. Va a tiempo si semanas restantes por pendiente alcanza la brecha.

*Por qué.* Decir cuánto falta y si el ritmo alcanza, sin inventar una tasa de mejora supuesta. Si no hay tres semanas de datos, no da veredicto.

*Límites.* La tendencia semanal usa precisión cruda y el estimado actual puede usar Elo, así que pueden no cuadrar. Exige 3 semanas con las 5 áreas medidas.

`packages/convex/src/examPlan.ts`; `packages/convex/src/globalScore.ts`; `apps/web/src/lib/today-display.ts`

#### Tiempo de estudio y meta de horas ✅

*Lo que ve el estudiante.* La tarjeta «Tu tiempo de estudio» dice, por ejemplo, «1 h 20 min de 3 h esta semana», con una barra (verde al cumplir: «¡Cumpliste tu meta de la semana!»; si no, «Te faltan 1 h 40 min para tu meta.») y un gráfico de barras de las últimas 6 semanas con la meta como línea punteada dorada. Con «Meta: 3 h/semana» cambia la meta en horas (acepta coma o punto), entre media hora y 20 horas.

*Cómo funciona.* Suma el tiempo que pasó en cada pregunta, por semana de lunes a domingo, con un tope de 5 minutos por pregunta para que un celular olvidado no cuente como 5 horas. Si una pregunta no tiene tiempo por visitas, usa su tiempo de respuesta. La meta por defecto es 180 minutos. La meta también fija cuánto cabe en el plan diario (un quinto de la meta semanal).

*Por qué.* Las horas son el único número de "dosis y respuesta" en el que coincide el mundo SAT (College Board habla de unas 20 horas de práctica). No se promete una ganancia de puntos porque no hay datos de resultados para respaldarla.

*Límites.* Solo mide tiempo dentro de preguntas de sesiones terminadas. No cuenta lecciones, tutor ni sesiones abiertas.

`packages/convex/src/studyTime.ts`; `apps/web/src/components/StudyTimeCard.tsx`

#### Foco de la semana ✅

*Lo que ve el estudiante.* Una tarjeta con su área más débil y un mensaje en lenguaje ICFES, por ejemplo «Ciencias Naturales. Te faltan 6 puntos para Nivel 3». Al tocarla va a la Ruta. Sin datos: «Haz tu primera práctica para descubrir tu foco.».

*Cómo funciona.* Toma el área con el puntaje de dominio más bajo y le añade su nivel y los puntos al siguiente.

*Por qué.* Dar una sola dirección semanal en la escala que publica el ICFES.

*Límites.* Lleva a la Ruta en general, no a la de esa área. No usa los pesos 3 y 1 que sí usa el plan del día.

`apps/web/src/components/TodayPage.tsx`

#### Continúa donde quedaste ✅

*Lo que ve el estudiante.* Si tiene una sesión abierta, ve su tipo («Práctica por tema», «Simulacro de examen»…) con «10 preguntas · en curso» y la retoma de un toque. Si no, «No tienes sesiones en curso. Empieza tu plan de hoy.».

*Cómo funciona.* Ya no ofrece sesiones cronometradas vencidas.

*Límites.* Muestra una sola sesión.

`apps/web/src/components/TodayPage.tsx`

#### El coach semanal con IA ✅

*Lo que ve el estudiante.* Si estudió esta semana, aparece «Tu semana» con 2 a 4 frases cálidas en segunda persona: celebra un logro concreto, señala con tacto una materia a reforzar y cierra con una recomendación. La primera vez ve «Preparando tu resumen…». Si ya había un resumen, sigue viéndolo mientras se actualiza.

*Cómo funciona.* Hay un resumen por estudiante y por semana, guardado. Solo se pide si hubo actividad. La IA recibe las cifras de la semana (preguntas, aciertos de sesiones terminadas, días activos, resultados por materia) con la instrucción de no inventar cifras. Si hubo actividad nueva y pasaron 3 horas, se reescribe. Si la reescritura falla, se conserva el texto anterior. Usa el modelo DeepSeek v4 flash a través de OpenRouter.

*Por qué.* Es el equivalente al reporte semanal de Khan o PrepScholar: convertir números en una lectura humana y accionable, sin gastar IA en semanas vacías.

*Límites.* No hay historial de semanas anteriores. Si la primera generación falla, no se muestra nada y no hay botón de reintento. No tiene límite diario de uso. Necesita la clave de OpenRouter configurada.

`packages/convex/src/coach.ts`; `packages/convex/src/aiCache.ts`

---

<a id="aprender"></a>
### 2.3 Aprender: Ruta, Temario, lecciones y maestría

#### La taxonomía oficial: 5 áreas, 25 categorías, 33 subtemas ✅

*Lo que ve el estudiante.* No es una pantalla: es el mapa sobre el que se ordenan el Temario, la Ruta, las lecciones y la maestría. Los nombres son siempre los mismos, por ejemplo «Geometría y medición → Geometría plana / Perímetro, área y volumen».

*Cómo funciona.* Vive en un archivo de datos con tres niveles: área, categoría y subtema. Lectura Crítica tiene 5 categorías y 8 subtemas; Matemáticas, 6 y 8; Ciencias Naturales, 5 y 6; Sociales y Ciudadanas, 4 y 6; Inglés, 5 y 5. Cada pregunta tiene un subtema principal y hasta 2 secundarios. El archivo también trae dimensiones extra (competencia oficial ICFES, tipo de estímulo, carga de lectura o de cálculo, banda de inglés), pero la app no las usa para navegar.

*Por qué.* Medir, recomendar y generar lecciones con un contrato fijo, no con etiquetas inventadas.

*Límites.* Es una versión mínima. Algunos subtemas abarcan mucho, como «Ecuaciones e inecuaciones».

`docs/taxonomy.v1.json`; `packages/convex/src/taxonomy.ts`

#### Temario: tu mapa de estudio ✅

*Lo que ve el estudiante.* En `/syllabus` ve el temario ICFES completo. Arriba, su dominio total (por ejemplo «56% · 280 / 500 pts») y la leyenda de los 5 niveles de maestría. Debajo, chips de área con su porcentaje. Al elegir un área ve un anillo de progreso, los puntos, «N de M temas en Competente o más» y la lista de categorías con sus subtemas. Cada subtema muestra su nivel de maestría, el chip «Lección» si ya hay lección escrita y el botón «Practicar 12», donde el número son las preguntas disponibles, o «Sin preguntas». Tocar el nombre abre la lección.

*Cómo funciona.* Cuenta las preguntas que se pueden lanzar por subtema, con la misma definición que usa la práctica: debe tener clave, área, categoría y subtema. Así el número anunciado coincide con lo que se puede practicar. El porcentaje y los puntos se calculan con los niveles de maestría (ver más abajo). «Practicar» lanza 10 preguntas del subtema, sin reloj.

*Por qué.* Fue la Fase 1 del rediseño: convertir la taxonomía en un mapa de progreso y un menú de estudio a la vez, como los cursos de Khan Academy.

*Límites.* Exige estar nivelado. El banco es pequeño (213 preguntas), así que muchos subtemas muestran pocas preguntas o «Sin preguntas».

`apps/web/src/components/SyllabusPage.tsx`; `packages/convex/src/syllabus.ts`

#### Ruta de aprendizaje ✅

*Lo que ve el estudiante.* En `/path` elige un área (abre en el área del Foco de Hoy) y ve un camino vertical de nodos, un subtema por nodo en el orden de la taxonomía. Cada nodo muestra su categoría, su nivel de maestría y sus preguntas, y tiene uno de 4 estados: hecho (Competente o Dominado), recomendado («Recomendado ahora»), disponible o vacío («Sin preguntas aún: no bloquea tu ruta»). Todos tienen «Ver lección» (o «Aprender el tema») y «Practicar». Arriba, una tarjeta con el dominio del área y los puntos. Abajo, «Ver todo el temario».

*Cómo funciona.* Nada se bloquea (F33): las áreas del ICFES no tienen prerrequisitos estrictos y el candado solo frenaba. «Recomendado ahora» va en la elección del plan para esa área (`studyPlan.nextSubtopics`, la misma que leen Hoy y Progreso), o en el primer nodo abierto si el plan no elige ninguno ahí.

*Por qué.* Un camino guiado, "un tema a la vez, hasta tu siguiente nivel", como la ruta de Duolingo o las unidades de Khan, para no dejar al estudiante solo frente a 33 subtemas.

*Límites.* El orden es el de la taxonomía, no un orden de prerrequisitos.

`apps/web/src/components/LearningPathPage.tsx`; `apps/web/src/lib/mastery-display.ts`; `packages/convex/src/path.ts`

#### Nivel ICFES del área en la cabecera de la Ruta ✅

*Lo que ve el estudiante.* «Tu nivel ICFES: Nivel 2», una barra de 4 segmentos, el descriptor oficial y «Te faltan 7 puntos para Nivel 3». Sin evidencia suficiente: «Sin nivel aún: te faltan N preguntas en esta área para calcular tu nivel ICFES con confianza».

*Cómo funciona.* Es el mismo cálculo que en Progreso y Hoy (ver [Tu nivel ICFES por área](#nivel-area)), así que el área nunca aparece en dos niveles distintos.

`packages/convex/src/path.ts`

#### Niveles de maestría por subtema ✅

*Lo que ve el estudiante.* Cada subtema tiene uno de 5 niveles, con una insignia de barras tipo señal: Sin empezar, Intentado, Familiar, Competente y Dominado. La leyenda explica: «Practicando un tema llegas hasta Competente, si aciertas sin pedir ayuda al tutor. Dominado se gana en sesiones que miden sin ayuda (reto, nivelación, simulacro), y fallar ahí puede bajarte un nivel». Ejemplo: 4 de 4 aciertos practicando «Funciones y gráficas» lo dejan en Competente. Para llegar a Dominado tiene que acertar todas las de ese subtema en un simulacro o un reto.

*Cómo funciona.* El nivel se mueve una vez por sesión entregada, y la regla depende del tipo de sesión:

- Práctica enfocada (por tema, a tu medida, repaso espaciado, cualquier práctica con retroalimentación inmediata, o recomendada con menos de 3 subtemas): todo bien con 4 o más preguntas da Competente, salvo que haya pedido ayuda al tutor en alguna, que la deja en Familiar; 70 % o más da Familiar; menos da Intentado. Nunca baja.
- Sesión mixta (nivelación, simulacro, diagnóstico antiguo, recomendada con 3 o más subtemas): todo bien sube un nivel (si estaba por debajo de Familiar, salta a Familiar) y cualquier fallo baja uno, sin bajar de Intentado.
- Reto: todo bien sube, todo mal baja, mixto se queda.
- «Arma tu práctica» con la fuente Falladas o Marcadas: no mueve el nivel, porque el estudiante ya vio esas claves.

Las preguntas en blanco cuentan como fallo, con una excepción: si todas las preguntas del subtema en esa sesión quedaron en blanco, el nivel no cambia. Solo cuenta el subtema principal de cada pregunta. Tampoco cuentan las preguntas cuya clave el estudiante ya vio (en la revisión de una sesión entregada o con «Comprobar»): acertarlas es memoria, no dominio. Los subtemas que ya tenían práctica antes de este sistema no se migran: muestran un nivel conservador (Familiar si su precisión es de 70 % o más; si no, Intentado) hasta su siguiente sesión con ese subtema.

*Por qué.* Es el sistema de maestría de Khan Academy. Acertar diez seguidas del mismo tema dice menos que acertar dos mezcladas entre otros temas, que es como pregunta el Saber 11.

*Límites.* El paso del tiempo nunca baja un nivel. Convive con un puntaje de dominio antiguo (de 0 a 1) que el backend sigue usando, por ejemplo para ordenar los subtemas más débiles.

`packages/convex/src/mastery.ts`; `apps/web/src/components/MasteryBadge.tsx`

#### Puntos y porcentaje de dominio ✅

*Lo que ve el estudiante.* Su dominio en puntos, al estilo Khan: «Matemáticas 39% · 310 / 800 pts · 3 de 8 temas en Competente o más» (1 Dominado, 2 Competente y 1 Familiar), en el Temario y en la Ruta. Temario, Ruta y Progreso cuentan sobre los mismos subtemas.

*Cómo funciona.* Familiar vale 50 puntos, Competente 80 y Dominado 100. Sin empezar e Intentado valen 0. El máximo es 100 por subtema. Un subtema sin preguntas y sin nivel no cuenta, para no hundir el porcentaje de forma injusta. Los subtemas sin practicar sí cuentan como 0, para que dejar los difíciles sin tocar no infle el número.

*Por qué.* Como los puntos de un curso en Khan: un número que solo sube cuando se demuestra dominio.

*Límites.* Es distinto del nivel ICFES del área, y la pantalla no explica la diferencia.

`packages/convex/src/mastery.ts`; `apps/web/src/lib/mastery-display.ts`

#### Lección por concepto escrita por la IA ✅

*Lo que ve el estudiante.* En `/lesson/{subtema}` ve una miga de pan hacia su área, el título y la sección «La idea»: una explicación con fórmulas bien escritas que empieza con un ejemplo cotidiano colombiano (el recibo de la luz, TransMilenio, la tienda del barrio), construye la regla y nombra el error típico. Si la lección no existe aún, ve «Escribiendo tu lección…» y el texto aparece solo. Al final está «Practicar este tema». Si falla, ve «Reintentar». Si falla una versión nueva, sigue leyendo la anterior con el aviso «No pudimos actualizar esta lección; te mostramos la versión anterior».

*Cómo funciona.* Hay una lección por subtema, compartida por todos los estudiantes. La primera persona que la abre dispara la escritura, y el sistema evita que se escriba dos veces si dos estudiantes la abren a la vez. Usa DeepSeek v4 flash. Cada lección guarda la versión de las instrucciones con que se escribió; al subir esa versión (hoy es la 7), las lecciones se reescriben cuando alguien las visita.

*Por qué.* La IA es el motor de enseñanza: una micro-lección para entender el concepto antes de practicar, con la misma voz que el tutor.

*Límites.* Nadie revisa el contenido antes de publicarlo. No se personaliza. No incluye preguntas ni "cómo lo pregunta el ICFES" (se quitaron a propósito). Una lección fallida no se reintenta sola. No tiene límite diario de uso.

`apps/web/src/components/LessonPage.tsx`; `packages/convex/src/lessons.ts`

#### Demo interactiva dentro de la lección ✅

*Lo que ve el estudiante.* En los subtemas donde ayuda (sobre todo matemáticas y ciencias), debajo del texto aparece una herramienta con deslizadores o clics. Por ejemplo, mover un deslizador y ver cómo cambia la pendiente de una recta. Mientras se construye ve «Creando una demostración interactiva… Ya puedes leer la lección mientras tanto». Sigue el tema claro u oscuro.

*Cómo funciona.* La IA decide primero si hace falta una demo. Si sí, escribe un fragmento de página con reglas estrictas: sin librerías externas, con los colores y fuentes de Aprendo, en español y sin preguntas. La app la muestra en un recuadro aislado de 26rem de alto. Si la demo falla, la lección se publica solo con el texto.

*Por qué.* Explorar para construir intuición, como las demos de Brilliant o Khan. Practicar es otra cosa y para eso están las sesiones.

*Límites.* No todas las lecciones la tienen; en comprensión lectora se omite a propósito. Nadie valida su calidad. El alto es fijo.

`packages/convex/src/lessons.ts`; `apps/web/src/lib/demo-document.ts`

#### Práctica por subtema desde Temario, Ruta y lección ✅

*Lo que ve el estudiante.* Con un toque en «Practicar» empieza una sesión de 10 preguntas de ese subtema, sin reloj. Si algo falla, «No se pudo iniciar la práctica».

*Cómo funciona.* Ver [Práctica por tema y por subtema](#practica-tema).

#### Entradas a la lección desde otras pantallas ✅

*Lo que ve el estudiante.* Llega a una lección desde la revisión de una sesión («Repasar este concepto» en cada pregunta), desde los subtemas débiles de Progreso, desde el resultado de la nivelación y desde el plan del día. En el plan aparece, por ejemplo, «Lección: Probabilidad y conteo · Primero la idea…» cuando ese subtema es el que más puntos puede dar y el estudiante está en Sin empezar o Intentado.

#### Generar preguntas similares con IA 🗺️

*Lo que ve el estudiante.* Hoy nada. El botón «Generar más práctica con IA» que tenía la lección ya no existe.

*Cómo funciona.* La función existe en el backend, pero solo la puede ejecutar un operador. Ver [Preguntas generadas por IA](#preguntas-ia).

*Por qué se apagó.* El modelo da por buenas sus propias respuestas sin verificación y las preguntas entran al banco que comparten todos. Su regreso depende del banco original con revisión (Fase 17).

---

<a id="practicar"></a>
### 2.4 Practicar: tipos de sesión, selección, repaso, constructor, reto, confianza y tutor

#### Ocho tipos de sesión, una sola maquinaria ✅

*Lo que ve el estudiante.* Todo lo que se resuelve es una "sesión" con la misma pantalla de resolver y la misma de revisión. Hay 8 tipos:

| Tipo | Preguntas | Reloj | Retroalimentación inmediata posible |
|---|---|---|---|
| Diagnóstico inicial (antiguo, ya no se lanza) | 20 (4 por área) | No | No |
| Nivelación | 15 de un área | 30 min | No |
| Práctica recomendada | 10 | No | Sí (por defecto) |
| Práctica por tema | 10 | No | Sí (por defecto) |
| Repaso espaciado | 2 por tema vencido, hasta 10 (hasta 30 si viene de "Repetir las que fallé") | No | Sí (por defecto) |
| Práctica a tu medida | 5 a 30 | Opcional | Sí (por defecto) |
| Simulacro | 120 (Sesión 1), 134 (Sesión 2) o el total de un área | 4 h 30 por sesión, o al ritmo oficial por área | No |
| Reto de dominio | 6 | No | No |

*Cómo funciona.* Un solo archivo configura cada tipo: cantidad, cómo elige las preguntas, de qué grupo del banco, reloj, si exige nivelación y si admite retroalimentación inmediata. La práctica recomendada, la de tema y el repaso tienen tutor socrático durante la resolución (solo pistas antes de comprobar); los exámenes y el reto no. Si ya hay una sesión igual en curso (mismo tipo, área, subtema y modo), se reutiliza; la práctica a tu medida nunca se reutiliza.

*Por qué.* Una sola maquinaria evita duplicar lógica. Ajustar un tipo es editar una línea.

*Límites.* Si el banco no alcanza, la sesión sale más corta que lo configurado.

`packages/convex/src/sessionKinds.ts`; `packages/convex/src/sessions.ts`

#### El hub de práctica ✅

*Lo que ve el estudiante.* En `/practice`, «¿Qué quieres practicar hoy?» con tarjetas en este orden: Nivelación, Práctica recomendada, Práctica por tema, Arma tu práctica, Simulacro de examen, Repaso espaciado y Reto de dominio. Las que piden elegir algo se despliegan; las demás arrancan con un toque. Debajo, el aviso «Día de examen: te falta la Sesión 2» si aplica, las sesiones en curso con «Continuar» y un enlace al historial.

*Cómo funciona.* Las sesiones cronometradas pasan por la intro. El reto se deshabilita con «Se abre cuando hayas practicado al menos 3 subtemas» hasta que haya 3 subtemas practicados.

*Límites.* La recomendada, la de tema y el repaso corrigen al momento por defecto (F31). La tarjeta de Repaso dice cuántos temas vencen y se bloquea sin ninguno.

`apps/web/src/routes/practice.tsx`

#### Práctica recomendada ✅

*Lo que ve el estudiante.* Un toque arma 10 preguntas nuevas enfocadas en lo más débil. Si su subtema más flojo es «Funciones y gráficas», las primeras salen de ahí; luego vienen preguntas de refuerzo de áreas medias y algunas de su área fuerte para ganar confianza.

*Cómo funciona.* Solo usa preguntas que el estudiante nunca ha visto. Llena en cuatro pasos hasta 10: subtemas más débiles primero, luego áreas intermedias, luego de la más fuerte a la más débil, y al final cualquier pregunta elegible. Dentro de cada paso ordena por dificultad adecuada (ver Elo abajo). Cada pregunta guarda la razón por la que se eligió, para poder auditarla.

*Por qué.* La especificación pide recomendaciones por reglas e inspeccionables, no un modelo de IA. Mezclar debilidad, refuerzo y confianza evita desanimar.

*Límites.* Lee todo el banco cada vez, lo que escala mal con un banco grande. Cuando el estudiante ya vio todo, la sesión sale corta o falla.

`packages/convex/src/sessions.ts`

<a id="practica-tema"></a>
#### Práctica por tema y por subtema ✅

*Lo que ve el estudiante.* Desde el hub elige un área y recibe 10 preguntas sin reloj. Desde el Temario, la lección, la Ruta, el resultado de la nivelación o el reporte del simulacro, «Practicar» lanza 10 preguntas de un subtema.

*Cómo funciona.* Pone primero las preguntas no vistas y luego las vistas, ordenadas por dificultad adecuada. Los textos compartidos entran completos.

*Límites.* Siempre 10. Si el subtema tiene pocas preguntas, sale corta y repite vistas. Puede subir el subtema hasta Competente, nunca a Dominado.

`packages/convex/src/sessions.ts`; `apps/web/src/components/PracticeSubtopicButton.tsx`

#### Elo: dificultad calibrada y práctica a la medida ✅

*Lo que ve el estudiante.* No ve números. Lo nota en que la práctica le sirve primero preguntas ni muy fáciles ni muy difíciles para él, en la etiqueta «· calibrado» junto a su nivel y en el filtro Básico, Medio y Avanzado del constructor.

*Cómo funciona.* Cada pregunta tiene una dificultad y cada estudiante una habilidad por área, ambas empiezan en 1200, como en el ajedrez. Con esos dos números se calcula la probabilidad de acierto. Al entregar una sesión, si acertó una pregunta "difícil" su habilidad sube mucho y la pregunta se vuelve un poco más fácil; si falló una "fácil", pasa lo contrario. El ajuste es grande al principio y se hace más pequeño con la evidencia. Se calibra una sola vez por sesión, al entregar, no en cada respuesta. La práctica recomendada y la de tema ordenan las preguntas para que la probabilidad de acierto quede cerca del 70 % (dentro de cada paso de la recomendada, y por separado entre no vistas y vistas en la de tema). Una pregunta o un área sin calificación cuentan como 1200; a igual distancia del 70 % se conserva el orden del banco. Ese orden adaptativo nunca se aplica en nivelación ni simulacro, porque ahí se mide. La calibración, en cambio, sí corre al entregar cualquier sesión, nivelación y simulacro incluidos.

*Por qué.* El porcentaje de aciertos mezcla "el estudiante es débil" con "le tocaron preguntas difíciles"; el Elo separa ambas cosas. Practicar con un 70 % de acierto esperado es la idea de práctica adaptativa de Khan y UWorld.

*Límites.* La calibración ya existía (Fase 13); la Fase 16 añadió el orden adaptativo. El constructor y el repaso no lo usan. Con pocos usuarios y un banco pequeño, casi todas las dificultades siguen cerca de 1200, así que al principio la adaptación es débil.

`packages/convex/src/elo.ts`; `packages/convex/src/adaptive.ts`

#### Repaso espaciado ✅

*Lo que ve el estudiante.* La tarjeta «Repaso espaciado» (y la tarea de Hoy «3 temas tocan repaso hoy: vuelven con preguntas nuevas») arma 2 preguntas por tema vencido, hasta 10. Son preguntas hermanas que no ha visto, del mismo tema y, si están etiquetadas, de la misma competencia.

*Cómo funciona.* Cajas de Leitner por subtema (F34): una sesión que acierta todo un subtema lo sube de caja (vuelve en 1, 3, 7, 21 o 60 días); un error lo devuelve a la primera, para el día siguiente. Primero salen los temas con un error de concepto reciente, luego la caja más baja, luego el más vencido. La pregunta original fallada vuelve solo si el tema no tiene nada nuevo. Hoy, el hub y el plan cuentan temas vencidos con la misma regla.

*Por qué.* Volver sobre los errores hasta corregirlos, empezando por los que el estudiante no revisaría solo: los que creía saber.

*Límites.* Los intervalos son fijos, no ajustados por estudiante.

`packages/convex/src/sessions.ts`; `packages/convex/src/confidence.ts`

#### Repetir las que fallé ✅

*Lo que ve el estudiante.* En la revisión de cualquier sesión con al menos un fallo o una en blanco aparece «Repetir las que fallé», que arma un repaso solo con esas preguntas, en el mismo orden.

*Cómo funciona.* Verifica que la sesión de origen sea del estudiante y esté entregada («Termina esa sesión antes de reintentar sus incorrectas.»). Toma las incorrectas y en blanco que sigan usables, con tope de 30, y deja fuera las que estén en un examen o reto en curso. Si no hay ninguna: «No fallaste ninguna pregunta en esa sesión.». Si todas están en un examen en curso: «Esas preguntas están en un examen o reto que tienes en curso. Termínalo primero.». Si ya hay un repaso abierto de esa misma sesión, lo retoma.

*Por qué.* Cerrar el ciclo error, reintento, como el "Retry incorrect" de Khan y UWorld.

*Límites.* Tope de 30 preguntas: en un simulacro con más fallos, el resto se pierde. Como ya vio las claves, este repaso no mueve los niveles de maestría.

`packages/convex/src/sessions.ts`; `apps/web/src/routes/practice.$sessionId.review.tsx`

#### Arma tu práctica (constructor) ✅

*Lo que ve el estudiante.* En el hub, junto a Práctica por tema, la tarjeta se despliega con chips: Área (todas o una), Subtemas (al elegir un área), Preguntas (Todas, No vistas, Falladas, Marcadas), Cuántas (5, 10, 20 o 30), Reloj (sin o con) y Respuestas (Inmediata o Al final). Muestra en vivo «N preguntas disponibles» y explica por qué no puede empezar si algo no cuadra. Ejemplo: Matemáticas, Falladas, 10, con reloj (23 min), Inmediata. (El selector de dificultad se quitó en F33: elegir «fácil» daba ilusión de dominio, y el Elo ya ajusta.)

*Cómo funciona.* La dificultad se reparte en tercios, de más fácil a más difícil, calculados solo sobre las preguntas del banco elegido que ya tienen calificación Elo. Las que no la tienen cuentan como Medio. "No vistas" excluye cualquier pregunta que se le haya mostrado, aunque no la respondiera. "Falladas" son las que tienen el último intento incorrecto en una sesión entregada y "Marcadas" las que tiene marcadas con bandera en alguna sesión. Sirve primero las no vistas y mantiene completos los textos compartidos. Con reloj, cada pregunta da 2 min 15 s. Por defecto: 10 preguntas, sin reloj, respuestas inmediatas. Cada vez crea una sesión nueva; nunca retoma una anterior.

*Por qué.* Es el constructor de prácticas de UWorld y Magoosh: el estudiante decide qué practicar. Por defecto es inmediata porque una práctica que uno arma es para aprender.

*Límites.* Si hay menos preguntas que las pedidas, no deja empezar. La dificultad es relativa al alcance elegido, no absoluta. Con reloj arranca sin la intro cronometrada. Con las fuentes Falladas o Marcadas no mueve la maestría.

`packages/convex/src/practiceBuilder.ts`; `apps/web/src/components/PracticeBuilder.tsx`

#### Retroalimentación inmediata: «Comprobar» ✅

*Lo que ve el estudiante.* En una práctica con respuestas inmediatas, tras elegir aparece «Comprobar». Al tocarlo ve «Correcta» o «Incorrecta · La respuesta es la C.», «Por qué la B parece correcta» (la que eligió), la «Explicación» y un desplegable «Por qué no son las otras opciones». Luego «Siguiente» o «Terminar». Esa respuesta queda bloqueada («Ya revisaste esta respuesta; no se puede cambiar.»). Si la pregunta no tiene explicación escrita, dice «Esta pregunta todavía no tiene una explicación escrita.»; si la escribió la IA, «Explicación escrita con IA.».

*Cómo funciona.* Solo se acepta en práctica recomendada, por tema, repaso y a tu medida. El servidor lo rechaza en nivelación, simulacro, diagnóstico y reto aunque alguien manipule la app («Esta sesión muestra las respuestas solo al final.»). Al comprobar, revela la clave solo de esa pregunta. También se niega si esa pregunta está en un examen o un reto abierto del estudiante, con o sin reloj: «Esta pregunta está en un examen o reto que tienes en curso. La verás al terminarlo.».

*Por qué.* Es el "modo tutor" de UWorld y Khan, para aprender pregunta a pregunta sin romper la integridad de los exámenes.

*Límites.* Desde la interfaz solo se elige en el constructor. El tutor de IA no está disponible al comprobar; llega en la revisión. Una práctica con respuestas inmediatas nunca lleva un subtema a Dominado.

`packages/convex/src/sessions.ts`; `packages/convex/src/sessionIntegrity.ts`; `apps/web/src/components/AnswerFeedback.tsx`

#### Reto de dominio ✅

*Lo que ve el estudiante.* La tarjeta «Reto de dominio»: «2 preguntas de cada uno de 3 subtemas que ya practicaste. Si aciertas ambas, ese subtema sube de nivel; si fallas ambas, baja.». Mezcladas, sin reloj y sin retroalimentación inmediata. Mientras no haya practicado 3 subtemas, la tarjeta está apagada con «Se abre cuando hayas practicado al menos 3 subtemas.».

*Cómo funciona.* Considera solo subtemas practicados. Prefiere los que están en Familiar o Competente, que son los que tienen un nivel por ganar, y dentro de cada grupo los revisados hace más tiempo. Toma los 3 primeros que tengan 2 preguntas que el estudiante nunca haya visto (una vista ya mostró su clave en la revisión) y las intercala, con los textos compartidos juntos. Si no hay 3, sale «Practica al menos tres subtemas antes del reto de dominio.». Mientras está abierto, sus preguntas quedan selladas en cualquier otra sesión, como en un examen.

*Por qué.* Es el "Mastery Challenge" de Khan: la forma de llegar a Dominado y de detectar el olvido con evidencia mezclada.

*Límites.* El hub y Hoy lo ofrecen con 3 subtemas practicados aunque no queden 2 preguntas sin ver en cada uno, y entonces falla al lanzarse. Con el banco pequeño eso pasa pronto. No tiene enfriamiento: se puede repetir de inmediato (Khan espera 12 h). Vive en Práctica y en el plan del día, no en la Ruta.

`packages/convex/src/sessions.ts`; `packages/convex/src/mastery.ts`

<a id="confianza"></a>
#### Confianza declarada: Seguro, Dudé, Adiviné ✅

*Lo que ve el estudiante.* Al elegir una respuesta aparece «¿Qué tan seguro estás?» con tres chips: Seguro («Sé por qué esta es la respuesta»), Dudé y Adiviné («Marcar esto no baja tu puntaje»). Es opcional. Si cambia de opción, la declaración se borra.

*Cómo funciona.* Cruzando confianza y resultado salen cuatro estados: Dominado (seguro y acertó), Frágil (acertó sin estar seguro), Error de concepto (seguro y falló) y Por aprender (dudó o adivinó y falló). Esto tiene efectos reales: ordena el repaso (los errores de concepto vuelven primero) y alimenta el tablero de confianza en Progreso y en el reporte del simulacro.

*Por qué.* Un acierto y una adivinanza con suerte se ven iguales en los datos. El error confiado es el único que el estudiante nunca corregiría solo.

*Límites.* Depende de que el estudiante declare. No afecta el puntaje. Desaparece tras «Comprobar».

`packages/convex/src/confidence.ts`; `apps/web/src/components/SessionSolve.tsx`

#### El tutor de IA en la revisión ✅

*Lo que ve el estudiante.* En la revisión de una sesión entregada hay un panel «Tutor»: a la derecha en computador (se puede ensanchar y plegar) y como hoja inferior con botón flotante en el teléfono. Trae sugerencias: «Explícame la respuesta», «Dame un problema similar», «¿Qué debo repasar?». Cada mensaje lleva como contexto la pregunta en pantalla. Puede detener la respuesta, borrar la conversación y abrir «Ver demostración interactiva» cuando el tutor crea una. Si pregunta por qué falló, el tutor explica primero por qué su opción parecía correcta y luego la buena.

*Cómo funciona.* Hay una conversación por sesión. El tutor tutea, responde en 3 a 6 frases y tiene reglas de fiabilidad: la clave es del ICFES, debe decir si la cree discutible, no inventar fuera del contexto y decir «no estoy seguro» cuando no lo está. Recibe el área, el subtema, el texto compartido, el enunciado, las opciones y, con la sesión entregada, la respuesta del estudiante, la clave y la explicación. Si la pregunta quedó sin responder, no revela la clave y guía con pistas. Puede crear una página interactiva por respuesta, que se muestra aislada. Usa DeepSeek v4 flash.

*Por qué.* La especificación del tutor: ayuda en práctica y revisión, nunca mientras se mide.

*Límites.* Nunca durante la resolución. Cerrado en todas las sesiones mientras el estudiante tenga un examen cronometrado en curso («El tutor vuelve cuando termines el examen que tienes en curso»). No ve imágenes, solo texto. Solo conoce la pregunta en pantalla, no el resto de la sesión.

`packages/convex/src/tutor.ts`; `apps/web/src/components/ReviewTutor.tsx`

#### Límite diario del tutor ✅

*Lo que ve el estudiante.* Hasta 80 mensajes al tutor por día (día de Colombia). Al pasarse: «Llegaste al límite de mensajes del tutor por hoy. Mañana puedes seguir preguntando.». Los mensajes de más de 4000 caracteres se rechazan. Si el servidor rechaza un mensaje, el borrador vuelve al cuadro de texto.

*Cómo funciona.* Un contador por estudiante, día y función. Se cobra después de validar todo (un rechazo no gasta) y antes de llamar al modelo. Dos mensajes simultáneos no pueden gastar la última unidad.

*Por qué.* Registrarse es gratis y cada llamada cuesta. También evita usar el tutor para resolver un examen en curso desde otra pestaña.

*Límites.* Solo el tutor tiene límite. Es igual para todos.

`packages/convex/src/llmBudget.ts`

---

<a id="resolver"></a>
### 2.5 La pantalla de resolver y las herramientas de examen

Esta pantalla es la misma para todos los tipos de sesión. Casi todas sus herramientas vienen de Bluebook, la app del SAT digital, traducidas al examen en papel del Saber 11.

#### Una sola pantalla de resolver ✅

*Lo que ve el estudiante.* Una pregunta a la vez. Arriba, el tipo de sesión, el área, «7 / 15» y una barra de avance. En medio, opciones A a D grandes. Abajo, Anterior, el mapa («respondidas/total»), Marcar y Siguiente (en la última, «Revisar»). Con teclado: A a D responde, flechas navegan, F marca. Tocar otra vez la opción elegida la borra. Si cierra y vuelve, cae en la primera pregunta en blanco, no en la 1.

*Cómo funciona.* La pantalla nunca recibe la clave mientras la sesión está abierta. Al cambiar de pregunta, todo vuelve arriba. Al entregar va a la revisión (o al descanso, si es la Sesión 1 del examen completo). Si no hay preguntas: «No pudimos armar esta sesión».

*Por qué.* Resolver y revisar son pantallas separadas (decisión registrada en el ADR 0001), y resolver nunca muestra la clave, como el examen real.

*Límites.* Los atajos se apagan con el mapa o un formulario abiertos.

`apps/web/src/components/SessionSolve.tsx`

#### Reloj ocultable, aviso de 5 minutos y entrega automática ✅

*Lo que ve el estudiante.* En sesiones cronometradas, una cuenta regresiva; en las libres, un cronómetro atenuado. Tocando el reloj lo esconde y la preferencia se recuerda. A los 5 minutos finales el reloj reaparece a la fuerza, sale «Quedan 5 minutos. No dejes preguntas en blanco: adivinar puede sumar» (se cierra solo a los 8 segundos) y el teléfono vibra. En el último minuto el reloj se pone en alerta. Al llegar a cero, la sesión se entrega sola.

*Cómo funciona.* El reloj se recalcula cada segundo contra la hora de vencimiento guardada en el servidor, así que sobrevive recargas. Al vencer, intenta enviar lo pendiente durante 8 segundos y entrega.

*Por qué.* Es el "quedan 5 minutos" del jurado del examen. Ocultar el reloj baja la ansiedad, como en Bluebook.

*Límites.* No hay aviso a los 30 minutos.

`apps/web/src/lib/useSessionTimer.ts`

#### Aviso al salir y «Esta sesión venció» ✅

*Lo que ve el estudiante.* Si intenta salir de un examen cronometrado, la app pregunta: «El reloj sigue corriendo aunque salgas: te quedan 1:23:45. Puedes volver y seguir mientras quede tiempo. ¿Salir de todas formas?». Las sesiones sin reloj se dejan libremente. Si vuelve más de 5 minutos después del vencimiento, ve «Esta sesión venció: se le acabó el tiempo mientras no estabas, así que no la calificamos» y «Elegir una nueva sesión».

*Cómo funciona.* La siguiente vez que el estudiante crea una sesión, las vencidas pasan a "abandonada" y dejan de ofrecerse para retomar.

*Por qué.* Evita que 2 respuestas de 15 se vuelvan la nivelación de alguien que se fue a mitad.

*Límites.* Cerrar la pestaña o recargar no muestra aviso.

`apps/web/src/components/SessionSolve.tsx`; `apps/web/src/lib/solve-state.ts`

#### Marcar para revisar ✅

*Lo que ve el estudiante.* Con la bandera (o la tecla F) marca una pregunta para volver a ella, respondida o no. Las marcadas salen con bandera en el mapa y en «Revisa antes de entregar». Después, en la revisión, aparecen como marcadas; el reporte del simulacro cuenta «N para revisar · M terminaron mal»; y el constructor permite practicar solo las marcadas.

*Cómo funciona.* La marca sobrevive a borrar la respuesta.

*Por qué.* Equivale a encerrar el número en el cuadernillo de papel.

`packages/convex/src/sessions.ts`

#### Tachar opciones ✅

*Lo que ve el estudiante.* Junto a cada opción hay un botón para tacharla. En el teléfono también puede mantenerla presionada medio segundo, con una vibración corta. Si tacha la opción elegida, su respuesta se borra; si elige una tachada, se destacha.

*Por qué.* Es el tachón a lápiz del examen en papel.

*Límites.* No se puede tachar en una pregunta ya comprobada ni con la sesión cerrada.

`packages/convex/src/sessions.ts`; `apps/web/src/components/SessionSolve.tsx`

#### Mapa de preguntas ✅

*Lo que ve el estudiante.* El botón con cuadrícula muestra «8/15» y abre una hoja con todas las preguntas como casillas: respondida, sin responder, marcada y actual, con el resumen «8 de 15 respondidas · 2 marcadas». Tocar una casilla lleva a esa pregunta. Las preguntas que comparten texto aparecen agrupadas; el rótulo «Preguntas 12 a 15: mismo texto» solo lo leen los lectores de pantalla, no se ve. Abajo, «Revisar y entregar».

*Por qué.* Es el mapa del cuadernillo y la vista de preguntas de Bluebook.

`apps/web/src/components/QuestionNavigator.tsx`

#### Revisa antes de entregar ✅

*Lo que ve el estudiante.* Un paso intermedio: «Respondiste 13 de 15», la lista de las que están en blanco («2 sin responder: una respuesta en blanco no suma nada; adivinar sí puede sumar»), las marcadas, cada una con salto directo, y la advertencia «Al entregar ya no podrás cambiar tus respuestas». Botones «Volver» y «Entregar».

*Cómo funciona.* Al entregar espera hasta 20 segundos a que se envíe lo pendiente. Luego el servidor califica, calibra el Elo, recalcula el progreso y mueve los niveles de maestría.

*Por qué.* En el examen real nada te avisa lo que dejaste en blanco. Aquí entregar es un segundo gesto deliberado.

*Límites.* Se puede entregar con preguntas en blanco sin confirmación extra.

`apps/web/src/components/CheckYourWork.tsx`

#### Chip de ritmo: ¿voy a tiempo? ✅

*Lo que ve el estudiante.* En sesiones cronometradas, con el reloj visible, aparece «A tiempo», «Adelantado · 3» o «Atrasado · 2» (preguntas por delante o por detrás del ritmo oficial).

*Cómo funciona.* Ritmo oficial: Sesión 1, 4 h 30 entre 120 = 135 s por pregunta; Sesión 2, 4 h 30 entre 134 ≈ 121 s; nivelación, 30 min entre 15 = 120 s; lo demás, 135 s. Compara las respondidas con las que "debería" llevar a esa hora. Una pregunta de diferencia cuenta como a tiempo, para que no parpadee.

*Por qué.* Quedarse sin tiempo con preguntas en blanco cuesta más que cualquier pregunta difícil.

*Límites.* No aparece sin reloj ni con el reloj oculto.

`packages/convex/src/pacing.ts`

#### Tiempo real por pregunta ✅

*Lo que ve el estudiante.* No lo ve mientras resuelve. La app suma el tiempo de todas sus visitas a cada pregunta y lo muestra después en la revisión y en el reporte del simulacro.

*Cómo funciona.* Ignora visitas de menos de 1 segundo y cada visita tiene un tope de 15 minutos.

*Límites.* Se envía una vez, sin reintentos: si se cae la conexión, ese tiempo se pierde.

`apps/web/src/components/SessionSolve.tsx`; `packages/convex/src/sessions.ts`

#### Tamaño de texto ✅

*Lo que ve el estudiante.* Dos botones, A- y A+, cambian el texto en 5 pasos: 90 %, 100 %, 115 %, 130 % y 150 %. Se recuerda en ese dispositivo.

*Límites.* Si el enunciado es la imagen escaneada del cuadernillo, la imagen no cambia de tamaño.

`apps/web/src/lib/solve-state.ts`

#### Respuestas que no se pierden sin señal ✅

*Lo que ve el estudiante.* Si se cae el internet, la opción queda marcada de inmediato y aparece «Sin conexión · tus respuestas se guardan». Al volver la señal, todo se envía solo, incluso si recargó la página. Si el servidor rechaza un cambio a propósito, ve el mensaje del servidor, por ejemplo «Se acabó el tiempo de esta sesión.». Si el cambio se pierde tras agotar los reintentos por fallos de red, ve «No se pudo guardar un cambio. Revisa esa pregunta.».

*Cómo funciona.* Respuestas, borrados, marcas y tachones van a una cola guardada en el navegador. Se reintenta con esperas crecientes (1, 2, 4, 8, 16 segundos, hasta 30) hasta 6 veces. Un rechazo deliberado del servidor no se reintenta. La pantalla muestra lo pendiente encima de lo que dice el servidor.

*Por qué.* La mayoría estudia en celular con datos intermitentes. Antes, una recarga perdía la respuesta.

*Límites.* Si la cola no se vacía antes de entregar, la entrega sigue igual.

`apps/web/src/lib/answer-queue.ts`; `apps/web/src/lib/useAnswerQueue.ts`

<a id="reportar"></a>
#### Reportar un problema con una pregunta ✅

*Lo que ve el estudiante.* Debajo de cada pregunta, incluso en un examen, está «Reportar un problema». Abre una hoja con 4 motivos redactados para quien no ve la clave: «Ninguna opción sirve, o sirve más de una», «El enunciado es confuso o le falta información», «No se lee la imagen o el texto» y «Otro problema», más una nota opcional de hasta 500 caracteres. Al enviar: «Gracias. Ya quedó registrado». En la revisión hay un formulario equivalente con motivos como «La respuesta correcta está mal».

*Cómo funciona.* Un reporte abierto por estudiante y pregunta: repetirlo lo actualiza. Máximo 20 reportes nuevos por estudiante por día. Un administrador puede listarlos y cerrarlos, pero solo por consola.

*Por qué.* El banco viene de OCR y de IA; los estudiantes que leen cada pregunta son los correctores más baratos, como en Khan Academy. Se permite en el examen porque reportar no revela nada.

*Límites.* No hay pantalla de administración para verlos. Reportar no corrige nada solo ni avisa al estudiante cuando se resuelve.

`packages/convex/src/questionReports.ts`; `apps/web/src/components/ReportProblemSheet.tsx`

#### Enunciado como lo imprime el ICFES y texto compartido ✅

*Lo que ve el estudiante.* Las preguntas de cuadernillo se ven como la imagen escaneada del enunciado, con su figura. Si varias preguntas comparten un texto, la pantalla se divide: el texto a un lado (arriba en el teléfono) y la pregunta al otro, con «Pregunta 2 de 4 de este texto».

*Cómo funciona.* El texto de la pregunta sigue en la página, oculto a la vista, para lectores de pantalla, búsqueda y el tutor. Ver [Preguntas mostradas como las imprime el ICFES](#recortes).

`apps/web/src/components/SharedStimulus.tsx`

---

<a id="examenes"></a>
### 2.6 Exámenes y resultados: niveles ICFES, simulacros, reportes y revisión

La nivelación y su resultado están en [2.1](#entrada). Aquí van los cortes oficiales, los simulacros, sus reportes y la revisión.

<a id="niveles-icfes"></a>
#### Niveles ICFES oficiales ✅

*Lo que ve el estudiante.* Cada área muestra un nivel, una barra de 4 segmentos y un descriptor en segunda persona. Un 55/100 en Matemáticas es Nivel 3 («Modelas situaciones con expresiones y gráficas…») y le faltan 16 puntos para el Nivel 4. En Inglés la escala es Pre A1, A1, A2 y B1.

*Cómo funciona.* Los cortes, sobre 0 a 100, viven en un archivo de datos verificado contra las hojas oficiales publicadas por el ICFES el 22 de septiembre de 2025:

| Área | Nivel 1 | Nivel 2 | Nivel 3 | Nivel 4 |
|---|---|---|---|---|
| Lectura Crítica | 0-35 | 36-50 | 51-65 | 66-100 |
| Matemáticas | 0-35 | 36-50 | 51-70 | 71-100 |
| Ciencias Naturales | 0-40 | 41-55 | 56-70 | 71-100 |
| Sociales y Ciudadanas | 0-40 | 41-55 | 56-70 | 71-100 |
| Inglés | Pre A1: 0-36 | A1: 37-57 | A2: 58-70 | B1: 71-100 |

Con menos de 12 respuestas en un área no se afirma ningún nivel. Un test fija los cinco cortes para que nadie los cambie por accidente.

*Por qué.* Estudiantes, familias y colegios hablan en niveles de desempeño del ICFES. Usar los cortes oficiales hace comparable lo que ven. Están en un archivo de datos para corregirlos sin tocar código. Inglés estaba mal (tenía cinco bandas inventadas, incluida una "B+" que no existe en Saber 11) y se corrigió en la Fase 12.

*Límites.* El paso de precisión a puntaje es directo, sin el método estadístico del ICFES. Los descriptores están reescritos para el estudiante a partir de los oficiales. Hay que volver a verificarlos cuando el ICFES publique hojas nuevas.

`docs/levels.v1.json`; `packages/convex/src/levels.ts`

#### Simulacro completo: Sesión 1 y Sesión 2 ✅

*Lo que ve el estudiante.* En Práctica, la tarjeta «Simulacro de examen» («254 preguntas en 2 sesiones») ofrece «Sesión 1 · 120 preguntas · 4 h 30 min» (al terminarla, el descanso y la Sesión 2) y «Sesión 2 · 134 preguntas · 4 h 30 min». Antes del reloj, la intro con las reglas. Durante el examen no hay tutor ni respuestas, pero sí todas las herramientas de examen.

*Cómo funciona.* Distribución oficial:

| | Lectura Crítica | Matemáticas | Ciencias Naturales | Sociales | Inglés | Total |
|---|---|---|---|---|---|---|
| Sesión 1 | 41 | 25 | 29 | 25 | 0 | 120 |
| Sesión 2 | 0 | 25 | 29 | 25 | 55 | 134 |

Cada sesión dura 4 h 30. Usa todo el banco aprobado (los grupos `diagnostic` y `practice_only`). Mientras corre, esas preguntas quedan selladas en cualquier otra sesión del estudiante y el tutor está cerrado.

*Por qué.* Imita el Saber 11 real, dos sesiones de 4 h 30 el mismo día con forma fija, como los simulacros de Bluebook: practicar resistencia y manejo del tiempo, no solo contenido.

*Límites.* El banco es pequeño. Matemáticas tiene unas 44 preguntas usables contra las 25 + 25 que pide el examen, así que la Sesión 2 sale corta hasta que crezca el banco. Inglés tiene 0 preguntas. No hay simulacro adaptativo, a propósito. No hay versión imprimible (Fase 17).

`packages/convex/src/sessionKinds.ts`; `packages/convex/src/pacing.ts`

#### Cómo se arma el simulacro ✅

*Lo que ve el estudiante.* Cada vez le salen primero preguntas que nunca ha visto, y la Sesión 2 no repite ninguna de su Sesión 1. Dos estudiantes, o dos intentos del mismo, reciben formularios distintos. Los textos compartidos salen completos y seguidos.

*Cómo funciona.* Ordena las preguntas (o grupos) por cuándo las vio por última vez; las nunca vistas van primero. "Vista" significa mostrada, no respondida, porque la revisión revela todas las claves. Desempata con un sorteo que depende del estudiante y del número de intento. Llena cada área hasta su cupo; un grupo que no cabe se salta entero. Presenta todo en orden de cuadernillo.

*Por qué.* Antes todos recibían las primeras N preguntas del banco: el mismo formulario para todos, la Sesión 2 repetía la 1 y repetir un simulacro era volver a uno ya revisado con las respuestas.

*Límites.* Con un banco pequeño, tras pocos intentos vuelven preguntas ya vistas (las más antiguas primero).

`packages/convex/src/simulacroForm.ts`

#### Día de examen: Sesión 1, descanso, Sesión 2 ✅

*Lo que ve el estudiante.* Si eligió el día completo, al entregar la Sesión 1 no ve resultados. Ve «Descanso»: «Terminaste la Sesión 1. En el examen real sales y vuelves a la 1:30 p. m.: come algo, toma agua y vuelve cuando estés listo», con «134 preguntas · 4 h 30 min» y los botones «Empezar la Sesión 2» o «Más tarde». Si elige más tarde, el hub le recuerda: «Día de examen: te falta la Sesión 2 · 134 preguntas · 4 h 30 min · el reloj empieza al tocar».

*Cómo funciona.* Las dos sesiones no están enlazadas en los datos: un examen es una Sesión 1 más la Sesión 2 que se empezó después de ella y antes de la siguiente Sesión 1.

*Por qué.* Traduce la pausa entre módulos de Bluebook al formato del Saber 11.

*Límites.* El descanso no tiene reloj. La Sesión 2 suelta, sin una Sesión 1 antes, queda como examen incompleto. Desde el descanso no se muestra otra intro.

`apps/web/src/components/ExamBreak.tsx`; `apps/web/src/lib/exam-day.ts`

#### Simulacro por área ✅

*Lo que ve el estudiante.* En «Por área» elige un área, por ejemplo «Matemáticas · 50 preguntas · 1 h 53 min», y presenta el total oficial de esa área (sumando las dos sesiones) en una sola sentada al ritmo oficial. Al final, «Tu resultado en Matemáticas».

*Cómo funciona.* Cada pregunta da 2 min 15 s: Lectura Crítica 41 preguntas (unos 92 min), Matemáticas 50 (112,5 min), Ciencias Naturales 58 (130,5 min), Sociales 50 (112,5 min), Inglés 55 (unos 124 min). Se compara con el simulacro anterior de la misma área.

*Por qué.* Una opción más corta para practicar el tiempo en un área con el ritmo real.

*Límites.* Nunca da puntaje global. Inglés y Lectura en una sola sentada no reflejan cómo se reparten en el examen real.

`packages/convex/src/sessionKinds.ts`

#### Reporte del simulacro ✅

*Lo que ve el estudiante.* «Tu reporte del simulacro». Si presentó las dos sesiones y el simulacro sirvió preguntas de las 5 áreas: «Puntaje global estimado», por ejemplo 312 / 500, «Rango probable: 290 a 334 (± 22)», una barra con el rango, el cambio frente al simulacro anterior y la nota «Estimado con tus respuestas en Aprendo, no es un puntaje oficial del ICFES». Si falta una sesión: «Te falta la Sesión 2 para calcular tu puntaje global de 0 a 500» con «Presentar la Sesión 2». Si falta un área, lo dice; como Inglés no tiene preguntas, hoy el reporte muestra «Este simulacro no incluyó Inglés, así que no hay puntaje global de 0 a 500.». Por área: nivel ICFES, «X de Y correctas · Z en blanco», puntaje sobre 100, cambio, ritmo («2:40 por pregunta · oficial 2:15» con su chip), marcadas («4 para revisar · 2 terminaron mal») y «Lo que más te costó». Luego «Practicar lo que fallaste», «Donde se te fue el tiempo» (las 5 preguntas que más superaron el ritmo, con enlace a cada una), el tablero de confianza y «Revisar la Sesión 1», «Revisar la Sesión 2» y «Siguiente simulacro».

*Cómo funciona.* Puntaje por área = aciertos sobre preguntas efectivamente servidas, por 100, sumando ambas sesiones. Divide por lo servido para no contar como error lo que el banco no pudo poner; las en blanco sí cuentan como error. El global usa la fórmula oficial (ver [Puntaje global](#global)). El ritmo se marca atrasado si supera el oficial en más de 10 %, adelantado si está más de 10 % por debajo.

*Por qué.* Imita el reporte de Bluebook más el "practica lo que fallaste" de Khan. El 0 a 500 es el número que usan familias, universidades y becas, y va con rango porque un estimado con 30 preguntas no vale lo mismo que uno con 250.

*Límites.* El 0 a 500 es una estimación lineal sobre el banco de Aprendo, no el puntaje del ICFES. Solo aparece con el examen completo y las 5 áreas servidas, así que hoy nunca aparece.

`apps/web/src/components/SimulacroReport.tsx`; `packages/convex/src/examReport.ts`

#### Revisión pregunta por pregunta ✅

*Lo que ve el estudiante.* Desde cualquier sesión entregada ve cada pregunta como la imprime el ICFES, con su área y subtema, «X/Y correctas», los puntajes por área y un mapa de colores (correcta, incorrecta, sin responder, con punto dorado si la marcó). En cada pregunta: la respuesta correcta, «Tu respuesta» si falló, las opciones que tachó («La tachaste»), chips «La dejaste en blanco» y «La marcaste para revisar», su tiempo frente al ritmo oficial (en rojo si se pasó), su estado de confianza (por ejemplo «Error de concepto»), «Repasar este concepto», «Reportar un problema» y el tutor al lado. Atajos: flechas para navegar, ⌘K para el tutor, ⌘\ para mostrarlo u ocultarlo. Desde una nivelación o un simulacro, la flecha atrás vuelve al resultado.

*Cómo funciona.* Solo se abre con la sesión entregada; si no, lleva a resolver. La clave, la explicación y la dificultad se revelan solo entonces, y nunca para una pregunta que el estudiante tenga en un examen o reto en curso.

*Por qué.* En el examen no hay ayuda; la revisión es donde se aprende, con todo el contexto de cómo respondió.

*Límites.* El ancho del tutor se recuerda solo en ese navegador. Las explicaciones de cada opción, el % por opción y «Repetir las que fallé» se describen abajo y en [2.4](#practicar).

`apps/web/src/routes/practice.$sessionId.review.tsx`

#### Explicación de todas las opciones ✅ (requiere que el dueño corra `backfillExplanations` para los cuadernillos)

*Lo que ve el estudiante.* Si eligió una opción incorrecta, ve primero «Por qué la C te pareció correcta», con el error de razonamiento de esa opción. Luego, plegadas, «Por qué la A no es», «Por qué la D no es» y al final la «Explicación» de la correcta. Si la escribió la IA: «Explicación generada con IA: si ves un error, repórtalo.». Lo mismo, en versión corta, aparece tras «Comprobar».

*Cómo funciona.* Cada opción incorrecta tiene su propia justificación, escrita en el enriquecimiento con instrucciones de explicar el error de razonamiento, no de repetir la respuesta. Las opciones sin justificación simplemente no aparecen. Para las preguntas de cuadernillo, que solo traen la letra, ver [Explicaciones para las preguntas de cuadernillo](#explicaciones).

*Por qué.* Khan y UWorld explican cada opción. La razón por la que la opción elegida parecía correcta es lo que más enseña.

*Límites.* Casi todo el banco son cuadernillos, que no tienen justificaciones hasta que el dueño corra el proceso de explicaciones. Nadie las revisa antes; dependen de los reportes.

`apps/web/src/lib/review-explanations.ts`

#### Qué eligieron los demás y tiempo mediano ✅ (requiere que el dueño corra `sessions:backfillQuestionAnswerStats`)

*Lo que ve el estudiante.* Bajo cada opción, una barrita con «38% la eligió» (verde para la correcta) y la línea «La respondieron 54 estudiantes. Tiempo mediano 1:48; el tuyo 2:30, más lento que la mayoría.». Con menos de 20 respuestas: «Aún pocos datos para mostrar qué eligieron los demás (7 de 20 respuestas).».

*Cómo funciona.* Cuenta una sola respuesta por estudiante: la primera que dio antes de ver la clave, en una sesión entregada. Una respuesta dada después de ver la clave (en una revisión o con «Comprobar») no cuenta, porque es memoria. Los conteos viven en una tabla de contadores (`questionAnswerStats`) que se actualiza al entregar cada sesión, así que la consulta lee una sola fila por pregunta. La mediana usa los primeros 200 tiempos. Solo muestra datos de preguntas que el estudiante ya vio en una sesión entregada, y nunca de una pregunta que tenga en un examen o reto en curso, porque la opción más elegida suele ser la clave. "Más rápido" o "más lento" significa más de 20 % por debajo o por encima de la mediana.

*Por qué.* Normaliza fallar una pregunta difícil ("el 60 % también cayó en la B") y deja ver claves malas, como en Khan y UWorld.

*Límites.* Con pocos usuarios, casi ninguna pregunta llega a 20 respuestas. Las sesiones entregadas antes de desplegar no están en los contadores hasta que se corra el relleno inicial (ver la sección 6).

`packages/convex/src/answerStats.ts`

---

<a id="progreso"></a>
### 2.7 Progreso y medición

#### Encabezado: cuánto he mejorado ✅

*Lo que ve el estudiante.* Lo primero en Progreso es su precisión general («62% precisión general») y un chip con la diferencia frente al diagnóstico («+8 pts»). El título cambia: «Vas mejorando» si subió 5 puntos o más, «Recuperemos el ritmo» si bajó 5 o más, «Sigue sumando práctica» si está en medio y «Tu punto de partida» si no hay con qué comparar. Sin ninguna sesión entregada, Nico dice «Todavía no puedo medir nada» con un botón «Nivelar un área».

*Por qué.* Progreso pasó de una foto a contar la mejora, al estilo de Khan.

*Límites.* El "antes" solo viene del diagnóstico antiguo de 20 preguntas. Un estudiante que entró por nivelación (todos los nuevos) siempre ve «Tu punto de partida», sin diferencia. Usa precisión cruda, no Elo.

`apps/web/src/components/StudentProgressPage.tsx`; `packages/convex/src/progress.ts`

#### Tarjetas de actividad ✅

*Lo que ve el estudiante.* Tres tarjetas: preguntas respondidas (por ejemplo 184), días de estudio (11) y «lo que más mejoró» («Matemáticas +12 pts»). Si nada mejoró frente al diagnóstico, la tercera muestra la precisión acumulada.

*Límites.* «Lo que más mejoró» depende del diagnóstico antiguo. Las preguntas y los días incluyen sesiones abiertas; los aciertos no.

#### Gráfico «Tu precisión en el tiempo» ✅

*Lo que ve el estudiante.* Una línea con la precisión de cada semana, la fecha de la primera y de la última semana y un chip con la diferencia. Con menos de dos semanas de práctica: «Practica en al menos dos semanas distintas para ver tu tendencia».

*Cómo funciona.* Solo usa respuestas de sesiones entregadas. Las semanas sin actividad no generan punto. Es un dibujo hecho a mano, sin librería.

*Límites.* Una semana de preguntas difíciles se ve como un bajón. No muestra valores por semana.

<a id="global"></a>
#### Puntaje global estimado de 0 a 500, con rango y meta ✅

*Lo que ve el estudiante.* La tarjeta «Tu puntaje global estimado» muestra, por ejemplo, «269 / 500», «Rango probable: 251 a 287 (± 18)», cuántas preguntas lo respaldan y una barra de 0 a 500 con el rango, su punto y su meta. Con «Ponerme una meta» escribe un número (sugerencia: 350) y ve «Meta 350 · te faltan 81» o «¡ya la alcanzaste!». También le dice dónde rinde más el esfuerzo: «Cada punto que subas en Matemáticas vale 1.15 puntos globales». Si falta medir alguna área: «Te faltan 2 áreas por medir», con sus nombres. Abajo aclara que no es un puntaje oficial del ICFES.

*Cómo funciona.* La fórmula es la oficial del ICFES: (3·Lectura + 3·Matemáticas + 3·Ciencias + 3·Sociales + 1·Inglés) / 13 × 5. Ejemplo: 60, 50, 55, 45 y 70 dan unos 269. Cada área entra solo con 12 respuestas o más; si falta cualquiera, no hay global (nunca rellena con ceros). El rango es un intervalo de confianza del 95 %: es más ancho cuantas menos preguntas haya. Con las 5 áreas en 60 y 12 respuestas cada una, el resultado es 300 ± 65; con 60 respuestas cada una, 300 ± 29. Un punto de un área principal vale unos 1,15 puntos globales; uno de Inglés, unos 0,38. El área recomendada es la que más puntos globales puede dar según lo que le falta.

*Por qué.* Es el número en el que hablan familias, universidades y becas. Mostrarlo con rango evita la falsa precisión.

*Límites.* Es una estimación sobre el banco de Aprendo, no validada contra resultados reales. La meta solo se puede poner cuando ya hay global (las 5 áreas con 12 respuestas). Hoy solo muestra el enlace «Ponerme una meta» cuando ya hay global; sin él, muestra «Aún no hay puntaje global» sin enlace. No se puede borrar la meta desde la app.

`packages/convex/src/globalScore.ts`; `apps/web/src/components/GlobalScoreCard.tsx`

<a id="nivel-area"></a>
#### Tu nivel ICFES por área ✅

*Lo que ve el estudiante.* Una fila por área con su emoji y color: el nivel («Nivel 3» o, en Inglés, «A2»), una barra de 4 segmentos con un contorno en el nivel de partida, «Te faltan 5 puntos para Nivel 4» (o «Estás en el nivel más alto de esta área»), «· calibrado» cuando el puntaje tiene en cuenta la dificultad real, y «¡Subiste de nivel!» si superó su nivel de partida. Sin evidencia: «Sin nivel aún · 7 preguntas respondidas» y un enlace «Nivelarme».

*Cómo funciona.* El puntaje del área usa el Elo si hay 12 respuestas o más; si no, la precisión cruda. El nivel de partida es la última nivelación del área o, si no hay, el diagnóstico antiguo. La Ruta y Hoy usan exactamente el mismo cálculo.

*Por qué.* Hablar en el idioma oficial del ICFES y no inventar un nivel con 3 preguntas.

*Límites.* Puede diferir del nivel de la pantalla de resultado de la nivelación, que usa precisión cruda. La barra no muestra la posición dentro del nivel.

`packages/convex/src/progress.ts`; `packages/convex/src/levels.ts`

#### Comparación con el país ✅

*Lo que ve el estudiante.* Debajo del nivel puede aparecer, por ejemplo, «El 48% del país está en Nivel 2 (ICFES 2024)» en Lectura Crítica o «El 50% del país está en Nivel 3» en Matemáticas. Donde no hay dato oficial, no aparece nada.

*Cómo funciona.* Solo se registraron las cifras que el informe nacional Saber 11 2024 dice en texto: Lectura nivel 2 = 48 %; Matemáticas nivel 3 = 50 % y nivel 4 = 8 %; Ciencias nivel 1 = 18 % y nivel 2 = 47 %. Sociales e Inglés quedan vacíos, con la razón anotada. Se muestra como nota bajo la gráfica de áreas de Progreso (estudiante y docente). El mensaje «Estás por encima del X% del país» se quitó: ninguna área tiene la distribución completa.

*Por qué.* Un punto de referencia público y verificable en lugar de un ranking entre usuarios. Prefiere no decir nada antes que inventar.

*Límites.* Cinco cifras en tres áreas. Completarlo requiere leer las figuras del informe o los microdatos de datos.gov.co.

`docs/national-results.v1.json`; `packages/convex/src/national.ts`

#### Tablero de confianza: «Qué tan seguro respondes» ✅

*Lo que ve el estudiante.* Una barra con los cuatro estados (Error de concepto, Frágil, Por aprender, Dominado) y «N respuestas declaradas». Si tiene errores de concepto, una alerta: «Tienes 3 respuestas donde estabas seguro y fallaste…». Si nunca declaró, la tarjeta explica la función en vez de mostrar ceros.

*Cómo funciona.* Ver [Confianza declarada](#confianza). Solo cuenta sesiones entregadas.

*Límites.* Muestra conteos, no tasas por área.

`apps/web/src/components/ConfidenceBreakdownCard.tsx`

#### Antes y ahora, por materia ✅

*Lo que ve el estudiante.* Una fila por materia: barra de precisión actual, una marca donde estaba en el diagnóstico, «40% → 58%» y un chip («+18 pts»). Sin dato de diagnóstico, «Nuevo». Ordenadas de mayor a menor mejora.

*Límites.* Igual que el encabezado: compara solo contra el diagnóstico antiguo. Para quien solo hizo nivelaciones, todas dicen «Nuevo».

#### «Sigue mejorando aquí» ✅

*Lo que ve el estudiante.* Hasta 5 subtemas con menor dominio («Geometría plana · Matemáticas»), cada uno con su nivel de maestría y un enlace a su lección.

*Cómo funciona.* Ordena con el puntaje de dominio antiguo, que pondera más los últimos 5 intentos que el total.

*Límites.* El orden usa la fórmula antigua y la insignia muestra el nivel nuevo, así que pueden no coincidir. Un subtema con un solo fallo puede aparecer.

#### Tu dominio por área ✅

*Lo que ve el estudiante.* Por cada área, una barra apilada y textos como «3 de 8 en Competente o más» y «1 Dominado · 2 Competente · 1 Familiar · 4 Sin empezar». Cada fila y el enlace «Ver el temario» llevan al Temario.

*Cómo funciona.* Ver [Niveles de maestría](#aprender). Cuenta sobre los mismos subtemas que el Temario: un subtema sin preguntas y sin nivel no entra. La barra no pinta los Sin empezar.

`apps/web/src/components/StudentProgressPage.tsx`; `apps/web/src/lib/mastery-display.ts`

#### Cómo se recalcula el progreso ✅

*Lo que ve el estudiante.* Nada directo: es lo que hace que Progreso, Hoy, Ruta y Temario se actualicen al entregar una sesión.

*Cómo funciona.* Al entregar cualquier sesión, el backend borra y vuelve a calcular desde cero los resúmenes por materia y por subtema y el perfil del estudiante, a partir de sus respuestas en sesiones entregadas. Conserva los niveles de maestría, que no se derivan de las respuestas.

*Por qué.* La especificación pide que el progreso salga de intentos explícitos y sea inspeccionable, sin depender de la "memoria" de un modelo de IA.

*Límites.* Recorre todo cada vez. Sirve para unos pocos miles de intentos por estudiante. El documento `docs/current-progress-calculation.md` está desactualizado.

`packages/convex/src/progress.ts`

#### Historial: estadísticas de estudio ✅

*Lo que ve el estudiante.* En `/history`, dentro de Progreso, cuatro tarjetas: «Racha actual» (con «Tu mejor racha»), «Días activos», «Preguntas» (con cuántas correctas) y «Precisión».

*Límites.* Las preguntas incluyen sesiones abiertas; las correctas no. El backend calcula el tiempo total de estudio, pero la página no lo muestra.

`apps/web/src/components/HistoryPage.tsx`; `packages/convex/src/history.ts`

#### Calendario de estudio ✅

*Lo que ve el estudiante.* Una cuadrícula de 16 semanas por 7 días titulada «Últimas 16 semanas», con «Cada cuadro es un día. Los vacíos son días sin estudiar». Al pasar el cursor: «3 de octubre: 12 preguntas, 9 correctas» o «sin estudiar». Más color, más preguntas (1 a 4, 5 a 14, 15 o más).

*Por qué.* Mostrar los días estudiados y los que no, como el calendario de contribuciones de GitHub.

*Límites.* Sin etiquetas de mes ni de día. En el teléfono se desplaza de lado.

#### Historial de sesiones ✅

*Lo que ve el estudiante.* Todas sus sesiones, de la más reciente a la más antigua, con filtros por tipo. Cada fila: ícono, área, fecha y hora, duración, «9/15» y un porcentaje coloreado. Las no terminadas dicen «Sin terminar» y llevan a resolver; las terminadas abren la revisión. Carga 20 a la vez con «Ver más».

*Límites.* El filtro por área existe en el backend pero no en la pantalla. Las sesiones abandonadas también salen como «Sin terminar» y su enlace lleva a una sesión que ya no se puede retomar.

---

<a id="contenido"></a>
### 2.8 Contenido, administración y plataforma

#### Banco de preguntas de los cuadernillos oficiales del ICFES ✅

*Lo que ve el estudiante.* Casi todas las preguntas salen de cuadernillos reales del ICFES, y la clave contra la que se califica es la que publicó el ICFES, no una que haya adivinado un modelo.

*Cómo funciona.* Un script lee el texto de cada PDF, corta por «Pregunta N», separa las opciones y lee la tabla de respuestas del propio cuadernillo. Descarta lo que no tiene clave, lo que tiene una clave que no coincide con ninguna opción y lo que menciona figuras o tablas. Entran 8 cuadernillos: 4 de práctica (Lectura, Matemáticas, Sociales, Ciencias) y 4 de examen oficial (Lectura 2026, Matemáticas 2026, Ciencias 2026 y Ciencias 2025). Según el último commit de contenido, el banco pasó de 120 a 213 preguntas. Recargar no cambia los identificadores de las preguntas; lo que desaparece se retira, nunca se borra. El subtema se asigna por palabras clave; si la coincidencia es débil, la pregunta queda marcada para revisión, pero igual entra porque el área sí es segura. 19 de los 33 subtemas tienen 3 preguntas o más.

*Por qué.* Con la clave oficial desaparece el mayor riesgo: estudiar con una respuesta equivocada inventada por la IA.

*Límites.* Inglés tiene 0 preguntas: sus textos son imágenes y sus formatos son distintos (3 opciones, o emparejamientos con 8 opciones). La carga se hace por consola, no desde el panel. Los PDF no están en el repo; se descargan con `content/fetch.sh`.

`packages/ingest/src/icfes-booklet.ts`; `packages/ingest/src/load-icfes-booklets.ts`; `packages/convex/src/booklets.ts`; `content/MANIFEST.md`

<a id="recortes"></a>
#### Preguntas mostradas como las imprime el ICFES ✅

*Lo que ve el estudiante.* La pregunta recortada del cuadernillo, con su figura, tabla o ecuación, y botones A, B, C, D reales. Una pregunta de Matemáticas con una gráfica se ve igual que en papel.

*Cómo funciona.* Un script en Python renderiza las páginas y recorta cada pregunta desde «Pregunta N» (o desde el encabezado «RESPONDA LAS PREGUNTAS…») hasta la primera opción. Otro script sube las imágenes y las asocia por número. Según el commit, se subieron 418 recortes: 213 quedaron en preguntas y 12 en textos compartidos.

*Por qué.* Las figuras de estos PDF son dibujos que la capa de texto pierde. Sin el recorte, un tercio del banco no se podía resolver.

*Límites.* Las imágenes no están en el repo; se regeneran con el script. El cargador sigue descartando las preguntas que mencionan figuras, así que el recorte no recupera esas.

`packages/ingest/src/icfes-crop-questions.py`; `packages/ingest/src/upload-icfes-crops.ts`

#### Preguntas con texto compartido ✅

*Lo que ve el estudiante.* Cuando varias preguntas comparten un texto, una tabla o una gráfica, ve el texto compartido con la etiqueta «Pregunta 2 de 4 de este texto». Las preguntas del grupo llegan juntas y en orden: nunca aparece una pregunta suelta sobre un texto que no ve.

*Cómo funciona.* El texto se guarda una sola vez y cada pregunta apunta a él. Toda sesión mete el grupo entero o no lo mete.

*Por qué.* Así es el examen real. Antes el contexto se pegaba en cada enunciado y los grupos se rompían.

`packages/convex/src/questionPool.ts`; `packages/ingest/src/question-groups.ts`

#### Subida de PDFs con OCR (para el administrador) ✅

*Lo que ve el estudiante.* Nada. El administrador arrastra PDF en `/admin` y cada uno se procesa solo: OCR, extracción de preguntas, respuesta, clasificación y aprobación. Al rato aparece con chips como «40 questions · 38 answers · 35 tagged · 30 eligible».

*Cómo funciona.* El OCR lo hace Mistral. La extracción y la inferencia de respuestas las hace Gemini. Los estados son subido, procesando, enriqueciendo, completado o fallido, y un fallido se puede reintentar.

*Por qué.* Fue el núcleo original del producto: convertir PDF escaneados en un banco estructurado. Sirve para fuentes sin texto ni clave.

*Límites.* Usa sus propias claves de API. Reprocesar borra y vuelve a crear las preguntas, lo que cambia sus identificadores. La respuesta la infiere un modelo sin verificación independiente.

`packages/convex/src/pdfs.ts`; `packages/convex/src/pdfPipeline.ts`

#### Enriquecimiento: respuesta, clasificación y aprobación ✅

*Lo que ve el estudiante.* Cada pregunta que viene de un PDF recibe respuesta, explicación, una justificación por cada distractor y su etiqueta de área, categoría y subtema. Solo llega al estudiante si pasa los umbrales de calidad.

*Cómo funciona.* Gemini propone la respuesta con un nivel de confianza y clasifica la pregunta dentro de la taxonomía oficial, rechazando etiquetas inventadas. Con confianza en la respuesta de 0,75 o más y en la clasificación de 0,70 o más, la pregunta puede usarse en nivelaciones (`diagnostic`). Con ambas en 0,55 o más, solo en práctica (`practice_only`). Por debajo, queda excluida.

*Por qué.* Separar el contenido original del enriquecimiento y filtrar por calidad antes de que algo llegue al estudiante.

*Límites.* A los cuadernillos no se les infiere la respuesta; su clave es la oficial. No hay pantalla para revisar las preguntas que quedan "por revisar".

`packages/ingest/src/question-enrichment-core.ts`; `packages/convex/src/pdfPipeline.ts`

<a id="explicaciones"></a>
#### Explicaciones para las preguntas de cuadernillo ✅ (requiere que el dueño corra `explanations:backfillExplanations`)

*Lo que ve el estudiante.* Al revisar una pregunta oficial, además de la letra correcta, una explicación y la justificación de cada opción incorrecta, con la nota de que la escribió la IA. Si no hay explicación, tras «Comprobar» ve «Esta pregunta todavía no tiene una explicación escrita.».

*Cómo funciona.* El dueño corre a mano un proceso interno. Trabaja en lotes de 5 y encadena el siguiente lote solo hasta el `limit` pedido; con `dryRun` solo lista las pendientes. A Gemini se le pide resolver la pregunta, con su imagen recortada, sin decirle la clave. La explicación se guarda (marcada como generada con IA) solo si el modelo llega por su cuenta a la clave oficial con confianza de 0,6 o más. Si discrepa o duda, la pregunta queda marcada para que una persona decida; se listan desde la consola con `explanations:listExplanationFlags`, una página de 200 preguntas por llamada. El proceso lee el banco por páginas, así que no se cae cuando el banco crece. Una pregunta que falla por error técnico no se marca y vuelve en la siguiente corrida. La clave oficial nunca se toca.

*Por qué.* Los cuadernillos solo traen la letra; quien falla un ítem real no tenía de qué aprender. Exigir que el modelo coincida con la clave funciona como verificación.

*Límites.* No se ha corrido todavía: hoy ninguna pregunta de cuadernillo tiene explicación. Necesita `GEMINI_API_KEY` en el despliegue. Sin pantalla: hoy las marcadas solo se ven en los datos de Convex (preguntas cuyo `answerErrorMessage` empieza por `explicacion_ia:`).

`packages/convex/src/explanations.ts`

<a id="preguntas-ia"></a>
#### Preguntas generadas por IA ✅ (solo para operadores)

*Lo que ve el estudiante.* No las puede pedir. Si un operador las genera, aparecen en práctica, repasos, retos y simulacros, pero nunca en la nivelación.

*Cómo funciona.* Una función interna crea entre 1 y 10 preguntas de un subtema (5 por defecto) con 4 opciones y solución. Se guardan como "solo práctica".

*Por qué está cerrada.* El modelo da por buenas sus propias respuestas y nada las verifica. La cola de revisión humana está planeada en la Fase 17.

`packages/convex/src/generatedQuestions.ts`

#### Panel de administración ✅

*Lo que ve el administrador.* En `/admin`, dos pestañas en inglés. «Upload PDFs»: arrastrar PDF y ver los últimos 50 con su estado, contadores y botones para abrir, ver el JSON, navegar y reintentar. «Questions»: un navegador pregunta por pregunta con su aprobación, estado de respuesta y clasificación, y la opción correcta resaltada.

*Cómo funciona.* Solo entra quien tiene la marca de administrador; los demás van a `/login`. La marca se da por consola con `booklets:grantAdmin` y el correo.

*Límites.* No hay pantalla para los reportes de problemas, ni para las preguntas marcadas por el proceso de explicaciones, ni para corregir claves o etiquetas, ni para generar preguntas. Los cuadernillos se cargan por consola. No hay enlace al panel desde la app del estudiante. Los roles de docente y coordinador son de la Fase 18.

`apps/web/src/routes/admin.tsx`; `packages/convex/src/pdfs.ts`; `packages/convex/src/auth.ts`

#### Un solo proveedor de IA ✅

*Cómo funciona.* El tutor, las lecciones, el coach y la generación de preguntas usan el mismo modelo, DeepSeek v4 flash a través de OpenRouter, definido en una sola línea. Cuesta unos 0,165 dólares por millón de tokens de salida, frente a 3,20 de la versión v4-pro. El contenido guardado (lecciones, coach) se regenera si falló, si cambiaron las instrucciones o si quedó "generando" más de 12 minutos.

*Límites.* El procesamiento de PDF y las explicaciones de cuadernillo usan Gemini y Mistral, con sus propias claves. Solo el tutor tiene límite diario.

`packages/convex/src/aiProvider.ts`; `packages/convex/src/aiCache.ts`

---

<a id="ideas"></a>
## 3. De dónde salió cada idea

En octubre de 2026 se analizaron los referentes del SAT y se encontraron 30 brechas (G01 a G30). La traducción al ICFES cambia porque el Saber 11 2026 es distinto del SAT: es en papel, con una forma fija para todos, dos sesiones de 4 h 30 el mismo día, sin calculadora ni hoja de fórmulas (solo hoja de operaciones), y calificado con un modelo estadístico (IRT de tres parámetros) que Aprendo no replica.

| Referente | Lo que hace allá | Equivalente en Aprendo | Cómo se adaptó al ICFES |
|---|---|---|---|
| Bluebook: marcar para revisar | Bandera en la pregunta | Bandera y tecla F | Es encerrar el número en el cuadernillo |
| Bluebook: eliminar opciones | Tachar una opción | Tachar con botón o presión larga | Es tachar a lápiz |
| Bluebook: pausa entre módulos | Descanso entre módulos | Sesión 1, descanso, Sesión 2 | Dos sesiones de 4 h 30; se vuelve a la 1:30 p. m. |
| Bluebook: reloj ocultable y aviso | Reloj y alerta final | Reloj ocultable y aviso a los 5 min | Es el "quedan 5 minutos" del jurado |
| Bluebook: pantalla antes del módulo | Reglas antes del reloj | Intro antes de nivelación y simulacro | El reloj sigue si sales |
| Bluebook: zoom | Agrandar texto | A- y A+ | Igual |
| Bluebook: revisión antes de enviar | Vista de preguntas | «Revisa antes de entregar» | Avisa lo que quedó en blanco |
| Bluebook: revelación y reporte de puntaje | Puntaje al final | Resultado de nivelación y reporte de simulacro | Niveles oficiales 1 a 4 y global 0 a 500 con rango, sin IRT |
| Bluebook: Desmos y hoja de referencia | Calculadora y fórmulas | No se construyó | Prohibidas en Saber 11 |
| Bluebook: módulos adaptativos | Dificultad del módulo 2 según el 1 | No se construyó | El Saber 11 es de forma fija |
| SAT: puntaje total | 400 a 1600 | Global 0 a 500 | Fórmula oficial ponderada 3-3-3-3-1 |
| Khan: niveles de maestría | Attempted, Familiar, Proficient, Mastered | Sin empezar a Dominado | Solo lo mezclado da Dominado |
| Khan: Mastery Challenge | Preguntas mezcladas que suben o bajan | Reto de dominio | 3 subtemas por 2 preguntas |
| Khan: puntos de maestría del curso | Puntos por nivel | 50, 80 y 100 puntos | Sobre la taxonomía ICFES |
| Khan: lecciones cortas y demos | Video y ejercicios | Lección escrita por IA y demo interactiva | Sin videos; ejemplos colombianos |
| Khan: misión diaria | Tareas del día | Tu plan de hoy | Prioriza por pesos oficiales del ICFES |
| Khan: reportar un problema | Reporte por ítem | «Reportar un problema» | Permitido en examen |
| Khan y UWorld: reintentar incorrectas | Repetir lo fallado | «Repetir las que fallé» | Tope de 30 |
| Khan y UWorld: práctica adaptativa | Dificultad a la medida | Orden por Elo cerca del 70 % | Solo en práctica, nunca al medir |
| UWorld y Magoosh: constructor de prácticas | Armar tu propio quiz | «Arma tu práctica» | Con fuentes Falladas y Marcadas |
| UWorld: modo tutor | Respuesta tras cada pregunta | «Comprobar» | Nunca en nivelación, simulacro ni reto |
| UWorld y Khan: explicar todas las opciones | Una razón por opción | «Por qué la C te pareció correcta» | Para cuadernillos, solo si la IA coincide con la clave |
| UWorld: % que eligió cada opción | Estadística por ítem | «38% la eligió» y tiempo mediano | Desde 20 respuestas |
| UWorld y metacognición | Confianza declarada | Seguro, Dudé, Adiviné | Ordena el repaso |
| PrepScholar y Khan: puntaje meta | Brecha a la meta | Brecha y veredicto en Hoy | Con tendencia propia, mínimo 3 semanas |
| College Board: horas de práctica | Unas 20 horas | Tiempo de estudio semanal | Sin prometer puntos |
| Khan y PrepScholar: reporte semanal | Resumen de la semana | Coach semanal con IA | Solo si hubo actividad |
| Control de ritmo | Tiempo por pregunta | Chip de ritmo | 135 s en Sesión 1, unos 121 s en Sesión 2 |
| Duolingo | Racha | Racha y días de la semana | Día de Colombia |

---

<a id="no-construir"></a>
## 4. Lo que decidimos no construir

| Qué | Por qué no |
|---|---|
| Calculadora tipo Desmos y hoja de fórmulas | Están prohibidas en el Saber 11. |
| Simulacro adaptativo | El examen real es de forma fija. |
| Videos | No hay contenido propio, y los datos móviles no son baratos. |
| Garantía de puntaje | No hay un predictor validado contra resultados reales. |
| Foros | Los usuarios son menores de edad y habría que moderar. |
| Tablas de clasificación | Desaniman. Se prefirió la comparación con el país. |
| Tarjetas de memoria propias | El repaso de errores ya cubre esa necesidad. |
| Subrayado de textos | Desde el commit 9687840 los textos se muestran como imágenes. |
| Generación de preguntas por IA abierta a usuarios | El modelo avala sus propias respuestas y no hay revisión humana todavía. |
| IA como motor de recomendación o como memoria del estudiante | La especificación pide recomendaciones por reglas, inspeccionables, a partir de intentos registrados. |

---

<a id="reglas"></a>
## 5. Reglas que protegen al estudiante y al negocio

**Respuestas selladas.** Mientras una sesión está abierta, el servidor nunca entrega la clave, la explicación, las justificaciones de las opciones (la que falta delataría la clave), la dificultad ni si una respuesta fue correcta. Todo se revela al entregar. Una pregunta que el estudiante tiene en un examen o reto en curso (cualquier sesión abierta sin respuesta inmediata, con o sin reloj) tampoco se revela en otra sesión. Sellar la pantalla no bastaba: cualquier conteo de aciertos sobre sesiones abiertas filtraba la clave. Por eso historial, tendencias, repaso, estadísticas y niveles solo cuentan respuestas de sesiones entregadas.

**Cada estudiante ve solo lo suyo.** Toda consulta y escritura verifica que la sesión o los datos pertenezcan a quien pregunta.

**Relojes justos.** El reloj vive en el servidor. Las respuestas se aceptan hasta 1 minuto después del vencimiento, por la latencia del celular, y la entrega automática hasta 5 minutos después. Más tarde, la sesión no se califica y queda como abandonada. Una sesión abandonada no cuenta para nada.

**Tutor cerrado mientras se mide.** Nunca durante la resolución, y en ninguna sesión mientras haya un examen cronometrado en curso.

**Puntajes honestos.** El global va siempre con su rango probable. Si falta un área, se dice cuál falta en lugar de rellenar con ceros. Ningún nivel se afirma con menos de 12 respuestas. El veredicto "vas a tiempo" exige 3 semanas de datos. La comparación con el país solo usa cifras publicadas y se calla donde no hay dato. Cada pantalla de puntaje aclara que es una estimación de Aprendo y no un puntaje oficial.

**Fuentes oficiales en archivos de datos.** Los cortes de nivel, la taxonomía y las cifras nacionales viven en archivos JSON con su fuente, no en el código. Un test fija los cortes.

**Claves oficiales intocables.** En los cuadernillos, la clave es la del ICFES. La IA solo escribe una explicación si llega sola a esa clave.

**Límite legal de los ítems del ICFES.** El ICFES prohíbe usar sus ítems con ánimo de lucro y transformarlos. La decisión tomada es dejar los ítems del ICFES solo en un nivel gratis, con atribución, y armar un banco original para el nivel de pago. Esto no está construido: hoy no hay campo de procedencia en los datos ni atribución visible, y los recortes muestran el ítem tal cual, lo que también habría que revisar a la luz de la prohibición de transformación.

**Presupuesto de IA.** El tutor tiene 80 mensajes por estudiante por día y mensajes de hasta 4000 caracteres. Las lecciones se escriben una vez y se comparten. El coach no se genera en semanas sin actividad. Las lecciones y el coach no tienen límite diario.

---

<a id="falta"></a>
## 6. Lo que falta y lo que tiene que hacer el dueño

### Fase 16: ciclo de aprendizaje (Khan) ✅

Terminada, con typecheck, lint y tests en verde (convex 367, web 124, ingest 36). Trajo: niveles de maestría y puntos por subtema, reto de dominio, orden adaptativo por Elo, constructor «Arma tu práctica», «Comprobar», «Repetir las que fallé», explicación de todas las opciones, % que eligió cada opción con tiempo mediano, plan del día, brecha a la meta con veredicto, tiempo de estudio con meta semanal y el proceso de explicaciones para cuadernillos.

Lo que quedó pendiente:

- La práctica a tu medida «Con reloj» arranca sin la intro cronometrada.
- Las respuestas inmediatas solo se eligen en el constructor. Desde el hub, la recomendada, la de tema y el repaso siempre son "al final".
- El reto no tiene enfriamiento; Khan espera 12 horas entre retos.
- Deuda en `today.ts`: repite la regla de "pendiente de repaso" de `sessions.ts`. Conviene exportarla en una limpieza. (El tracker también anota una copia del puntaje de área, pero `today.ts` ya importa `areaScore` de `progress.ts`.)
- Ninguna pantalla de la fase se ha probado en un navegador.
- Las explicaciones de cuadernillo y los contadores de «qué eligieron los demás» esperan a que el dueño corra sus procesos (abajo).

### Fase 17: capa comercial B2C 🗺️

- Procedencia del contenido y nivel gratis con ítems del ICFES y atribución (G04).
- Banco original: preguntas escritas con IA, verificadas y con cola de revisión humana (G28). Resuelve el problema legal y el banco pequeño.
- Acceso por pase único hasta el día del examen, listo sin pasarela de pago real (G30).
- Prueba sin registro (G21).
- Reporte para el acudiente (G22).
- Meta por universidad (G24). Hoy solo existe la meta global de 0 a 500.
- Simulacro imprimible con hoja de respuestas (G23).
- Recuperación de contraseña.
- Términos y política de privacidad según la Ley 1581.

### Fase 18: panel para colegios B2B 🗺️

Rol de docente o coordinador, grupos con código de invitación, lista de estudiantes en riesgo y reporte por competencia (G29). Hoy solo existe la marca de administrador: no hay roles, organizaciones ni grupos.

### Pendientes sueltos

- Aviso a los 30 minutos en las sesiones cronometradas.
- `viewport-fit=cover` para el área segura del iPhone.
- Tildes faltantes en «Sesion» y textos del panel de administración en inglés.
- Pantallas de administración para reportes de problemas y preguntas marcadas.
- Usar la nivelación como punto de partida en el encabezado y en «Antes y ahora» de Progreso. Hoy solo comparan con el diagnóstico antiguo, así que los estudiantes nuevos no ven su mejora ahí.

### Lo que tiene que hacer el dueño

1. **Guardar el trabajo.** Buena parte de las Fases 14 a 16 está sin commit. La Fase 16 ya cerró: hay que revisarla y hacer commit.
2. **Desplegar Convex con el schema nuevo.** La Fase 16 cambió el schema (por ejemplo, la tabla `questionAnswerStats` y el nivel de maestría por subtema), así que hay que desplegarlo antes de usar la app. Configurar también las claves: `OPENROUTER_API_KEY` (tutor, lecciones, coach), `GEMINI_API_KEY` (PDF y explicaciones) y `MISTRAL_API_KEY` (OCR).
3. **Llenar los contadores de «Qué eligieron los demás»**, una vez, justo después de desplegar: `bunx convex run sessions:backfillQuestionAnswerStats`. Si no, las sesiones entregadas antes del despliegue no cuentan en los porcentajes.
4. **Darse permisos de administrador** con `booklets:grantAdmin` y su correo.
5. **Cargar el contenido.** Bajar los PDF con `content/fetch.sh`, correr el cargador de cuadernillos, el script de recortes y la subida de recortes.
6. **Correr las explicaciones de cuadernillo**, con `GEMINI_API_KEY` ya configurada en el despliegue: `bunx convex run explanations:backfillExplanations '{"limit": 250}'`. Antes se puede probar con `'{"limit": 10, "dryRun": true}'`. Después, revisar las preguntas marcadas en el panel de datos de Convex (campo `answerErrorMessage` con prefijo `explicacion_ia:`); o con `bunx convex run explanations:listExplanationFlags '{"cursor": null}'`, repitiendo con el `continueCursor` que devuelve hasta `isDone`. Sin argumentos procesa solo 5 preguntas y no sigue.
7. **Probar las pantallas en un teléfono.** Ninguna pantalla de las Fases 14, 15 y 16 se ha visto en un navegador. Conviene recorrer el flujo completo en un celular real: nivelación, Hoy, Ruta, constructor, «Comprobar», reto, simulacro y revisión.
8. **Cargar las preguntas de Inglés.** Hoy tiene 0 preguntas, así que no hay nivelación de Inglés ni puntaje global posible. Sus cuadernillos usan formatos que el cargador todavía no lee.
9. **Hacer crecer Matemáticas.** Con unas 44 preguntas, la Sesión 2 del simulacro sale corta.
10. **Revisión legal de los ítems del ICFES.** Ánimo de lucro, transformación y recortes, además del tratamiento de datos de menores según la Ley 1581.
11. **Abrir una cuenta de pagos para la Fase 17.** Elegir una pasarela antes de construir el acceso por pase (G30).

---

<a id="glosario"></a>
## 7. Glosario

**Nivelación.** Medición de 15 preguntas y 30 minutos en una sola área. La primera abre la app.

**Diagnóstico (antiguo).** La medición inicial de 20 preguntas que existía antes. Ya no se lanza.

**Simulacro.** Examen de práctica con la estructura oficial: Sesión 1 y Sesión 2, o un área sola.

**Sesión.** Cualquier conjunto de preguntas que se resuelve y luego se revisa. Hay 8 tipos.

**Pool de elegibilidad.** El grupo del banco al que pertenece una pregunta según su calidad: `diagnostic` (sirve para medir), `practice_only` (solo práctica) o `excluded` (no se usa).

**Cuadernillo.** El PDF oficial del ICFES con preguntas y, a veces, su tabla de respuestas.

**Texto compartido o estímulo.** Un texto, tabla o gráfica sobre el que se hacen varias preguntas.

**Enriquecimiento.** El paso en que la IA le agrega a una pregunta su respuesta, explicación y clasificación.

**Taxonomía.** El mapa oficial de áreas, categorías y subtemas.

**Nivel ICFES o nivel de desempeño.** Los 4 niveles que publica el ICFES por área (1 a 4; en Inglés, Pre A1 a B1).

**MCER.** Marco Común Europeo de Referencia para las lenguas. De ahí salen A1, A2 y B1.

**Puntaje global.** El número de 0 a 500 que combina las 5 áreas con pesos 3, 3, 3, 3 y 1.

**Rango probable o banda.** El intervalo donde probablemente está el puntaje real. Se angosta con más preguntas.

**Elo.** Sistema de calificación del ajedrez: cada estudiante y cada pregunta tienen un número que sube o baja según quién "gana".

**IRT.** Teoría de respuesta al ítem, el método estadístico con que el ICFES califica (modelo de tres parámetros). Aprendo no lo usa; por eso sus puntajes son estimaciones.

**Maestría.** El nivel por subtema: Sin empezar, Intentado, Familiar, Competente o Dominado.

**Reto de dominio.** Sesión corta mezclada que puede subir o bajar la maestría.

**Repaso espaciado.** En la literatura, volver sobre lo aprendido a intervalos crecientes. En Aprendo es más simple: una cola de preguntas cuyo último intento fue incorrecto, las más antiguas primero.

**Retroalimentación inmediata.** Modo de práctica en que «Comprobar» muestra si acertaste tras cada pregunta.

**Confianza declarada.** Lo que el estudiante dice al responder: Seguro, Dudé o Adiviné.

**Error de concepto.** Estaba seguro y falló. **Frágil:** acertó sin estar seguro.

**Ritmo oficial.** El tiempo por pregunta del examen real: unos 135 segundos en la Sesión 1 y 121 en la Sesión 2.

**Sellado.** La regla de que el servidor no revela clave ni resultado mientras la sesión está abierta.

**Sesión abandonada.** Una sesión cronometrada que venció sin entregarse. No cuenta para nada.

**Convex.** La base de datos y el servidor de Aprendo.

**OpenRouter.** El servicio por el que Aprendo accede al modelo de IA DeepSeek.

## Ruta de mejora pedagógica (F30–F42, 2026-10-29)

El detalle de cada cambio, con su porqué y sus archivos, está en `plans/ruta-mejora-pedagogica.md`. En resumen:

- **Estudiante.**
  - Bienvenida de 3 pantallas antes de la primera nivelación.
  - La práctica corrige al momento y tiene tutor socrático, que solo da pistas antes de comprobar.
  - Cada sesión cierra con lo que subió o lo que falta.
  - Una sola brújula: `studyPlan.nextSubtopics` para Hoy, Ruta y Progreso.
  - Repaso espaciado por subtema, con preguntas hermanas.
  - Rango del puntaje global desde la primera área, y competencias ICFES en el informe del simulacro.
  - Estrategia del examen en la intro del simulacro.
  - Meta de carrera, que pondera el plan.
  - Micrófono y lectura en voz alta en el tutor.
- **Docente.**
  - Plan de la semana en tres niveles: todo el curso (40 % o más por debajo de Familiar), grupo pequeño (15–40 %) y uno a uno.
  - Análisis de las preguntas que más falla el curso.
  - Asignaciones (práctica o tiquete de salida) y ciclos de 2 semanas con antes y después.
  - Grupos editables y guía de clase imprimible por subtema.
  - Desempeño por competencia ICFES.
- **Colegio.** El último ciclo de cada curso, con su antes y después.
