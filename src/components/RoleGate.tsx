"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

export function RoleGate({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=/${role}`);
      return;
    }
    if (user.role !== role) {
      router.replace(`/${user.role}`);
    }
  }, [loading, role, router, user]);

  if (loading || !user || user.role !== role) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        Verificando rol...
      </div>
    );
  }

  return <>{children}</>;
}
