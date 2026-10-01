"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { roleHomePath } from "@/lib/role-routes";
import { DEMO_PASSWORD, SEED_USERS } from "@/lib/seed-users";
import { BrandMark } from "./BrandMark";

export function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { signIn, user } = useAuth();
  const router = useRouter();
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const ok = await signIn(email, password);
    setLoading(false);
    if (!ok) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    const signed = SEED_USERS.find((item) => item.email === email.trim().toLowerCase());
    onClose();
    if (signed) router.push(roleHomePath(signed.role));
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
              Ingresa con tu correo. Cada cuenta abre el espacio que le corresponde.
            </p>
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

          {error ? (
            <p className="text-sm text-status-warning" role="alert">
              {error}
            </p>
          ) : null}

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

          <div className="rounded-xl border border-border-subtle bg-surface/50 px-3 py-2 text-[11px] leading-relaxed text-text-muted">
            <p className="font-medium text-text-secondary">Cuentas para la presentación</p>
            <p className="mt-1">Contraseña: {DEMO_PASSWORD}</p>
            <ul className="mt-1 space-y-0.5">
              {SEED_USERS.map((account) => (
                <li key={account.id}>
                  {account.fullName}: {account.email}
                </li>
              ))}
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
}
