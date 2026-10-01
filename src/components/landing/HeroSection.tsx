"use client";

import Image from "next/image";
import {
  ArrowRight,
  Bot,
  HardHat,
  LayoutDashboard,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "./BrandMark";

const APP_HIGHLIGHTS = [
  {
    icon: MapPin,
    title: "Control en territorio",
    body: "Cada visita queda georreferenciada con evidencia clara para tu operación y tus clientes.",
    tone: "text-primary bg-primary/15 border-primary/25",
  },
  {
    icon: ShieldCheck,
    title: "Cumplimiento visible",
    body: "Supervisa aseo, jardinería y mantenimiento con indicadores que hablan el idioma del negocio.",
    tone: "text-secondary bg-secondary/15 border-secondary/25",
  },
  {
    icon: Sparkles,
    title: "Atención con IA",
    body: "Cotiza, haz seguimiento y reporta novedades con un asistente que agiliza la experiencia del cliente.",
    tone: "text-ai-accent bg-ai-accent/15 border-ai-accent/25",
  },
];

const FOR_WHO = [
  {
    icon: HardHat,
    title: "Supervisores",
    color: "border-secondary/40 bg-secondary/5 hover:border-secondary",
    iconTone: "text-secondary bg-secondary/15",
    body: "App móvil pensada para el campo: registra visitas, captura fotos y trabaja aunque no haya señal.",
  },
  {
    icon: LayoutDashboard,
    title: "Coordinadores",
    color: "border-primary/40 bg-primary/5 hover:border-primary",
    iconTone: "text-primary bg-primary/15",
    body: "Centro de mando con mapas, alertas y visión en tiempo real del cumplimiento por sede.",
  },
  {
    icon: Bot,
    title: "Clientes",
    color: "border-ai-accent/40 bg-ai-accent/5 hover:border-ai-accent",
    iconTone: "text-ai-accent bg-ai-accent/15",
    body: "Portal conversacional para cotizar, seguir el servicio en vivo y recibir respuestas rápidas.",
  },
];

export function HeroSection({ onLogin }: { onLogin: () => void }) {
  return (
    <section id="inicio" className="relative overflow-hidden">
      {/* Hero principal */}
      <div className="relative min-h-[88svh] flex items-end md:items-center">
        <div className="absolute inset-0">
          <Image
            src="/stitch/supervisor_preview.png"
            alt="Supervisión de servicios en campo con LimpiAPP"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/92 to-surface/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface/55" />
          <div className="absolute inset-0 landing-grid opacity-35" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-5 pt-28 pb-14 md:py-24">
          <div className="max-w-2xl">
            <BrandMark size="lg" />

            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
              <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              Plataforma comercial para operaciones en campo
            </p>

            <h1 className="mt-6 font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-text-primary leading-[1.12]">
              La app que vende confianza en cada visita supervisada
            </h1>

            <p className="mt-5 text-base md:text-lg text-text-secondary max-w-xl leading-relaxed">
              LimpiAPP unifica supervisión, coordinación y atención al cliente en
              una sola experiencia. Menos incertidumbre en campo, más control
              operativo y mejor servicio para quien contrata.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all shadow-lg shadow-primary/30 hover:-translate-y-0.5"
              >
                Iniciar Sesión
                <ArrowRight size={16} />
              </button>
              <a
                href="#servicio"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border-muted bg-white/5 hover:bg-white/10 text-text-primary text-sm font-semibold transition-all"
              >
                Ver servicios
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Información comercial de la app (dentro de Inicio) */}
      <div className="relative border-t border-border-subtle bg-surface-container-lowest/80">
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">
              Sobre la aplicación
            </p>
            <h2 className="mt-2 font-display text-2xl md:text-3xl font-semibold text-text-primary">
              Una sola plataforma para operar, supervisar y atender
            </h2>
            <p className="mt-3 text-text-secondary leading-relaxed">
              LimpiAPP está pensada para empresas de servicios que necesitan
              demostrar cumplimiento, reducir fricción con el cliente y dar
              herramientas claras a quienes trabajan en territorio.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {APP_HIGHLIGHTS.map(({ icon: Icon, title, body, tone }) => (
              <div
                key={title}
                className="rounded-2xl border border-border-subtle bg-surface-container-low p-5 hover:border-border-active transition-colors"
              >
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${tone}`}
                >
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 font-semibold text-text-primary">{title}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <h3 className="font-display text-xl font-semibold text-text-primary">
              ¿Para quién es LimpiAPP?
            </h3>
            <p className="mt-2 text-sm text-text-secondary max-w-xl">
              Al iniciar sesión, entras directo al espacio que corresponde a tu rol.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {FOR_WHO.map(({ icon: Icon, title, body, color, iconTone }) => (
                <div
                  key={title}
                  className={`rounded-2xl border p-5 transition-all ${color}`}
                >
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconTone}`}
                  >
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <h4 className="mt-4 font-semibold text-text-primary">{title}</h4>
                  <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
