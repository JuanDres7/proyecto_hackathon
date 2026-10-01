"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  HardHat,
  LayoutDashboard,
  Loader2,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { roleHomePath } from "@/lib/role-routes";
import type { UserRole } from "@/lib/types";
import { BrandMark } from "./BrandMark";

const ROLES: {
  id: UserRole;
  title: string;
  hint: string;
  icon: typeof HardHat;
  accent: string;
}[] = [
  {
    id: "supervisor",
    title: "Supervisor",
    hint: "Visitas en campo",
    icon: HardHat,
    accent: "border-secondary/40 hover:border-secondary data-[active=true]:border-secondary data-[active=true]:bg-secondary/10",
  },
  {
    id: "coordinador",
    title: "Coordinador",
    hint: "Centro de mando",
    icon: LayoutDashboard,
    accent: "border-primary/40 hover:border-primary data-[active=true]:border-primary data-[active=true]:bg-primary/10",
  },
  {
    id: "cliente",
    title: "Cliente",
    hint: "Atención con IA",
    icon: Bot,
    accent: "border-ai-accent/40 hover:border-ai-accent data-[active=true]:border-ai-accent data-[active=true]:bg-ai-accent/10",
  },
];

export function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { enterDemo, user } = useAuth();
  const router = useRouter();
  const titleId = useId();
  const [role, setRole] = useState<UserRole>("supervisor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && user) {
      onClose();
      router.push(roleHomePath(user.role));
    }
  }, [open, user, onClose, router]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Frontend-only demo auth: credentials optional; role drives access.
    window.setTimeout(() => {
      enterDemo(role);
      setLoading(false);
      onClose();
      router.push(roleHomePath(role));
    }, 350);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
        aria-label="Cerrar"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl border border-border-muted bg-surface-container-low shadow-2xl shadow-black/40 animate-fade-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <BrandMark size="sm" />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5"
            aria-label="Cerrar diálogo"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <h2 id={titleId} className="font-display text-xl font-semibold text-text-primary">
              Iniciar sesión
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Elige tu rol e ingresa. Te llevamos directo a la página que te corresponde.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(({ id, title, hint, icon: Icon, accent }) => (
              <button
                key={id}
                type="button"
                data-active={role === id}
                onClick={() => setRole(id)}
                className={`min-w-0 rounded-xl border bg-surface/40 px-2 py-3 text-left transition-all ${accent}`}
              >
                <Icon size={18} className="text-text-primary mb-2" />
                <span className="block text-xs font-semibold text-text-primary break-words">
                  {title}
                </span>
                <span className="block text-[10px] text-text-muted mt-0.5 leading-tight break-words">
                  {hint}
                </span>
              </button>
            ))}
          </div>

          <label className="block text-sm">
            <span className="text-text-secondary">Correo</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              className="mt-1.5 w-full rounded-xl border border-border-muted bg-surface px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          <label className="block text-sm">
            <span className="text-text-secondary">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-border-muted bg-surface px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-70 text-on-primary text-sm font-semibold transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Accediendo…
              </>
            ) : (
              "Entrar a mi espacio"
            )}
          </button>

          <p className="text-[11px] text-text-muted text-center">
            Demo frontend: el rol seleccionado define el acceso. Credenciales opcionales.
          </p>
        </form>
      </div>
    </div>
  );
}
