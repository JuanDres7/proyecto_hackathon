---
description: "Task list for the client chat and coordinator PQR route"
---

# Tasks: Chat del cliente y ruta PQR del coordinador

**Input**: Design documents from `/specs/001-client-chat-pqr/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No se piden pruebas automáticas en la spec. La validación es `npm run lint` y [quickstart.md](quickstart.md).

**Organization**: Tareas por historia para poder implementar y probar cada una por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede hacerse en paralelo (otro archivo, sin depender de una tarea incompleta)
- **[Story]**: Historia a la que pertenece (US1, US2, US3)
- Cada tarea incluye la ruta del archivo

## Path Conventions

- Aplicación en `src/`
- Clasificación en `nlp-service/`
- Esquema en `supabase/migrations/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dejar listo el lugar del módulo sin crear otro servicio

- [x] T001 Crear el directorio `src/lib/client-chat/` según `specs/001-client-chat-pqr/plan.md`
- [x] T002 [P] Conservar `NLP_SERVICE_URL=http://127.0.0.1:8000` y `GEMINI_API_KEY` vacío en `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema, tipos y la única puerta HTTP del chat. Ninguna historia empieza antes de esto.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Crear `supabase/migrations/20261001160000_client_chat_pqr.sql` con la secuencia `service_code_seq` y estos cambios, respetando las reglas de `specs/001-client-chat-pqr/data-model.md`: en `service_orders`, `service_number` único y nulo mientras es borrador, `customer_name`, `customer_document`, `email` y `phone` obligatorios para confirmar, `services` con uno o más de `aseo_general`, `jardineria`, `limpieza_piscinas`, `status` solo `draft`, `pending_confirmation`, `confirmed` o `cancelled`, y `cancellation_reason` obligatorio si `cancelled` con valores `data_error`, `plans_changed`, `too_expensive` u `other`; en `visits`, columna `service_number`; en `complaints`, una fila por `service_number`, `rating` entero 1–5 obligatorio, `label` en `inasistencia`, `calidad`, `conducta`, `facturacion`, `seguridad`, `general` o `pending`, `confidence` 0–100, `vision_valid` `true`, `false` o nulo; tablas `pqr_cases` (`priority` siempre `alta`, `status` `open`, un caso por `service_number`) y `chat_turns` (`phase` `cotizacion`, `progreso` o `finalizacion`, `role` `user` o `assistant`). Políticas: el cliente anónimo puede insertar solicitud, turnos y evaluación; el coordinador puede leer `pqr_cases`; el navegador no usa la service role
- [x] T004 [P] Definir los enums y tipos de `specs/001-client-chat-pqr/data-model.md` en `src/lib/client-chat/types.ts`
- [x] T005 [P] Implementar la llamada de servidor a Gemini en `src/lib/client-chat/gemini.ts`: devuelve texto y datos extraídos; si falta `GEMINI_API_KEY` o la llamada falla, `{ ok: false }` y ningún código de servicio
- [x] T006 Implementar el despacho de `POST /api/client-chat` en `src/app/api/client-chat/route.ts` según `specs/001-client-chat-pqr/contracts/client-chat.md`, delegando cada `phase` a un módulo de `src/lib/client-chat/`
- [x] T007 [P] Implementar `src/hooks/useClientChat.ts` para que el navegador haga POST solo a `/api/client-chat`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Cotizar y obtener un código de servicio (Priority: P1) 🎯 MVP

**Goal**: El cliente confirma una cotización y recibe un solo código, el mismo que ve el supervisor.

**Independent Test**: Completar la cotización, responder que no y comprobar que no hay código; responder que sí y comprobar un solo `#…` que no cambia al confirmar otra vez. Cancelar sin motivo no cancela; con motivo, el servicio deja de estar activo.

### Implementation for User Story 1

- [x] T008 [US1] Persistir borrador, confirmación, edición y cancelación en `src/lib/client-chat/orders.ts`. Transiciones: `draft` → `pending_confirmation` al mostrar el resumen; `pending_confirmation` → `confirmed` solo con sí, asignando `service_number` con `service_code_seq`; `pending_confirmation` → `draft` con no; editar una solicitud `confirmed` conserva el código; `confirmed` → `cancelled` solo si `en_route_at` es nulo y `cancellation_reason` es `data_error`, `plans_changed`, `too_expensive` u `other`. Un segundo sí devuelve el mismo número. Guardar los turnos en `chat_turns`
- [x] T009 [P] [US1] Extraer la cotización (nombre, documento, email, teléfono, mensaje, servicios, fecha, hora, ubicación y observaciones de acceso) en `src/lib/client-chat/quote.ts`, usando `src/lib/client-chat/gemini.ts` y sin emitir el código ahí
- [x] T010 [US1] Conectar `phase: "cotizacion"` de `src/app/api/client-chat/route.ts` con `src/lib/client-chat/quote.ts` y `src/lib/client-chat/orders.ts`. Si Gemini no responde, la respuesta no trae `serviceNumber` nuevo y el texto dice que no se pudo completar
- [x] T011 [US1] Reemplazar en `src/components/ClientChat.tsx` la llamada a `/api/gemini` por `src/hooks/useClientChat.ts`. En cotización, pedir confirmación explícita sí/no, permitir editar y exigir el menú de cancelación en español: error de datos, cambio de planes, costoso u otro. Componente funcional, sin class components
- [x] T012 [US1] Mostrar `service_number` de la solicitud confirmada en `src/components/SupervisorHome.tsx` con el texto "Servicio" seguido del mismo código del chat

**Checkpoint**: La cotización funciona sola, sin evaluación ni progreso

---

## Phase 4: User Story 2 - Evaluar el servicio y escalar la insatisfacción (Priority: P2)

**Goal**: Al cerrar, el cliente envía estrellas, comentario y foto opcional. El coordinador ve la ficha. Con 1 o 2 estrellas se abre un caso de prioridad alta.

**Independent Test**: Con un servicio ya finalizado y un código conocido, enviar 2 estrellas y un comentario: la cola PQR muestra clase, certeza, resultado de la foto y resumen. Enviar 5 estrellas en otro servicio: no entra en esa cola. Con el contenedor apagado y 1 estrella, la clase queda pendiente y el caso sí se abre.

### Implementation for User Story 2

- [x] T013 [P] [US2] Cambiar `nlp-service/main.py` para comparar el comentario con varias frases ejemplo en español de cada clase (`inasistencia`, `calidad`, `conducta`, `facturacion`, `seguridad`, `general`) y devolver `label`, `confidence` entre 0 y 1, `serviceNumber` y `source: "sentence-transformers"`, como en `specs/001-client-chat-pqr/contracts/nlp-classify.md`. No comparar solo contra la palabra de la etiqueta
- [x] T014 [P] [US2] Subir la foto de inconformidad al bucket `evidencias` desde `src/lib/client-chat/photos.ts` y devolver `photo_path`. Si no hay foto, no subir nada
- [x] T015 [P] [US2] Pedir a Gemini, en `src/lib/client-chat/vision.ts`, si la foto corresponde al comentario. Guardar `vision_valid` `true` o `false` y `vision_note`. Sin foto: `vision_valid` nulo y nota de que no se adjuntó. Con foto y sin texto: nota de que no hay texto que contrastar, sin llamar a visión
- [x] T016 [P] [US2] Redactar el `summary` en español en `src/lib/client-chat/summary.ts` a partir de estrellas, comentario y clase ya calculada. Si Gemini falla, guardar un resumen fijo con la calificación y no bloquear la evaluación
- [x] T017 [US2] Guardar una sola evaluación en `src/lib/client-chat/evaluation.ts`. `rating` entero 1–5 obligatorio. Comentario vacío: `label` `general` y `confidence` 100, sin llamar al contenedor. Un segundo envío del mismo `service_number` no reemplaza la fila y responde que ya fue enviada. Si `rating` es 1 o 2, insertar `pqr_cases` con `priority` `alta` y `status` `open`. Si es 3, 4 o 5, no insertar caso
- [x] T018 [US2] Cambiar `src/app/api/nlp/route.ts` para que, si el contenedor no responde, devuelva `label: "pending"` y `confidence: null` con `source: "fallback"`. Quitar la clasificación por palabras sueltas como si fuera la clase real
- [x] T019 [US2] Conectar `phase: "finalizacion"` de `src/app/api/client-chat/route.ts` con `src/lib/client-chat/evaluation.ts`. La respuesta pone `evaluationSaved: true` y `pqrOpened: true` solo cuando el caso se creó, según `specs/001-client-chat-pqr/contracts/client-chat.md`
- [x] T020 [P] [US2] Implementar `GET /api/pqr` en `src/app/api/pqr/route.ts` según `specs/001-client-chat-pqr/contracts/pqr-queue.md`: solo casos de menos de 3 estrellas, con `confidencePercent` 0–100, `vision` en `corresponde`, `no_corresponde`, `sin_foto` o `sin_texto`, y sin indicadores ni novedades de campo
- [x] T021 [P] [US2] Implementar `src/hooks/usePqrQueue.ts` para leer solo `/api/pqr`
- [x] T022 [P] [US2] Crear `src/components/PqrQueue.tsx` como componente funcional que muestre código, estrellas, comentario, foto, clase, porcentaje de certeza, resultado de la foto y resumen en español. `label: "pending"` se muestra como clasificación pendiente
- [x] T023 [US2] Montar `src/components/PqrQueue.tsx` en `src/app/coordinador/page.tsx` sin reemplazar los indicadores ni las alertas de novedad que ya existen
- [x] T024 [US2] En `src/components/ClientChat.tsx`, al estado finalizado, mostrar el aviso de cierre con el código, las actividades cumplidas y las fotos de antes y después que existan, y el formulario de 1 a 5 estrellas, comentario y foto opcional

**Checkpoint**: La evaluación y la cola PQR funcionan con un servicio cerrado de prueba, aunque la cotización se haya cargado directo en la base

---

## Phase 5: User Story 3 - Consultar el progreso con el código (Priority: P3)

**Goal**: El cliente consulta el código y ve solo el estado registrado. En ruta no puede editar ni cancelar.

**Independent Test**: Con un código confirmado y una visita de prueba, cada estado derivado coincide con la plantilla. Con `en_route_at` puesto y sin visita, el texto dice que la ejecución está pendiente de sincronización. Un código cancelado no muestra datos de otro servicio.

### Implementation for User Story 3

- [x] T025 [P] [US3] Implementar `deriveClientProgress` en `src/lib/client-chat/progress.ts` en este orden: solicitud cancelada o código desconocido → sin servicio activo; no hay visita sincronizada y `en_route_at` ya está puesto → pendiente de sincronización; hay supervisor y no hay `en_route_at` ni check-in → asignado, con nombre e identificación; hay `en_route_at` y no hay check-in → en camino; hay check-in, no hay check-out y hay novedad → pausa por novedad; hay check-in y no hay check-out → en ejecución; hay check-out → finalizado. No llamar a Gemini
- [x] T026 [P] [US3] Escribir las plantillas en español en `src/lib/client-chat/progress-templates.ts`, incluida "En ejecución - Pendiente de sincronización de datos" y "Servicio en pausa. El coordinador está gestionando la solución"
- [x] T027 [US3] Conectar `phase: "progreso"` de `src/app/api/client-chat/route.ts` con `src/lib/client-chat/progress.ts`. `canEdit` y `canCancel` son `false` cuando `en_route_at` tiene valor. Un código inexistente o cancelado responde que no hay un servicio activo y no revela otra solicitud
- [x] T028 [US3] En `src/components/ClientChat.tsx`, consultar por código, mostrar el texto de la plantilla y ocultar editar y cancelar cuando la respuesta trae `canEdit: false` y `canCancel: false`

**Checkpoint**: Las tres fases responden por la misma ruta y cada una se puede probar con datos cargados en la base

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cerrar el atajo que inventa códigos y validar la guía

- [x] T029 Quitar de `src/app/api/gemini/route.ts` la generación de códigos `SRV-` y el precio inventado, y dejar la ruta fuera del flujo de `src/components/ClientChat.tsx`
- [x] T030 Ejecutar `npm run lint` y corregir las advertencias en los archivos de este módulo
- [ ] T031 Recorrer los escenarios 1 a 9 de `specs/001-client-chat-pqr/quickstart.md` y corregir los defectos en los archivos que fallen. El escenario 9 (`npm run lint`) ya pasa. Los escenarios 1 a 8 quedan pendientes de una réplica Supabase y de Docker, que no están en este entorno.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias
- **Foundational (Phase 2)**: Depende del setup. Bloquea todas las historias
- **User Stories (Phase 3+)**: Dependen de la fase 2. US2 y US3 se pueden probar con filas cargadas en la base, sin pasar por el chat de US1
- **Polish (Phase 6)**: Después de las historias que se quiera entregar

### User Story Dependencies

- **User Story 1 (P1)**: Después de la fase 2. No depende de US2 ni US3
- **User Story 2 (P2)**: Después de la fase 2. Usa el mismo `route.ts` que US1; si se hace en paralelo, no editar ese archivo a la vez
- **User Story 3 (P3)**: Después de la fase 2. Misma regla sobre `route.ts` y sobre `src/components/ClientChat.tsx`

### Within Each User Story

- Tipos y esquema antes de los servicios
- Servicios antes de conectarlos a la ruta
- La ruta antes de la pantalla que la consume
- `src/lib/client-chat/evaluation.ts` después de fotos, visión y resumen

### Parallel Opportunities

- T002 puede ir con T001
- T004, T005 y T007 pueden ir en paralelo después de empezar la fase 2. T006 espera a T004
- T009 puede ir en paralelo con T008
- T013, T014, T015, T016, T020, T021 y T022 pueden ir en paralelo
- T025 y T026 pueden ir en paralelo
- No paralelizar tareas que escriben `src/app/api/client-chat/route.ts` ni `src/components/ClientChat.tsx`

---

## Parallel Example: User Story 2

```bash
Task: "Frases ejemplo en nlp-service/main.py"
Task: "Subida de foto en src/lib/client-chat/photos.ts"
Task: "Visión en src/lib/client-chat/vision.ts"
Task: "Resumen en src/lib/client-chat/summary.ts"
Task: "GET /api/pqr en src/app/api/pqr/route.ts"
Task: "Hook src/hooks/usePqrQueue.ts"
Task: "Componente src/components/PqrQueue.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Terminar Phase 1 y Phase 2
2. Terminar Phase 3
3. Parar y probar la cotización, el no, el sí único y la cancelación con motivo
4. El código ya puede mostrarse al supervisor

### Incremental Delivery

1. Setup + Foundational
2. User Story 1 → cotización con código único
3. User Story 2 → evaluación, contenedor NLP y cola PQR
4. User Story 3 → progreso anclado a la visita y bloqueo en ruta
5. Polish → lint y quickstart

### Parallel Team Strategy

1. Todos cierran Setup y Foundational
2. Una persona toma US1 (cotización y `ClientChat.tsx`)
3. Otra toma el contenedor, la evaluación y la cola PQR, sin editar `route.ts` hasta integrar
4. La consulta de progreso entra al final sobre la misma ruta

---

## Notes

- [P] = otro archivo, sin depender de una tarea sin terminar
- El contenedor se construye ampliando `nlp-service/`, no creando un servicio nuevo
- El supervisor no gana una pantalla de chat. `en_route_at` lo escribe el módulo de campo; aquí solo se lee
- Commit al cerrar cada fase o cada historia
