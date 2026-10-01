# Constitución de la PWA de Supervisión Inteligente de Servicios en Campo

## Core Principles

### I. Trazabilidad de la supervisión en campo

El producto MUST mejorar el control y la trazabilidad de las actividades de
supervisión en campo. Toda visita registrada MUST validarse con geolocalización
y evidencia fotográfica. Una actividad sin esas dos evidencias MUST NOT
considerarse una visita válida.

Rationale: la supervisión solo es auditable si el lugar y la prueba visual
quedan ligados al registro.

### II. Clean Architecture

La aplicación MUST separar de forma estricta la interfaz de usuario y la lógica
de datos. La UI MUST NOT acceder de forma directa a PostgreSQL, Storage,
IndexedDB ni a clientes de red. Esa lógica MUST vivir detrás de fronteras de
aplicación explícitas, de modo que la presentación dependa de casos de uso y no
de la infraestructura.

Rationale: el intercambio entre Supabase, Dexie.js y los servicios de IA queda
fuera de los componentes. Si se filtra, la UI queda acoplada a la infraestructura.

### III. Funcionamiento offline (NON-NEGOTIABLE)

El funcionamiento sin conectividad es obligatorio. La PWA MUST usar Service
Workers y Dexie.js (IndexedDB) para guardar de forma temporal las actividades y
las novedades capturadas en zonas sin red. La sincronización posterior MUST ser
estructurada, MUST conservar la integridad de la información y MUST impedir la
duplicidad de registros. Una captura hecha offline MUST sobrevivir al cierre
del navegador hasta que la sincronización termine con éxito.

Rationale: la supervisión ocurre en campo, donde la red no es confiable. Perder
o duplicar un registro rompe la trazabilidad.

### IV. Experiencias por rol

Cada rol MUST recibir solo la interfaz que le corresponde:

- Supervisor: UI móvil para registro de check-in y check-out, tareas y captura
  de fotos.
- Coordinador: UI de escritorio con panel de indicadores, historial y alertas
  de novedades.
- Cliente: chat de IA con exactamente tres estados.

La UI de un rol MUST NOT exponer las acciones de otro rol. El enrutamiento de
roles MUST apoyarse en Supabase Auth.

TODO(CLIENT_CHAT_STATES): los tres estados del chat del Cliente no fueron
nombrados en la ratificación. La especificación MUST definir sus nombres y
transiciones antes de implementar ese módulo.

### V. Estándares de código

El código fuente, los nombres de variables y los nombres de ramas MUST estar en
inglés. Los textos de interfaz MUST estar en español. Los componentes de React
MUST ser Functional Components. La lógica reutilizable de UI MUST extraerse a
Custom Hooks. Los class components MUST NOT usarse.

Rationale: un idioma distinto para código e interfaz evita mezclar
identificadores con copy y mantiene el stack de React en un solo estilo.

## Restricciones tecnológicas

El frontend MUST construirse con Next.js (App Router), React y Tailwind CSS.
El despliegue continuo del frontend MUST configurarse en Vercel, en el entorno
`juanrgnov`.

El backend MUST usar Supabase: Auth para el enrutamiento de roles, PostgreSQL,
Storage y Edge Functions.

La IA MUST usar la API de Gemini para visión y texto. La clasificación NLP de
quejas MUST ejecutarse en un microservicio Python (FastAPI y Sentence
Transformers) empaquetado en un contenedor Docker.

El desarrollo local MUST usar la Supabase CLI para réplicas locales aisladas.
MUST NOT desarrollarse contra el proyecto remoto de Supabase como sustituto de
esa réplica.

## Flujo de desarrollo y Definition of Done

El trabajo MUST centralizarse en el repositorio de GitHub de JuanDres7 y MUST
seguir Feature Branch Workflow. La rama `main` MUST estar protegida. Los
commits directos a `main` están prohibidos. La integración MUST hacerse solo
mediante Pull Request, con al menos un (1) approve.

Definition of Done. Un cambio MUST NOT integrarse en `main` hasta cumplir las
tres condiciones:

- El linter termina sin advertencias.
- La UI responsiva del rol afectado fue verificada.
- Las pruebas de captura de datos fueron validadas con la red deshabilitada
  manualmente desde DevTools.

## Governance

Esta constitución prevalece sobre prácticas locales que la contradigan. Toda
enmienda MUST proponerse en un Pull Request al repositorio de JuanDres7, MUST
actualizar la versión según el versionado semántico y MUST obtener al menos un
approve. Un cambio incompatible de un principio existente es MAJOR. Un
principio o una sección nueva, o una ampliación material, es MINOR. Una
aclaración de redacción sin cambio de obligación es PATCH.

Cada Pull Request MUST revisarse contra esta constitución, incluida la
Definition of Done, antes de aprobarse.

**Version**: 1.0.0 | **Ratified**: 2026-10-01 | **Last Amended**: 2026-10-01
