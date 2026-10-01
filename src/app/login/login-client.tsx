"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

const ROLES: {
  id: UserRole;
  title: string;
  roleTag: string;
  icon: string;
  desc: string;
  features: string[];
}[] = [
  {
    id: "supervisor",
    title: "Supervisor de Campo",
    roleTag: "PWA Móvil Offline",
    icon: "engineering",
    desc: "Interfaz optimizada para trabajo en territorio sin conexión: check-in, geocercas, checklist de tareas y captura de fotos con Dexie.js.",
    features: ["IndexedDB Offline", "Captura GPS", "Sync Supabase Storage"],
  },
  {
    id: "coordinador",
    title: "Coordinador de Operaciones",
    roleTag: "Consola de Escritorio",
    icon: "grid_view",
    desc: "Centro de control en tiempo real: monitoreo de cuadrillas, mapa de dispersión, bandeja de alertas críticas y métricas SLA.",
    features: ["Telemetría en Vivo", "Gestión de Alertas", "Auditoría Visitas"],
  },
  {
    id: "cliente",
    title: "Portal Cliente & IA",
    roleTag: "Multimodal Gemini",
    icon: "smart_toy",
    desc: "Asistente inteligente con 3 estados operativos: cotización instantánea, seguimiento de servicio y radicación de quejas con validación visual.",
    features: ["Gemini 1.5 Vision", "FastAPI Docker NLP", "Línea de Vida"],
  },
];

export default function LoginClient() {
  const { user, enterDemo } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  useEffect(() => {
    if (user) router.replace(next || `/${user.role}`);
  }, [next, router, user]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12 text-on-surface antialiased">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center max-w-md mb-8">
        <div className="w-12 h-12 rounded-xl bg-surface-card border border-border-subtle flex items-center justify-center p-2 mb-4 shadow-lg shadow-black/40">
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

        <p className="text-xs font-mono uppercase tracking-[0.25em] text-primary">
          FieldOps AI
        </p>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
          Ingreso por Perfil de Operación
        </h1>
        <p className="mt-2 text-xs md:text-sm text-text-secondary">
          Selecciona tu rol para ingresar en modo demo o conecta las credenciales
          corporativas de Supabase Auth.
        </p>
      </div>

      {/* Role Cards Grid */}
      <div className="grid w-full max-w-4xl gap-4 md:grid-cols-3">
        {ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => {
              enterDemo(role.id);
              router.push(next || `/${role.id}`);
            }}
            className="group relative rounded-xl bg-surface-container-low border border-border-subtle p-5 text-left hover:border-border-active hover:bg-surface-container transition-all flex flex-col justify-between shadow-sm cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-secondary px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/20">
                  {role.roleTag}
                </span>
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[18px]">
                    {role.icon}
                  </span>
                </div>
              </div>

              <h2 className="mt-4 text-base font-semibold text-text-primary group-hover:text-primary transition-colors">
                {role.title}
              </h2>
              <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                {role.desc}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-border-subtle flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                {role.features.map((feat) => (
                  <span
                    key={feat}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container text-text-muted"
                  >
                    {feat}
                  </span>
                ))}
              </div>
              <span className="text-xs font-semibold text-primary flex items-center gap-1 mt-2">
                Ingresar como {role.title} →
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 text-center text-xs font-mono text-text-muted">
        Modo Offline-First • Dexie.js + Supabase Edge Runtime
      </div>
    </div>
  );
}
