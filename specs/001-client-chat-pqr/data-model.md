# Data Model: Chat del cliente y ruta PQR

Los identificadores y columnas nuevas van en inglés. Los textos guardados para la interfaz van en español.

## ServiceOrder

Amplía `public.service_orders`.

| Field | Rules |
| --- | --- |
| id | UUID, ya existe |
| service_number | Único, lo asigna la secuencia al confirmar. Nulo mientras es borrador |
| customer_name | Obligatorio para confirmar |
| customer_document | Obligatorio para confirmar |
| email | Obligatorio para confirmar |
| phone | Obligatorio para confirmar |
| opening_message | Mensaje inicial |
| services | Uno o más de `aseo_general`, `jardineria`, `limpieza_piscinas` |
| scheduled_at | Fecha y hora elegidas |
| location | Ubicación |
| access_notes | Observaciones de acceso, opcional |
| quote_json | Borrador de la cotización antes del sí |
| status | `draft`, `pending_confirmation`, `confirmed`, `cancelled` |
| cancellation_reason | Obligatorio si `cancelled`: `data_error`, `plans_changed`, `too_expensive`, `other` |
| supervisor_id | Nulo hasta que la operación asigne |
| en_route_at | Lo escribe el módulo de campo. Esta función solo lo lee |
| created_at | Ya existe |

Relaciones: un código pertenece a una solicitud. Una solicitud tiene como máximo una evaluación.

Transiciones:

- `draft` → `pending_confirmation` cuando el resumen está completo y se muestra el sí/no.
- `pending_confirmation` → `confirmed` solo con un sí. Ahí se asigna `service_number`.
- `pending_confirmation` → `draft` con un no.
- `confirmed` → `confirmed` al editar, conservando el código, y vuelve a exigir sí si cambian los datos.
- `confirmed` → `cancelled` solo si `en_route_at` es nulo y hay motivo.
- Con `en_route_at` presente no hay edición ni cancelación.

## Visit (lectura)

No se capturan visitas en esta función. Se lee `public.visits` y se añade `service_number` para unirla a la solicitud.

El progreso del chat se deriva así, en este orden:

1. Solicitud cancelada o código desconocido: no hay servicio activo.
2. No hay visita sincronizada y `en_route_at` ya está puesto, o hay check-in local aún no sincronizado: "En ejecución - Pendiente de sincronización de datos".
3. Hay supervisor y no hay `en_route_at` ni check-in: asignado. Se muestra nombre e identificación.
4. Hay `en_route_at` y no hay check-in: en camino.
5. Hay check-in, no hay check-out y hay novedad: pausa por novedad.
6. Hay check-in y no hay check-out: en ejecución.
7. Hay check-out: finalizado. Habilita la evaluación.

`en_route_at` lo marca el flujo del supervisor. Hasta que ese módulo lo escriba, el bloqueo no se activa. El quickstart lo fija directo en la base para probar el bloqueo.

## Evaluation

Amplía `public.complaints`. Una fila por `service_number`.

| Field | Rules |
| --- | --- |
| service_number | Único en esta tabla para esta función |
| rating | Entero 1–5, obligatorio |
| body | Comentario. Vacío permitido |
| photo_path | Ruta en el bucket `evidencias`, opcional |
| label | `inasistencia`, `calidad`, `conducta`, `facturacion`, `seguridad`, `general`, o `pending` si el contenedor no respondió |
| confidence | 0–100. Si no hubo comentario, 100 y clase `general` sin llamar al contenedor |
| vision_valid | `true`, `false` o nulo |
| vision_note | Por qué corresponde o no. Si no hay foto: sin foto. Si hay foto y no hay texto: sin texto que contrastar |
| summary | Resumen en español para el coordinador |
| created_at | Ya existe |

Un segundo envío del mismo código no reemplaza la fila.

## PqrCase

Tabla nueva `public.pqr_cases`.

| Field | Rules |
| --- | --- |
| id | UUID |
| service_number | Único. Apunta a la evaluación |
| priority | Siempre `alta` en esta función |
| status | `open` al crearse |
| opened_at | Momento de la evaluación |

Se inserta en la misma operación que la evaluación si `rating` es 1 o 2. No se inserta si es 3, 4 o 5. No se crea para novedades de campo ni para indicadores.

## ChatTurn

Tabla nueva `public.chat_turns`, para no perder el borrador al recargar.

| Field | Rules |
| --- | --- |
| id | UUID |
| service_number | Nulo hasta que existe el código |
| draft_id | Identifica la cotización antes del código |
| phase | `cotizacion`, `progreso`, `finalizacion` |
| role | `user` o `assistant` |
| content | Texto en español |
| created_at | |

## Lo que no se modela aquí

- Prioridad Baja, Media o Alta de una novedad de campo. La sigue poniendo el supervisor.
- Decisión de autorizar el cierre o reasignar.
- Conteos de la ruta de operación normal.
- Cola offline del supervisor en Dexie. No se modifica.
