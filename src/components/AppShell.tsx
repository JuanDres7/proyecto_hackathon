"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SyncStatus } from "./SyncStatus";
import { BrandMark } from "./landing/BrandMark";
import type { UserRole } from "@/lib/types";

const ROLE_NAV: Record<
  UserRole,
  { href: string; label: string; icon: string; accent: string }[]
> = {
  coordinador: [
    {
      href: "/coordinador",
      label: "Panel",
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
  const showMobileNav = navItems.length > 0;

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased flex flex-col">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-surface/90 backdrop-blur-xl border-b border-border-subtle">
        <div className="w-full h-16 px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="shrink-0" aria-label="LimpiApp inicio">
              <BrandMark size="sm" />
            </Link>

            <span className="text-xs font-mono text-text-secondary hidden md:inline truncate">
              / {title}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
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

            <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-text-secondary">
                  Datos locales
                </span>
                <span className="font-mono text-[10px] text-secondary font-semibold">
                  Activo
                </span>
              </div>
              <p className="text-[10px] text-white/75 leading-snug">
                Puedes trabajar sin señal. Los datos se sincronizan después.
              </p>
            </div>
          </aside>
        )}

        <main
          className={`flex-1 w-full min-w-0 min-h-[calc(100vh-4rem)] bg-surface ${
            !isSupervisorRoute ? "lg:pl-60" : ""
          } ${
            showMobileNav
              ? "pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8"
              : "pb-8"
          }`}
        >
          <div className="w-full px-4 md:px-6 py-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {showMobileNav && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest/95 backdrop-blur-md border-t border-border-subtle flex items-stretch justify-around px-2 pt-1.5 pb-safe">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 min-w-0 px-2 py-1.5 text-[11px] font-medium leading-tight text-center transition-colors ${
                  active ? "text-primary font-semibold" : "text-white/70 hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="truncate max-w-full">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex flex-col items-center justify-center gap-1 min-w-0 px-2 py-1.5 text-[11px] font-medium leading-tight text-white/70 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Salir</span>
          </button>
        </nav>
      )}
    </div>
  );
}
