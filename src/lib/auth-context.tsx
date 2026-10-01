"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient, isSupabaseConfigured } from "./supabase/client";
import type { SessionUser, UserRole } from "./types";

const STORAGE_KEY = "campo.session";

const DEMO_USERS: Record<UserRole, SessionUser> = {
  supervisor: {
    id: "demo-supervisor",
    email: "supervisor@campo.local",
    fullName: "Ana Supervisor",
    role: "supervisor",
    demo: true,
  },
  coordinador: {
    id: "demo-coordinador",
    email: "coordinador@campo.local",
    fullName: "Carlos Coordinador",
    role: "coordinador",
    demo: true,
  },
  cliente: {
    id: "demo-cliente",
    email: "cliente@campo.local",
    fullName: "Cliente público",
    role: "cliente",
    demo: true,
  },
};

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  supabaseReady: boolean;
  enterDemo: (role: UserRole) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionUser;
      const timer = window.setTimeout(() => {
        setUser(parsed);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const supabase = createClient();
    if (!supabase) {
      const timer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(timer);
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", data.user.id)
          .maybeSingle();
        setUser({
          id: data.user.id,
          email: data.user.email ?? "",
          fullName: profile?.full_name ?? "Usuario",
          role: (profile?.role as UserRole) ?? "supervisor",
          demo: false,
        });
      }
      setLoading(false);
    });
  }, []);

  const enterDemo = useCallback((role: UserRole) => {
    const next = DEMO_USERS[role];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    const supabase = createClient();
    await supabase?.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, supabaseReady, enterDemo, signOut }),
    [user, loading, supabaseReady, enterDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
