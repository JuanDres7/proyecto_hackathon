"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { SyncStatus } from "./SyncStatus";

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <header className="bg-[#0b1f3a] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <Link href="/" className="text-xs uppercase tracking-[0.2em] text-teal-300">
              CampoSync
            </Link>
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            {user?.role === "supervisor" ? <SyncStatus /> : null}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-300">{user?.fullName ?? "Invitado"}</span>
              {user ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="rounded bg-white/10 px-3 py-1 hover:bg-white/20"
                >
                  Salir
                </button>
              ) : (
                <Link href="/login" className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
