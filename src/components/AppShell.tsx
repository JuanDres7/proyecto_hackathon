"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SyncStatus } from "./SyncStatus";
import type { UserRole } from "@/lib/types";

const ROLE_NAV: Record<
  UserRole,
  { href: string; label: string; icon: string; accent: string }[]
> = {
  coordinador: [
    {
      href: "/coordinador",
      label: "Vista General Ops",
      icon: "grid_view",
      accent: "text-primary",
    },
  ],
  supervisor: [
    {
      href: "/supervisor",
      label: "Mis visitas",
      icon: "assignment",
      accent: "text-secondary",
    },
  ],
  cliente: [
    {
      href: "/cliente",
      label: "Asistente IA",
      icon: "smart_toy",
      accent: "text-ai-accent",
    },
  ],
};

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const role = user?.role;
  const isSupervisorRoute = pathname.startsWith("/supervisor");
  const navItems = role ? ROLE_NAV[role] : [];

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-surface/90 backdrop-blur-xl border-b border-border-subtle">
        <div className="w-full h-16 px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-surface-card border border-border-subtle flex items-center justify-center p-1 group-hover:border-primary transition-colors">
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
                  <circle cx="50" cy="50" r="4" fill="#34d399" />
                </svg>
              </div>
              <span className="text-base font-semibold text-white tracking-tight">
                Limpi<span className="text-primary">APP</span>
              </span>
            </Link>

            <span className="text-xs font-mono text-text-secondary hidden md:inline">
              / {title}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <SyncStatus />

            <div className="flex items-center gap-2 pl-2 border-l border-border-subtle">
              <div className="hidden xl:flex flex-col items-end">
                <span className="text-xs font-medium text-white">
                  {user?.fullName ?? "Usuario"}
                </span>
                <span className="text-[10px] font-mono text-text-secondary">
                  {user?.role ? `ROL: ${user.role.toUpperCase()}` : "DEMO"}
                </span>
              </div>

              <div className="w-8 h-8 rounded-full bg-surface-container-high border border-border-subtle flex items-center justify-center text-primary text-xs font-bold">
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
              </div>

              {user ? (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  title="Cerrar sesión"
                  className="p-1.5 text-text-secondary hover:text-status-critical rounded-lg hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              ) : (
                <Link
                  href="/?login=1"
                  className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-xs font-medium hover:bg-primary-container transition-colors"
                >
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        {!isSupervisorRoute && (
          <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-60 bg-surface-container-lowest border-r border-border-subtle z-40 flex-col justify-between p-4">
            <div className="flex flex-col gap-4">
              <div className="px-2">
                <p className="font-mono text-[11px] text-white/70 uppercase tracking-wider">
                  Centro de Control
                </p>
              </div>

              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        active
                          ? "bg-surface-container-high text-white border border-border-subtle shadow-sm"
                          : "text-white/80 hover:text-white hover:bg-surface-container"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[18px] ${item.accent}`}
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-text-secondary">
                  Buffer local
                </span>
                <span className="font-mono text-[10px] text-secondary font-semibold">
                  Offline-ready
                </span>
              </div>
              <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
                <div className="bg-secondary h-full w-full" />
              </div>
              <p className="text-[10px] text-white/75">PWA Offline-First activa</p>
            </div>
          </aside>
        )}

        <main
          className={`flex-1 w-full min-h-[calc(100vh-4rem)] bg-surface ${
            !isSupervisorRoute ? "lg:pl-60" : ""
          } ${isSupervisorRoute ? "pb-20" : "pb-8"}`}
        >
          <div className="w-full px-4 md:px-6 py-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav: only current role */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-surface-container-lowest/95 backdrop-blur-md border-t border-border-subtle flex items-center justify-around px-2 pb-safe">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
                active ? "text-primary font-semibold" : "text-white/70 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="flex flex-col items-center gap-1 text-[11px] font-medium text-white/70 hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Salir</span>
        </button>
      </nav>
    </div>
  );
}
