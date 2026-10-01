"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authenticateSeed } from "./seed-users";
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
      if (raw) {
        if (active) {
          const session = JSON.parse(raw) as SessionUser;
          setUser(session);
          setLoading(false);
          void fetch("/api/session", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: session.id,
              role: session.role,
              fullName: session.fullName,
              email: session.email,
            }),
          });
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
    const next = authenticateSeed(email, password);
    if (!next) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: next.id,
          role: next.role,
          fullName: next.fullName,
          email: next.email,
        }),
      });
      if (!response.ok) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    setUser(next);
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
