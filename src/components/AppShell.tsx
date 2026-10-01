"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SyncStatus } from "./SyncStatus";
import type { UserRole } from "@/lib/types";

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user, signOut, enterDemo } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isSupervisorRoute = pathname.startsWith("/supervisor");

  return (
    <div className="min-h-screen bg-surface text-on-surface antialiased flex flex-col">
      {/* Top Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-surface/90 backdrop-blur-xl border-b border-border-subtle">
        <div className="w-full h-16 px-4 md:px-6 flex items-center justify-between gap-4">
          {/* Left: Logo & Brand */}
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
                  <circle cx="50" cy="50" r="4" fill="#38bdf8" />
                </svg>
              </div>
              <span className="text-base font-semibold text-text-primary tracking-tight">
                FieldOps{" "}
                <span className="text-primary font-mono text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                  AI
                </span>
              </span>
            </Link>

            <span className="text-xs font-mono text-text-muted hidden md:inline">
              / {title}
            </span>

            <div className="h-5 w-px bg-border-subtle hidden lg:block" />

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link
                href="/coordinador"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pathname.startsWith("/coordinador")
                    ? "bg-surface-container-high text-text-primary border border-border-muted"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-container"
                }`}
              >
                Dashboard Coordinador
              </Link>
              <Link
                href="/supervisor"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pathname.startsWith("/supervisor")
                    ? "bg-surface-container-high text-text-primary border border-border-muted"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-container"
                }`}
              >
                Supervisor PWA
              </Link>
              <Link
                href="/cliente"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pathname.startsWith("/cliente")
                    ? "bg-surface-container-high text-text-primary border border-border-muted"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-container"
                }`}
              >
                Portal Cliente IA
              </Link>
            </nav>
          </div>

          {/* Right: Telemetry, Role Switcher, Profile */}
          <div className="flex items-center gap-3">
            <SyncStatus />

            {/* Quick Role Switcher */}
            <div className="hidden md:flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-lg border border-border-subtle">
              <span className="text-[11px] font-mono text-text-muted uppercase">Rol:</span>
              <select
                value={user?.role ?? "invitado"}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  if (newRole) {
                    enterDemo(newRole);
                    router.push(`/${newRole}`);
                  }
                }}
                className="bg-transparent text-xs font-medium text-text-primary focus:outline-none cursor-pointer"
              >
                <option value="coordinador" className="bg-surface-popover text-text-primary">
                  Coordinador Ops
                </option>
                <option value="supervisor" className="bg-surface-popover text-text-primary">
                  Supervisor Campo
                </option>
                <option value="cliente" className="bg-surface-popover text-text-primary">
                  Cliente + IA
                </option>
              </select>
            </div>

            {/* User profile & Action */}
            <div className="flex items-center gap-2 pl-2 border-l border-border-subtle">
              <div className="hidden xl:flex flex-col items-end">
                <span className="text-xs font-medium text-text-primary">
                  {user?.fullName ?? "Usuario"}
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  {user?.role ? `ROL: ${user.role.toUpperCase()}` : "DEMO"}
                </span>
              </div>

              {/* User Avatar with initial / badge */}
              <div className="w-8 h-8 rounded-full bg-surface-container-high border border-border-subtle flex items-center justify-center text-primary text-xs font-bold">
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
              </div>

              {user ? (
                <button
                  type="button"
                  onClick={() => void signOut()}
                  title="Cerrar sesión"
                  className="p-1.5 text-text-muted hover:text-status-critical rounded-lg hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-xs font-medium hover:bg-primary-container transition-colors"
                >
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 pt-16">
        {/* Desktop Sidebar (visible on non-supervisor routes or widescreen) */}
        {!isSupervisorRoute && (
          <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 w-60 bg-surface-container-lowest border-r border-border-subtle z-40 flex-col justify-between p-4">
            <div className="flex flex-col gap-4">
              <div className="px-2">
                <p className="font-mono text-[11px] text-text-muted uppercase tracking-wider">
                  Centro de Control
                </p>
              </div>

              <nav className="flex flex-col gap-1">
                <Link
                  href="/coordinador"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    pathname.startsWith("/coordinador")
                      ? "bg-surface-container-high text-text-primary border border-border-subtle shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-container"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    grid_view
                  </span>
                  <span>Vista General Ops</span>
                </Link>

                <Link
                  href="/supervisor"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    pathname.startsWith("/supervisor")
                      ? "bg-surface-container-high text-text-primary border border-border-subtle shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-container"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">
                    engineering
                  </span>
                  <span>Módulo Supervisor</span>
                </Link>

                <Link
                  href="/cliente"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    pathname.startsWith("/cliente")
                      ? "bg-surface-container-high text-text-primary border border-border-subtle shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-container"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] text-ai-accent">
                    smart_toy
                  </span>
                  <span>Asistente Gemini & NLP</span>
                </Link>

                <Link
                  href="/login"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-text-muted">
                    switch_account
                  </span>
                  <span>Selector de Roles</span>
                </Link>
              </nav>
            </div>

            {/* Bottom Buffer Box */}
            <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-text-muted">Dexie.js Buffer</span>
                <span className="font-mono text-[10px] text-secondary font-semibold">
                  Almacenamiento Local
                </span>
              </div>
              <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
                <div className="bg-secondary h-full w-full"></div>
              </div>
              <p className="text-[10px] text-text-secondary">PWA Offline-First Activa</p>
            </div>
          </aside>
        )}

        {/* Content Area */}
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

      {/* Mobile Bottom Navigation Bar (especially for Supervisor PWA) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-surface-container-lowest/95 backdrop-blur-md border-t border-border-subtle flex items-center justify-around px-2 pb-safe">
        <Link
          href="/supervisor"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            pathname.startsWith("/supervisor")
              ? "text-primary font-semibold"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">assignment</span>
          <span>Visitas</span>
        </Link>
        <Link
          href="/coordinador"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            pathname.startsWith("/coordinador")
              ? "text-primary font-semibold"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">grid_view</span>
          <span>Dashboard</span>
        </Link>
        <Link
          href="/cliente"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            pathname.startsWith("/cliente")
              ? "text-ai-accent font-semibold"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">smart_toy</span>
          <span>Chat IA</span>
        </Link>
        <Link
          href="/login"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
            pathname === "/login"
              ? "text-secondary font-semibold"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">account_circle</span>
          <span>Rol</span>
        </Link>
      </nav>
    </div>
  );
}
