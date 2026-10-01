# Quickstart: Chat del cliente y ruta PQR

Guía de validación. No implementa el módulo.

## Prerequisites

- Node.js con las dependencias del repositorio instaladas (`npm install`).
- Docker, para el contenedor de clasificación.
- Supabase CLI, para la réplica local. No usar el proyecto remoto como sustituto.
- Variables en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NLP_SERVICE_URL=http://127.0.0.1:8000`. `GEMINI_API_KEY` solo si se quiere probar el diálogo real. Sin esa clave, la cotización debe fallar sin emitir código.

## Setup

```bash
npx supabase start
npx supabase db reset
npm run nlp
npm run dev
```

Comprobar el contenedor: `curl -s http://127.0.0.1:8000/health` devuelve `{"ok":true}`.

La primera clasificación puede tardar mientras carga el modelo. Repetir el health no basta; el primer `POST /classify` es el que lo descarga.

## Scenarios

Contratos de referencia: [client-chat.md](contracts/client-chat.md), [nlp-classify.md](contracts/nlp-classify.md), [pqr-queue.md](contracts/pqr-queue.md). Estados: [data-model.md](data-model.md).

1. **Cotización confirmada.** En `/cliente`, pedir Aseo General y Jardinería, con fecha, hora y ubicación. Responder que no al primer resumen y comprobar que no aparece código. Corregir y responder que sí. Debe aparecer un solo código `#…`. Recargar y volver a confirmar: el código no cambia.
2. **Cancelación.** Con el supervisor aún no en ruta, cancelar sin motivo: no queda cancelado. Elegir "cambio de planes": el código deja de verse como servicio activo.
3. **Mismo código en campo.** Consultar la solicitud en la réplica local. `service_number` es el del chat.
4. **Progreso.** Asignar un supervisor de prueba a esa solicitud y consultar el código. El chat dice asignado y muestra nombre e identificación. Poner `en_route_at` en la base y consultar de nuevo: dice en camino, y editar y cancelar no se ofrecen.
5. **Sin sincronizar.** Borrar o no crear la visita, dejar `en_route_at` puesto y consultar. El texto dice que la ejecución está pendiente de sincronización. No lista tareas.
6. **Cierre y PQR.** Marcar la visita con check-out, actividades y fotos. En el chat debe verse el aviso de cierre. Enviar 2 estrellas, un comentario de trabajo sucio y una foto. El coordinador, en su cola PQR, ve prioridad alta, una clase, el porcentaje de certeza, si la foto corresponde y el resumen. Enviar otro servicio con 5 estrellas: no entra en esa cola.
7. **Contenedor apagado.** Detener Docker, repetir una evaluación de 1 estrella con comentario. La ficha queda con clasificación pendiente y el caso de prioridad alta sí aparece.
8. **Regresión offline del supervisor.** En `/supervisor`, desactivar la red en DevTools, guardar un check-in y recargar. La visita sigue en el dispositivo. Este módulo no participa en ese guardado.
9. **Lint.** `npm run lint` termina sin advertencias.

## Expected result

Los escenarios 1 a 7 cubren las historias de [spec.md](spec.md). El 8 comprueba que el offline del supervisor no se rompió. El 9 es la condición de linter de la constitución.
