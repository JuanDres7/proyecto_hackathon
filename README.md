# CampoSync — Supervisión inteligente de servicios en campo

PWA única (Next.js App Router) con tres módulos por rol, almacenamiento offline y un microservicio de NLP.

## Stack

- Frontend PWA: Next.js, React, Tailwind CSS
- Offline: Dexie.js (IndexedDB) + Service Worker / Sync Worker
- Backend: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- IA: Gemini (texto y visión) vía `/api/gemini` y `supabase/functions/gemini-proxy`
- NLP: FastAPI + Sentence Transformers en Docker (`nlp-service`)

## Arranque rápido (demo sin nube)

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y entra como supervisor, coordinador o cliente. Sin claves, Gemini y NLP usan respuestas/clasificación de respaldo. Las visitas del supervisor viven en IndexedDB y se marcan sincronizadas cuando no hay Supabase.

## Docker (NLP)

```bash
docker compose up --build nlp
```

El proxy `/api/nlp` llama a `NLP_SERVICE_URL` (por defecto `http://127.0.0.1:8000`).

## Supabase local

```bash
npx supabase start
npx supabase db reset
```

Copia las keys a `.env.local` desde `.env.example`. El Sync Worker sube JSON a `visits` (deduplicado por `client_uuid`) y fotos al bucket `evidencias`.

Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `NLP_SERVICE_URL`

## Rutas

| Ruta | Rol |
| --- | --- |
| `/supervisor` | Visitas offline, check-in/out GPS, evidencias |
| `/coordinador` | Panel de visitas y alertas |
| `/cliente` | Chat público: cotización, seguimiento, cierre/quejas |
