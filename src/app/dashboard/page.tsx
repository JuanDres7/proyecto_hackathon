"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  HardHat,
  LayoutDashboard,
  LogOut,
  Map,
  MessageSquare,
  Radio,
  Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";
import { BrandMark } from "@/components/landing/BrandMark";

const MODULES: Record<
  UserRole,
  {
    href: string;
    title: string;
    subtitle: string;
    body: string;
    icon: typeof HardHat;
    accent: string;
    chip: string;
    features: { icon: typeof Map; label: string }[];
  }
> = {
  supervisor: {
    href: "/supervisor",
    title: "Módulo del Supervisor",
    subtitle: "PWA Móvil · Offline-first",
    body: "Registra visitas en territorio sin señal, valida geocercas, captura evidencias y sincroniza al recuperar conectividad.",
    icon: HardHat,
    accent: "from-secondary/20 to-transparent border-secondary/30",
    chip: "bg-secondary/15 text-secondary border-secondary/25",
    features: [
      { icon: Shield, label: "Check-in GPS" },
      { icon: Radio, label: "Sync automático" },
      { icon: Map, label: "Rutas en campo" },
    ],
  },
  coordinador: {
    href: "/coordinador",
    title: "Panel del Coordinador",
    subtitle: "Centro de mando · Telemetría",
    body: "Visualiza cuadrillas, mapas, alertas tempranas y el estado de cumplimiento de cada sede en tiempo real.",
    icon: LayoutDashboard,
    accent: "from-primary/20 to-transparent border-primary/30",
    chip: "bg-primary/15 text-primary border-primary/25",
    features: [
      { icon: Map, label: "Mapas territoriales" },
      { icon: Radio, label: "Telemetría en vivo" },
      { icon: Shield, label: "Gestión de alertas" },
    ],
  },
  cliente: {
    href: "/cliente",
    title: "Portal de Cliente + IA",
    subtitle: "Asistente · Cotización · Seguimiento",
    body: "Conversa con el asistente, cotiza servicios, sigue el avance con código único y reporta novedades con validación visual.",
    icon: Bot,
    accent: "from-ai-accent/20 to-transparent border-ai-accent/30",
    chip: "bg-ai-accent/15 text-ai-accent border-ai-accent/25",
    features: [
      { icon: MessageSquare, label: "Chat IA" },
      { icon: Shield, label: "Código único" },
      { icon: Radio, label: "Seguimiento en vivo" },
    ],
  },
};

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/?login=1");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-white/70 text-sm">
        Preparando tu panel…
      </div>
    );
  }

  const primary = MODULES[user.role];
  const PrimaryIcon = primary.icon;

  return (
    <div className="min-h-screen bg-surface text-on-surface landing-mesh antialiased">
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <Link href="/">
            <BrandMark size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-text-primary">{user.fullName}</p>
              <p className="text-xs text-text-muted capitalize">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push("/");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-muted text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
            >
              <LogOut size={14} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-10 md:py-14">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide">
            Panel de usuario
          </p>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
            Bienvenido, {user.fullName.split(" ")[0]}
          </h1>
          <p className="mt-3 text-text-secondary">
            Accede a tu módulo principal según tu rol. La navegación está
            organizada para que entres directo a la operación que te corresponde.
          </p>
        </div>

        {/* Primary module for role */}
        <Link
          href={primary.href}
          className={`mt-10 group block rounded-2xl border bg-gradient-to-br ${primary.accent} bg-surface-container-low p-6 md:p-8 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface/60 border border-border-subtle flex items-center justify-center text-text-primary">
                <PrimaryIcon size={24} strokeWidth={1.75} />
              </div>
              <div>
                <span
                  className={`inline-flex text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${primary.chip}`}
                >
                  Tu módulo
                </span>
                <h2 className="mt-2 font-display text-xl md:text-2xl font-semibold text-text-primary">
                  {primary.title}
                </h2>
                <p className="text-sm text-text-secondary mt-0.5">{primary.subtitle}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              Abrir módulo
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </span>
          </div>
          <p className="mt-5 text-sm text-text-secondary leading-relaxed max-w-2xl">
            {primary.body}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {primary.features.map(({ icon: FeatIcon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-xs text-text-secondary px-2.5 py-1 rounded-lg bg-surface/50 border border-border-subtle"
              >
                <FeatIcon size={12} />
                {label}
              </span>
            ))}
          </div>
        </Link>

      </main>
    </div>
  );
}
