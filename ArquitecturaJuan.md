# Arquitectura del Proyecto: Supervisión Inteligente de Servicios en Campo

Este documento define la arquitectura técnica de la solución tecnológica para el control, trazabilidad y gestión de visitas de supervisores en campo, integrando módulos de inteligencia artificial para la atención al cliente[cite: 1].

## 1. Pila Tecnológica (Tech Stack)

*   **Frontend (PWA):** Next.js (App Router), React, Tailwind CSS. Desplegado en Vercel.
*   **Almacenamiento Local (Offline):** Dexie.js (IndexedDB wrapper) y Service Workers.
*   **Backend & BaaS:** Supabase (PostgreSQL, Auth, Storage, Edge Functions).
*   **Inteligencia Artificial:** 
    *   API de Gemini (Texto y Visión Multimodal).
    *   Python + Sentence Transformers (NLP).
*   **Infraestructura de Desarrollo:** Docker (Supabase CLI local y Microservicio de IA).

## 2. Componentes de la Arquitectura

El sistema se consolida en una sola Progressive Web App (PWA) con enrutamiento basado en roles, resolviendo las necesidades operativas sin recurrir a múltiples repositorios.

### A. Módulo del Supervisor (Offline-First)
*   **Propósito:** Interfaz móvil que permite al supervisor verificar que las actividades contratadas se estén desarrollando correctamente e identificar novedades[cite: 1].
*   **Tecnología Offline:** Dado que la conexión a internet puede ser limitada o inexistente, la aplicación guarda toda la información localmente en Dexie.js[cite: 1].
*   **Validación de Visitas:** Se utilizan las APIs del navegador para obtener geolocalización, check-in, check-out y capturar evidencia fotográfica de forma offline[cite: 1].
*   **Sincronización:** Un "Sync Worker" detecta cuando se recupera la red y envía automáticamente las evidencias a Supabase Storage y los registros JSON a PostgreSQL, previniendo duplicidad[cite: 1].

### B. Módulo del Coordinador (Panel de Control)
*   **Propósito:** Interfaz de escritorio para que el coordinador consulte y analice la información centralizada[cite: 1].
*   **Funcionalidad:** Visualización en tiempo real del estado de las visitas, supervisores activos y alertas por novedades reportadas en campo[cite: 1].
*   **Conexión:** Se comunica directamente con la base de datos PostgreSQL de Supabase.

### C. Módulo de Cliente Público (Chatbot IA)
Una interfaz de chat dividida en tres estados condicionales controlados desde React para interactuar con la API de Gemini mediante Supabase Edge Functions (proxy de seguridad):
1.  **Estado 1 (Cotización):** Generación de cotizaciones interactivas y emisión de números de servicio tras simulación de pago.
2.  **Estado 2 (Seguimiento):** Consultas sobre el estado de un servicio en progreso utilizando el número de servicio.
3.  **Estado 3 (Cierre y Quejas):** Recepción de retroalimentación final o quejas acompañadas de fotos. La Edge Function invoca a Gemini Vision para validar que la imagen adjunta corresponda con el texto de la queja.

## 3. Microservicio IA y Contenedores (Docker)

Para garantizar un rendimiento óptimo tanto en desarrollo como en producción, Docker se implementa en dos áreas críticas:

1.  **Microservicio NLP en Python:** 
    *   El análisis semántico de las quejas (Estado 3 del chat) no se ejecuta en el navegador del cliente para evitar cuellos de botella.
    *   Se encapsula un modelo *sentence-transformer* (Hugging Face) mediante una API en Python (FastAPI/Flask) dentro de un contenedor Docker. 
    *   Este servicio clasifica la queja y genera un JSON estructurado que se inserta en la base de datos.
2.  **Entorno de Desarrollo Local:** 
    *   Para evitar conflictos entre los miembros del equipo durante la hackathon, se utiliza Supabase CLI (basado en Docker) para levantar réplicas locales de la base de datos, Storage y Auth.
    *   Esto permite probar el flujo offline de los supervisores y desarrollar sin depender de la nube hasta el momento del *push*.