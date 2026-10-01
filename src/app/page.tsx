import Link from "next/link";

const modules = [
  {
    href: "/supervisor",
    role: "supervisor",
    code: "MOD-A",
    icon: "engineering",
    color: "secondary",
    title: "Módulo del Supervisor",
    subtitle: "PWA Móvil Offline-First",
    body: "Diseñado para territorio sin señal. Almacenamiento local en Dexie.js (IndexedDB), check-in con validación GPS, captura de evidencias fotográficas y sincronización automática con Supabase.",
    metrics: ["IndexedDB Activo", "GPS RTK Lock", "Sync Worker"],
  },
  {
    href: "/coordinador",
    role: "coordinador",
    code: "MOD-B",
    icon: "grid_view",
    color: "primary",
    title: "Panel del Coordinador",
    subtitle: "Centro de Mando & Telemetría",
    body: "Visualización en tiempo real del estado de cuadrillas, mapa de dispersión territorial, alertas tempranas de incidentes, trazabilidad de visitas y métricas operativas de SLA.",
    metrics: ["Tiempo Real", "Monitoreo Geográfico", "Gestión de Alertas"],
  },
  {
    href: "/cliente",
    role: "cliente",
    code: "MOD-C",
    icon: "smart_toy",
    color: "ai-accent",
    title: "Portal de Cliente + IA",
    subtitle: "Atención Multimodal Gemini",
    body: "Chat inteligente con tres estados operativos: cotización algorítmica, seguimiento en vivo del servicio asignado y recepción de novedades con validación visual por Gemini Vision + NLP.",
    metrics: ["Gemini 1.5 Pro", "FastAPI NLP", "3 Estados Chat"],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased flex flex-col justify-between">
      {/* Top Bar */}
      <header className="h-16 border-b border-border-subtle bg-surface/90 backdrop-blur-xl px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-card border border-border-subtle flex items-center justify-center p-1">
            <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
              <path
                d="M26 50L42 66L74 34"
                stroke="#3b82f6"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="50"
                cy="50"
                r="32"
                stroke="#60a5fa"
                strokeWidth="4"
                strokeDasharray="8 6"
                opacity="0.6"
              />
              <circle cx="50" cy="50" r="4" fill="#38bdf8" />
            </svg>
          </div>
          <span className="text-base font-semibold text-text-primary tracking-tight">
            FieldOps{" "}
            <span className="text-primary font-mono text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
              AI
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-surface-container rounded-full border border-border-subtle">
            <span className="w-2 h-2 rounded-full bg-status-online animate-pulse" />
            <span className="font-mono text-xs text-text-secondary">PWA Ready</span>
          </div>
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-medium transition-colors"
          >
            Iniciar Sesión
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-border-subtle w-fit mb-6">
          <span className="w-2 h-2 rounded-full bg-secondary"></span>
          <span className="text-xs font-mono text-text-secondary uppercase tracking-widest">
            FieldOps Dark Precision System
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-text-primary max-w-3xl leading-tight">
          Supervisión Inteligente de Servicios en Campo
        </h1>
        <p className="mt-4 text-base md:text-lg text-text-secondary max-w-2xl leading-relaxed">
          Plataforma unificada PWA con arquitectura limpia y enrutamiento por roles.
          Garantiza trazabilidad territorial offline-first, monitoreo en tiempo real y asistencia
          multimodal con Inteligencia Artificial.
        </p>

        {/* System telemetry pills */}
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-surface-container border border-border-subtle text-text-muted">
            Next.js App Router
          </span>
          <span className="px-2.5 py-1 rounded-md bg-surface-container border border-border-subtle text-secondary">
            Dexie.js Offline
          </span>
          <span className="px-2.5 py-1 rounded-md bg-surface-container border border-border-subtle text-primary">
            Supabase Edge & PG
          </span>
          <span className="px-2.5 py-1 rounded-md bg-surface-container border border-border-subtle text-ai-accent">
            Gemini Multimodal Vision
          </span>
          <span className="px-2.5 py-1 rounded-md bg-surface-container border border-border-subtle text-tertiary">
            Sentence Transformers
          </span>
        </div>

        {/* Module Bento Grid */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {modules.map((mod) => (
            <Link
              key={mod.code}
              href={`/login?next=${mod.href}`}
              className="group relative rounded-xl bg-surface-container-low border border-border-subtle p-6 hover:border-border-active hover:bg-surface-container transition-all flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted px-2 py-0.5 rounded bg-surface-container-highest">
                    {mod.code}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">
                      {mod.icon}
                    </span>
                  </div>
                </div>

                <h2 className="mt-4 text-lg font-semibold text-text-primary group-hover:text-primary transition-colors">
                  {mod.title}
                </h2>
                <p className="text-xs font-mono text-secondary mt-0.5">
                  {mod.subtitle}
                </p>
                <p className="mt-3 text-xs text-text-secondary leading-relaxed">
                  {mod.body}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border-subtle flex flex-wrap gap-1.5">
                {mod.metrics.map((m) => (
                  <span
                    key={m}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container text-text-muted"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="border-t border-border-subtle bg-surface-container-lowest py-4 px-6 text-center text-xs text-text-muted font-mono">
        FieldOps AI • Arquitectura Limpia PWA • Hackathon Edition
      </footer>
    </div>
  );
}
