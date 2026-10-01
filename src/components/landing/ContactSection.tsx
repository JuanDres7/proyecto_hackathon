"use client";

import { Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";

export function ContactSection() {
  const [sent, setSent] = useState(false);

  return (
    <section id="contacto" className="relative py-20 md:py-28 bg-surface-container-lowest/50">
      <div className="max-w-6xl mx-auto px-5">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-start">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              Contacto
            </p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
              Hablemos de tu operación
            </h2>
            <p className="mt-4 text-text-secondary text-base leading-relaxed">
              Cuéntanos sobre tus sedes, cuadrillas y servicios. Te orientamos
              para desplegar supervisión inteligente con trazabilidad de punta a punta.
            </p>

            <ul className="mt-8 space-y-4">
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <span className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Mail size={16} />
                </span>
                contacto@fieldops.ai
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <span className="w-9 h-9 rounded-lg bg-secondary/15 text-secondary flex items-center justify-center">
                  <Phone size={16} />
                </span>
                +57 (1) 555-0142
              </li>
              <li className="flex items-center gap-3 text-sm text-text-secondary">
                <span className="w-9 h-9 rounded-lg bg-ai-accent/15 text-ai-accent flex items-center justify-center">
                  <MapPin size={16} />
                </span>
                Operaciones nacionales · Cobertura multi-sede
              </li>
            </ul>
          </div>

          <form
            className="rounded-2xl border border-border-subtle bg-surface-container-low p-6 md:p-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-text-secondary">Nombre</span>
                <input
                  required
                  name="name"
                  className="mt-1.5 w-full rounded-xl border border-border-muted bg-surface px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Tu nombre"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-secondary">Empresa</span>
                <input
                  name="company"
                  className="mt-1.5 w-full rounded-xl border border-border-muted bg-surface px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Organización"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-text-secondary">Correo</span>
              <input
                required
                type="email"
                name="email"
                className="mt-1.5 w-full rounded-xl border border-border-muted bg-surface px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="tu@empresa.com"
              />
            </label>
            <label className="block text-sm">
              <span className="text-text-secondary">Mensaje</span>
              <textarea
                required
                name="message"
                rows={4}
                className="mt-1.5 w-full rounded-xl border border-border-muted bg-surface px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                placeholder="¿Qué servicios u operación necesitas controlar?"
              />
            </label>

            <button
              type="submit"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-colors"
            >
              <Send size={16} />
              Enviar mensaje
            </button>

            {sent && (
              <p className="text-sm text-secondary" role="status">
                Gracias. Recibimos tu mensaje (demo frontend). Te contactaremos pronto.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
