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

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  supabaseReady: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    let active = true;

    async function initAuth() {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored = raw ? (JSON.parse(raw) as SessionUser) : null;
      if (stored?.demo || stored?.id.startsWith("demo-")) {
        if (active) {
          setUser(stored);
          setLoading(false);
        }
        const restored = await fetch("/api/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: stored.id }),
        });
        if (!active) return;
        if (!restored.ok) {
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
          return;
        }
        const json = (await restored.json()) as { user?: SessionUser };
        if (json.user) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(json.user));
          setUser(json.user);
        }
        return;
      }

      const supabase = createClient();
      if (!supabase) {
        if (active) setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (data.user && active) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", data.user.id)
          .maybeSingle();

        if (active) {
          setUser({
            id: data.user.id,
            email: data.user.email ?? "",
            fullName: profile?.full_name ?? "Usuario",
            role: (profile?.role as UserRole) ?? "supervisor",
            demo: false,
          });
        }
      }
      if (active) setLoading(false);
    }

    void initAuth();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createClient();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", data.user.id)
          .maybeSingle();
        const next: SessionUser = {
          id: data.user.id,
          email: data.user.email ?? email,
          fullName: profile?.full_name ?? "Usuario",
          role: (profile?.role as UserRole) ?? "supervisor",
          demo: false,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setUser(next);
        return true;
      }
      await supabase.auth.signOut();
    }

    const res = await fetch("/api/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { user?: SessionUser };
    if (!json.user) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(json.user));
    setUser(json.user);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    await fetch("/api/session", { method: "DELETE", credentials: "include" });
    const supabase = createClient();
    await supabase?.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, supabaseReady, signIn, signOut }),
    [user, loading, supabaseReady, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
