"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  HardHat,
  LayoutDashboard,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { roleHomePath } from "@/lib/role-routes";
import type { UserRole } from "@/lib/types";
import { BrandMark } from "@/components/landing/BrandMark";

const ROLES: {
  id: UserRole;
  title: string;
  roleTag: string;
  icon: typeof HardHat;
  desc: string;
  accent: string;
  badge: string;
}[] = [
  {
    id: "supervisor",
    title: "Supervisor de Campo",
    roleTag: "PWA Móvil Offline",
    icon: HardHat,
    desc: "Check-in GPS, evidencias fotográficas y sincronización automática cuando recuperas señal.",
    accent: "hover:border-secondary group-hover:text-secondary",
    badge: "bg-secondary/10 text-secondary border-secondary/20",
  },
  {
    id: "coordinador",
    title: "Coordinador de Operaciones",
    roleTag: "Centro de mando",
    icon: LayoutDashboard,
    desc: "Telemetría en vivo, mapa territorial, alertas críticas y métricas de cumplimiento.",
    accent: "hover:border-primary group-hover:text-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  {
    id: "cliente",
    title: "Portal Cliente & IA",
    roleTag: "Asistente Gemini",
    icon: Bot,
    desc: "Cotización, seguimiento con código único y novedades con validación visual por IA.",
    accent: "hover:border-ai-accent group-hover:text-ai-accent",
    badge: "bg-ai-accent/10 text-ai-accent border-ai-accent/20",
  },
];

export default function LoginClient() {
  const { user, enterDemo, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  useEffect(() => {
    if (user) router.replace(next || roleHomePath(user.role));
  }, [next, router, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-text-secondary gap-2">
        <Loader2 className="animate-spin" size={18} />
        Cargando sesión…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center landing-mesh px-4 py-12 text-on-surface antialiased">
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center text-center mb-10">
          <Link href="/" className="mb-6">
            <BrandMark size="md" />
          </Link>
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-text-primary tracking-tight">
            Acceso a la plataforma
          </h1>
          <p className="mt-2 text-sm md:text-base text-text-secondary max-w-lg">
            Selecciona tu rol y entra directo a supervisor, coordinador o portal
            de cliente según tu perfil.
          </p>
        </div>

        <div className="grid w-full gap-4 md:grid-cols-3">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  enterDemo(role.id);
                  router.push(next || roleHomePath(role.id));
                }}
                className={`group relative rounded-2xl bg-surface-container-low/90 border border-border-subtle p-5 text-left transition-all flex flex-col justify-between shadow-sm hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 ${role.accent}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${role.badge}`}
                    >
                      {role.roleTag}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-text-primary group-hover:scale-110 transition-transform">
                      <Icon size={18} strokeWidth={1.75} />
                    </div>
                  </div>

                  <h2 className="mt-4 text-base font-semibold text-text-primary transition-colors">
                    {role.title}
                  </h2>
                  <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                    {role.desc}
                  </p>
                </div>

                <span className="mt-6 pt-4 border-t border-border-subtle text-xs font-semibold text-primary flex items-center gap-1.5">
                  Continuar
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-text-muted">
          <Link href="/" className="hover:text-primary transition-colors">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
