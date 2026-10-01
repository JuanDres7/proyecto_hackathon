# Feature Specification: Chat del cliente y ruta PQR del coordinador

**Feature Branch**: `001-client-chat-pqr`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "Módulo de conversación del cliente en tres fases (cotización, progreso y finalización) y ficha clasificada de la evaluación para la ruta de peticiones, quejas y reclamos del coordinador. El código de servicio lo emite el sistema y lo comparte con el supervisor. El progreso se lee de la visita ya sincronizada. La clasificación y el resumen solo aplican a la evaluación del cliente. Indicadores, novedades de campo y la decisión de cierre o reasignación quedan fuera."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cotizar y obtener un código de servicio (Priority: P1)

Un cliente abre el chat y agenda un servicio. Indica quién es, qué necesita, cuándo y dónde. El asistente le pide confirmar el resumen. Solo después de un sí explícito el sistema entrega un código único, el mismo que verá el supervisor asignado.

**Why this priority**: Sin un código compartido no hay servicio que seguir ni evaluación que escalar. Es el acuerdo entre el cliente y la operación.

**Independent Test**: Un cliente nuevo puede completar la cotización, confirmar y recibir un código, sin tener una visita previa ni una evaluación.

**Acceptance Scenarios**:

1. **Given** un cliente sin solicitud activa, **When** entrega nombre, identificación, email, teléfono, mensaje, uno o más servicios entre Aseo General, Jardinería y Limpieza de Piscinas, fecha, hora, ubicación y observaciones de acceso, y responde que sí al resumen, **Then** el sistema emite un solo código de servicio y lo muestra en el chat.
2. **Given** un resumen de cotización en pantalla, **When** el cliente responde que no, **Then** no se emite código y puede corregir los datos.
3. **Given** una solicitud ya confirmada y el supervisor aún no va en ruta, **When** el cliente elige editar, **Then** ve los datos capturados, los cambia y debe confirmar de nuevo sin recibir un código distinto.
4. **Given** una solicitud confirmada y el supervisor aún no va en ruta, **When** el cliente elige cancelar, **Then** debe escoger un motivo (error de datos, cambio de planes, costoso u otro) antes de que la cancelación quede registrada y el servicio deje de estar activo.
5. **Given** una solicitud confirmada, **When** el supervisor consulta sus asignaciones, **Then** ve el mismo código, el lugar y los servicios acordados.

---

### User Story 2 - Evaluar el servicio y escalar la insatisfacción (Priority: P2)

Cuando el servicio termina, el chat avisa al cliente, muestra lo cumplido y las fotos de antes y después, y pide estrellas, un comentario y una foto opcional. El coordinador recibe una ficha con la clase del comentario, qué tan segura es esa clase, si la foto corresponde al texto y un resumen de la insatisfacción. Si hay menos de 3 estrellas, el caso entra a la cola de prioridad alta.

**Why this priority**: Es la información que el coordinador usa para saber qué tan bien quedó el trabajo y qué reclamaciones atender primero.

**Independent Test**: Con un servicio ya cerrado y un código conocido, el cliente envía estrellas y comentario, y el coordinador ve la ficha y, si aplica, el ticket de prioridad alta, sin usar el chat de cotización.

**Acceptance Scenarios**:

1. **Given** un servicio marcado como finalizado, **When** el cliente abre el chat, **Then** recibe el aviso de cierre con el código, la lista de actividades cumplidas y las fotos de antes y después disponibles.
2. **Given** el aviso de cierre, **When** el cliente asigna estrellas, escribe un comentario y adjunta o no una foto, **Then** queda guardada una ficha con la clase del comentario, el grado de certeza, el resultado de la foto y un resumen en español.
3. **Given** un comentario del cliente, **When** se clasifica, **Then** la clase es una sola entre inasistencia, calidad, conducta, facturación, seguridad o general.
4. **Given** una foto adjunta, **When** se revisa contra el comentario, **Then** la ficha dice si corresponde o no al texto. **Given** que no hay foto, **Then** la ficha indica que no hubo foto y el comentario igual se clasifica.
5. **Given** una evaluación de 1 o 2 estrellas, **When** se guarda, **Then** se abre un caso de prioridad alta para el coordinador y el servicio no queda cerrado como satisfecho.
6. **Given** una evaluación de 3, 4 o 5 estrellas, **When** se guarda, **Then** no se abre un caso de prioridad alta por la regla de estrellas.
7. **Given** un caso de prioridad alta, **When** el coordinador abre la ruta de peticiones, quejas y reclamos, **Then** ve el motivo, el comentario, la foto si existe, la clase, el grado de certeza, el resultado de la foto y el resumen.

---

### User Story 3 - Consultar el progreso con el código (Priority: P3)

El cliente escribe su código y el chat le cuenta en qué punto va el servicio, usando solo lo que la visita ya sincronizó. Si el supervisor va en ruta, ya no puede editar ni cancelar. Si la visita sigue sin sincronizar, el chat no inventa el avance.

**Why this priority**: Da trazabilidad al cliente, pero depende de datos de campo que esta función no captura.

**Independent Test**: Con un código ya emitido y una visita de prueba en un estado conocido, el cliente consulta y recibe ese estado, incluido el aviso de sincronización pendiente.

**Acceptance Scenarios**:

1. **Given** un código válido, **When** el cliente lo consulta, **Then** el chat muestra solo uno de estos estados registrados: asignado, en camino, check-in confirmado, en ejecución o pausa por novedad.
2. **Given** el estado asignado, **When** el cliente consulta, **Then** ve el nombre y la identificación del supervisor asignado.
3. **Given** el supervisor marcado en ruta, **When** el cliente intenta editar o cancelar, **Then** esas acciones no están disponibles.
4. **Given** tareas en ejecución cuya visita aún no sincroniza, **When** el cliente consulta, **Then** el mensaje indica que la ejecución está pendiente de sincronización y no describe tareas que no hayan llegado.
5. **Given** una novedad que pone el servicio en pausa, **When** el cliente consulta, **Then** el chat informa que el servicio está en pausa y que el coordinador está gestionando la solución.
6. **Given** un código inexistente o cancelado, **When** el cliente lo consulta, **Then** el chat dice que no hay un servicio activo con ese código y no muestra datos de otro servicio.

---

### Edge Cases

- El cliente confirma dos veces el mismo resumen: se conserva un solo código.
- El cliente intenta cancelar sin elegir motivo: la cancelación no se registra.
- El cliente envía estrellas sin comentario: la ficha se guarda, la clase queda en general y el resumen describe la calificación.
- El cliente envía una foto sin comentario: la ficha indica que no hay texto que contrastar y no inventa una queja.
- El cliente califica otra vez el mismo servicio: se conserva la evaluación ya guardada y se le informa que ya fue enviada.
- La visita no tiene fotos de antes o después: el cierre igual se notifica y se indica qué evidencia falta.
- El supervisor nunca llega a marcar que va en ruta: editar y cancelar siguen disponibles, y cancelar sigue exigiendo motivo.
- El coordinador abre la ruta de operación normal o la de novedades de campo: no aparece una clase, un grado de certeza ni un resumen generados para esos casos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST conversar con el cliente en tres fases diferenciadas: cotización, progreso y finalización.
- **FR-002**: En la cotización, el sistema MUST recoger nombre, identificación, email, teléfono y mensaje inicial.
- **FR-003**: El cliente MUST poder elegir uno o más servicios entre Aseo General, Jardinería y Limpieza de Piscinas en la misma solicitud.
- **FR-004**: El cliente MUST poder indicar fecha, hora, ubicación y observaciones de acceso antes de confirmar.
- **FR-005**: El sistema MUST mostrar un resumen y pedir una confirmación explícita de sí o no antes de crear el servicio.
- **FR-006**: El sistema MUST emitir un código único de servicio solo después del sí, y MUST mostrar ese mismo código al supervisor asignado.
- **FR-007**: El sistema MUST NOT emitir un segundo código si el cliente confirma de nuevo la misma solicitud o si la edita antes de que el supervisor vaya en ruta.
- **FR-008**: Antes de que el supervisor vaya en ruta, el cliente MUST poder editar los datos capturados y MUST volver a confirmarlos.
- **FR-009**: Antes de que el supervisor vaya en ruta, el cliente MUST poder cancelar solo después de elegir un motivo entre error de datos, cambio de planes, costoso u otro.
- **FR-010**: A partir del momento en que el supervisor queda marcado en ruta, el sistema MUST impedir editar y cancelar ese servicio desde el chat.
- **FR-011**: En el progreso, el cliente MUST poder consultar por el código y el sistema MUST responder con el estado registrado de la visita: asignado, en camino, check-in confirmado, en ejecución o pausa por novedad.
- **FR-012**: En el estado asignado, el sistema MUST mostrar el nombre y la identificación del supervisor.
- **FR-013**: Si la ejecución aún no está sincronizada, el sistema MUST decir que está pendiente de sincronización y MUST NOT describir avances no registrados.
- **FR-014**: Si el servicio está en pausa por novedad, el sistema MUST informar que el coordinador está gestionando la solución.
- **FR-015**: Al finalizar el servicio, el sistema MUST avisar al cliente con el código, las actividades cumplidas registradas y las fotos de antes y después que existan.
- **FR-016**: El cliente MUST poder enviar una calificación de 1 a 5 estrellas, un comentario y una foto opcional de inconformidad.
- **FR-017**: El sistema MUST clasificar el comentario en una sola clase: inasistencia, calidad, conducta, facturación, seguridad o general, y MUST guardar un grado de certeza legible por el coordinador.
- **FR-018**: Si hay foto y comentario, el sistema MUST indicar si la foto corresponde al texto. Si no hay foto, MUST dejar constancia de que no se adjuntó.
- **FR-019**: El sistema MUST guardar una ficha de la evaluación con el comentario, la calificación, la foto si existe, la clase, el grado de certeza, el resultado de la foto y un resumen en español de la insatisfacción.
- **FR-020**: Si la calificación es menor a 3 estrellas, el sistema MUST abrir un caso de prioridad alta en la ruta de peticiones, quejas y reclamos, y MUST NOT dar el servicio por cerrado en satisfacción.
- **FR-021**: Si la calificación es 3 o más, el sistema MUST NOT abrir un caso de prioridad alta por esta regla.
- **FR-022**: El coordinador MUST poder abrir ese caso y ver el motivo de insatisfacción, el comentario, la foto, la clase, el grado de certeza, el resultado de la foto y el resumen.
- **FR-023**: El sistema MUST NOT clasificar ni resumir con este mecanismo los indicadores de la operación normal ni las novedades y tareas inconclusas reportadas por el supervisor.
- **FR-024**: La prioridad de una novedad de campo MUST seguir siendo la que registró el supervisor, y la decisión de autorizar el cierre o reasignar MUST seguir siendo del coordinador.
- **FR-025**: El supervisor MUST NOT usar este chat para registrar la visita, y la captura en campo MUST seguir disponible sin conexión.
- **FR-026**: El sistema MUST NOT inventar hora de llegada, ubicación, código de servicio ni estado de la visita.

### Key Entities

- **Solicitud de servicio**: Datos del cliente, servicios elegidos, fecha, hora, ubicación, observaciones de acceso, estado de confirmación y motivo de cancelación si existe.
- **Código de servicio**: Identificador único emitido al confirmar, compartido entre el cliente y el supervisor, estable durante ediciones.
- **Visita sincronizada**: Estado operativo ya recibido desde campo (asignado, en camino, check-in confirmado, en ejecución, pausa por novedad o finalizado), supervisor asignado, actividades y fotos de antes y después.
- **Evaluación del cliente**: Estrellas, comentario y foto opcional asociados a un código.
- **Ficha clasificada**: Clase del comentario, grado de certeza, correspondencia de la foto y resumen para el coordinador.
- **Caso de prioridad alta**: Apertura automática cuando la evaluación tiene menos de 3 estrellas, visible solo en la ruta de peticiones, quejas y reclamos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un cliente completa la cotización y recibe su código en una sola conversación, en menos de 5 minutos, sin intervención de un operador.
- **SC-002**: El 100% de las confirmaciones con un sí explícito producen exactamente un código, y ese código es el que ve el supervisor.
- **SC-003**: El 100% de las consultas de progreso muestran un estado igual al registrado en la visita, o el aviso de sincronización pendiente cuando ese registro aún no llegó.
- **SC-004**: En el 100% de los servicios con el supervisor en ruta, editar y cancelar no están disponibles para el cliente.
- **SC-005**: El 100% de las evaluaciones con menos de 3 estrellas aparecen en la cola de prioridad alta del coordinador con comentario, clase y resumen.
- **SC-006**: El coordinador identifica la clase y si la foto corresponde al comentario en el 100% de las evaluaciones que incluyeron comentario o foto, sin abrir el chat del cliente.
- **SC-007**: Ningún indicador de operación normal ni ninguna novedad de campo muestra una clase o un resumen producidos por esta función.

## Assumptions

- La escala de satisfacción es de 1 a 5 estrellas. Menos de 3 significa 1 o 2.
- Una solicitud con varios servicios recibe un solo código.
- Editar una solicitud confirmada actualiza la misma solicitud y conserva el código.
- El motivo "otro" queda registrado con esa etiqueta. No hace falta un texto adicional para completar la cancelación.
- Una evaluación por servicio. Un segundo envío no reemplaza la primera.
- El grado de certeza se muestra como un porcentaje de 0 a 100.
- El nombre y la identificación del supervisor ya existen cuando el servicio está asignado. Si aún no hay supervisor, el estado no se presenta como asignado.
- Las fotos de antes y después, las actividades y el estado de la visita los aporta la operación de campo. Esta función solo los muestra y no los captura.
- Contactar al cliente para resolver el reclamo ocurre fuera de esta función. Aquí el coordinador recibe el caso listo para revisarlo.
- Los textos que ve el cliente y el coordinador están en español.
- La operación del supervisor sin conexión ya existe y no forma parte de esta entrega. Esta función no se bloquea ni se ejecuta en el dispositivo del supervisor.
