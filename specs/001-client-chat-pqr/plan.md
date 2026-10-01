# Implementation Plan: Chat del cliente y ruta PQR del coordinador

**Branch**: `001-client-chat-pqr` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-client-chat-pqr/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

El cliente conversa en tres fases (cotización, progreso y finalización) y, al evaluar, el coordinador recibe una ficha clasificada. Si hay menos de 3 estrellas, se abre un caso de prioridad alta. Gemini lleva el diálogo de cotización, el resumen y la visión, siempre detrás de una ruta de servidor. El código de servicio y el estado de la visita los calcula el sistema. La clasificación del comentario la hace el microservicio Python que ya vive en Docker.

## Technical Context

**Language/Version**: TypeScript con Next.js 16.3 y React 19. Python 3.11 en el contenedor de clasificación.

**Primary Dependencies**: App Router, Tailwind CSS, API de Gemini (`gemini-2.0-flash`, ya usada en `src/app/api/gemini/route.ts`), FastAPI y `paraphrase-multilingual-MiniLM-L12-v2` en `nlp-service/`, cliente de Supabase.

**Storage**: PostgreSQL y bucket `evidencias` de Supabase. Dexie.js no se usa en este módulo y no se modifica.

**Testing**: `npm run lint`. No hay runner de pruebas en el repositorio. La validación de comportamiento es [quickstart.md](quickstart.md).

**Target Platform**: PWA en Vercel, entorno `juanrgnov`. Clasificación en Docker. Réplica local con Supabase CLI.

**Project Type**: Aplicación web con un servicio HTTP interno de clasificación.

**Performance Goals**: La cotización cabe en los 5 minutos de la spec. Una consulta de progreso responde al leer la base, sin esperar al modelo. La primera clasificación puede tardar mientras el contenedor carga el modelo; las siguientes, por debajo de 15 segundos.

**Constraints**: El supervisor no llama a la IA y sigue guardando visitas sin red. La UI no llama a Gemini, al contenedor ni a PostgreSQL. El modelo no emite códigos, horas, GPS ni estados. Textos de interfaz en español. Identificadores de código en inglés. Componentes funcionales y hooks.

**Scale/Scope**: Un chat de tres fases, una cola PQR y seis clases de comentario. Volumen de demo de hackathon, un contenedor NLP.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Trazabilidad**: Pasa. El progreso y las fotos de antes y después se leen de la visita sincronizada. El código lo emite la base. Esta función no da por válida una visita sin GPS y foto; eso sigue en el módulo de campo.
- **Clean Architecture**: Pasa. `ClientChat` y la cola del coordinador solo usan hooks. Los hooks llaman a rutas de Next.js. Esas rutas llaman a Gemini, al contenedor y a Supabase.
- **Offline**: Pasa. No se añade IA al dispositivo del supervisor ni se bloquea el guardado en Dexie. El chat del cliente requiere red; si el asistente no responde, no se inventa un código.
- **Roles**: Pasa. El cliente ve el chat de tres fases: cotización, progreso y finalización. El coordinador ve la cola PQR en escritorio. El supervisor no entra a este chat. Con esto quedan nombrados los tres estados que la constitución dejó pendientes.
- **Código**: Pasa. Columnas, rutas y hooks en inglés. Copy en español. Sin class components.
- **Stack**: Pasa. Next.js, Supabase local, Gemini para texto y visión, clasificación en Docker con FastAPI y Sentence Transformers.

No hay violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/001-client-chat-pqr/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── client-chat.md
│   ├── nlp-classify.md
│   └── pqr-queue.md
└── tasks.md             # lo crea /speckit-tasks, no este comando
```

### Source Code (repository root)

```text
src/app/cliente/page.tsx
src/app/coordinador/page.tsx
src/app/api/client-chat/route.ts
src/app/api/pqr/route.ts
src/app/api/nlp/route.ts
src/components/ClientChat.tsx
src/components/PqrQueue.tsx
src/hooks/useClientChat.ts
src/hooks/usePqrQueue.ts
src/lib/client-chat/
nlp-service/
docker-compose.yml
supabase/migrations/
```

**Structure Decision**: Se extiende la PWA que ya está en `src/`. La lógica de fases, código y estrellas vive en `src/lib/client-chat/`, no en los componentes. El contenedor sigue en `nlp-service/` y se arranca con `npm run nlp`. `src/app/api/gemini/route.ts` deja de ser la puerta del chat: sus reglas que inventan un `SRV-` no se reutilizan. La Edge Function `supabase/functions/gemini-proxy` no entra en este flujo.

## Complexity Tracking

No hay violaciones de la constitución que justificar.

## Phase 0

Investigación cerrada en [research.md](research.md). No quedan `NEEDS CLARIFICATION`.

Decisiones que fija el diseño:

- Clasificación solo en el contenedor Docker existente, con frases ejemplo en español para las seis clases.
- Una ruta de servidor hacia Gemini. Sin clave, no hay código inventado.
- Secuencia de PostgreSQL para el `#servicio`.
- Progreso por plantilla, calculado en el servidor.
- Caso de prioridad alta solo si las estrellas son 1 o 2, aunque el contenedor esté caído.

## Phase 1

- Modelo de datos: [data-model.md](data-model.md). Añade columnas a `service_orders` y `complaints`, `service_number` en `visits`, y las tablas `pqr_cases` y `chat_turns`. `en_route_at` lo escribe el módulo de campo; aquí solo se lee.
- Contratos: [contracts/client-chat.md](contracts/client-chat.md), [contracts/nlp-classify.md](contracts/nlp-classify.md), [contracts/pqr-queue.md](contracts/pqr-queue.md).
- Validación: [quickstart.md](quickstart.md).

## Constitution Check (after design)

Se vuelven a cumplir las mismas puertas. El diseño no mueve la clasificación al navegador, no deja que Gemini emita el código ni el estado, y no toca la cola offline del supervisor. La cola PQR no calcula los indicadores de la ruta de operación normal ni decide el cierre de una novedad de campo.
