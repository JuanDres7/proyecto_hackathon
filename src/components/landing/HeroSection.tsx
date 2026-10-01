"use client";

import Image from "next/image";
import { ArrowRight, PlayCircle } from "lucide-react";
import { BrandMark } from "./BrandMark";

export function HeroSection({ onLogin }: { onLogin: () => void }) {
  return (
    <section
      id="inicio"
      className="relative min-h-[100svh] flex items-end md:items-center overflow-hidden"
    >
      {/* Full-bleed visual plane */}
      <div className="absolute inset-0">
        <Image
          src="/stitch/supervisor_preview.png"
          alt="Operaciones de supervisión en campo con FieldOps"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 to-surface/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface/50" />
        <div className="absolute inset-0 landing-grid opacity-40" />
        <div className="absolute right-[12%] top-[28%] w-40 h-40 rounded-full bg-primary/25 blur-3xl animate-soft-pulse pointer-events-none" />
        <div className="absolute left-[8%] bottom-[18%] w-32 h-32 rounded-full bg-secondary/20 blur-3xl animate-soft-pulse pointer-events-none" />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-5 pt-28 pb-16 md:py-28">
        <div className="max-w-2xl">
          <div className="animate-fade-up">
            <BrandMark size="lg" />
          </div>

          <h1 className="animate-fade-up-delay-1 mt-8 font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-text-primary leading-[1.15]">
            Supervisión inteligente de servicios en campo
          </h1>

          <p className="animate-fade-up-delay-2 mt-5 text-base md:text-lg text-text-secondary max-w-xl leading-relaxed">
            Trazabilidad operativa, control territorial y asistencia con IA para
            que cada visita en campo quede registrada, sincronizada y bajo control.
          </p>

          <div className="animate-fade-up-delay-3 mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onLogin}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-all shadow-lg shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5"
            >
              Iniciar Sesión
              <ArrowRight size={16} />
            </button>
            <a
              href="#servicios"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border-muted bg-white/5 hover:bg-white/10 text-text-primary text-sm font-semibold transition-all backdrop-blur-sm"
            >
              <PlayCircle size={16} className="text-secondary" />
              Conocer Soluciones
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
