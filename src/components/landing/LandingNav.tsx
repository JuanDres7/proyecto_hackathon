"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandMark } from "./BrandMark";

const LINKS = [
  { href: "#inicio", label: "Inicio" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#servicio", label: "Servicio" },
  { href: "#contacto", label: "Contacto" },
];

export function LandingNav({ onLogin }: { onLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-surface/85 backdrop-blur-xl border-b border-border-subtle shadow-lg shadow-black/20"
          : "bg-surface/40 backdrop-blur-md border-b border-border-subtle/50"
      }`}
    >
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
        <a href="#inicio" className="shrink-0" aria-label="FieldOps inicio">
          <BrandMark size="sm" />
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm text-text-secondary hover:text-primary transition-colors rounded-lg hover:bg-primary/10"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold transition-colors shadow-md shadow-primary/25"
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/5"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border-subtle bg-surface/95 backdrop-blur-xl px-5 py-4 flex flex-col gap-1">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 text-sm text-text-secondary hover:text-primary rounded-lg hover:bg-primary/10"
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogin();
            }}
            className="mt-2 px-3 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold text-left"
          >
            Iniciar Sesión
          </button>
        </div>
      )}
    </header>
  );
}
