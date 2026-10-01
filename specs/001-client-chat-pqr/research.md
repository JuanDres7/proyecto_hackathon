# Research: Chat del cliente y ruta PQR

## 1. Dónde corre la clasificación del comentario

- **Decision**: La clasificación sigue en el microservicio Python ya existente (`nlp-service/`), empaquetado con Docker y levantado con `docker compose`. Next.js solo lo llama desde el servidor, por `NLP_SERVICE_URL`.
- **Rationale**: La constitución obliga a que la clasificación NLP de quejas sea FastAPI + Sentence Transformers dentro de un contenedor. El navegador del cliente y el teléfono del supervisor no pueden cargar ese modelo. La spec no nombra la herramienta; el plan sí, porque aquí se decide el cómo.
- **Alternatives considered**: Clasificar el comentario con Gemini. Se rechaza: la constitución reserva el texto y la visión a Gemini, y la clasificación a este contenedor. Hacerlo en el navegador también se rechaza por peso, por la clave y porque el supervisor debe seguir offline.

## 2. Cómo se vuelve útil la certeza del clasificador

- **Decision**: Se mantienen las seis clases (`inasistencia`, `calidad`, `conducta`, `facturacion`, `seguridad`, `general`) y el modelo `paraphrase-multilingual-MiniLM-L12-v2`. Cada clase se compara contra frases ejemplo en español, no contra la palabra suelta de la etiqueta.
- **Rationale**: El servicio actual codifica solo la etiqueta. Con una sola palabra, la similitud no distingue una queja real. Las frases ejemplo mejoran la certeza sin cambiar de contenedor ni de modelo.
- **Alternatives considered**: Un modelo entrenado con quejas propias. No hay corpus de la hackathon. Dejar la comparación por etiqueta. Produce una certeza que el coordinador no puede interpretar.

## 3. Una sola puerta de servidor para Gemini

- **Decision**: El chat del cliente llama a una ruta de Next.js (`/api/client-chat`). Esa ruta llama a Gemini para el diálogo de cotización, el resumen de la insatisfacción y la visión. La clave no sale del servidor. La Edge Function `gemini-proxy` no forma parte de este flujo.
- **Rationale**: Hoy el cliente ya entra por `/api/gemini`, y esa ruta tiene el modo demo si falta la clave. La Edge Function reenvía el cuerpo crudo y no aplica las reglas del código ni de las estrellas. Dos puertas permitirían que el modelo emitiera un código.
- **Alternatives considered**: Mover todo a la Edge Function, como dice ArquitecturaJuan.md. Se deja para después: no aporta una regla que la ruta de Next no pueda cumplir, y obligaría a rehacer el contrato a mitad de la hackathon.

## 4. Quién emite el código de servicio

- **Decision**: PostgreSQL emite el código con una secuencia, se guarda en `service_orders.service_number` y se muestra como `#` más el número. Gemini solo extrae los datos de la cotización. El código se crea después del sí explícito.
- **Rationale**: La spec prohíbe un segundo código y prohíbe que el asistente invente el identificador. El demo actual de `/api/gemini` inventa `SRV-` en el texto. Eso no se conserva.
- **Alternatives considered**: Pedirle el código al modelo y validarlo después. Falla en cuanto el texto no trae el patrón. Un UUID visible. El flujo del grupo usa un código corto tipo `#3089`.

## 5. De dónde sale el progreso

- **Decision**: El estado que ve el cliente lo calcula el servidor con la solicitud y la visita ya sincronizada. El texto es una plantilla en español, no una respuesta libre de Gemini. Si falta la visita cuando el trabajo de campo ya empezó, la plantilla dice que la ejecución está pendiente de sincronización.
- **Rationale**: La spec exige que el chat no describa avances que no llegaron. Un modelo redactando el estado puede rellenar huecos.
- **Alternatives considered**: Pasarle la fila a Gemini para que la narre. Se rechaza en esta entrega: la plantilla ya cumple el mensaje fijo del diagrama y es comprobable palabra por palabra.

## 6. Cuándo se abre el caso de prioridad alta

- **Decision**: Si las estrellas son 1 o 2, el servidor inserta el caso. Gemini no decide la prioridad. 3, 4 o 5 no abren caso por esta regla. Un comentario vacío se guarda como clase `general` sin llamar al contenedor.
- **Rationale**: Es una regla de negocio del diagrama del coordinador. Mezclarla con la certeza del clasificador haría que una queja suave con 1 estrella no escale, o que una de 5 estrellas sí.
- **Alternatives considered**: Escalar también cuando la clase sea `inasistencia` aunque haya 4 estrellas. La spec solo obliga el umbral de estrellas. No se añade otra regla.

## 7. Dónde queda la foto de inconformidad

- **Decision**: La foto de la evaluación se sube al bucket `evidencias` por una ruta de servidor. En `complaints` se guarda la ruta, no el binario. La visión compara esa imagen con el comentario y guarda sí, no, o sin foto.
- **Rationale**: El bucket ya existe para evidencias de campo. Separar otro bucket no cambia el flujo del coordinador.
- **Alternatives considered**: Dejar la foto solo en el navegador, como hace hoy el chat demo. El coordinador no podría abrirla después.

## 8. Qué pasa si Gemini o el contenedor no responden

- **Decision**: Si falta `GEMINI_API_KEY` o la llamada falla, la cotización no inventa un código ni un precio. El chat dice que no pudo completar la conversación. Si el contenedor NLP no responde, la ficha se guarda con la clase pendiente de clasificar y el coordinador la ve igual; las estrellas menores a 3 siguen abriendo el caso.
- **Rationale**: El modo demo actual fabrica un `SRV-` y da la cotización por hecha. Eso contradice la spec. El caso de prioridad alta no puede depender de que el modelo esté despierto.
- **Alternatives considered**: Mantener el fallback que inventa el código. Se rechaza.
