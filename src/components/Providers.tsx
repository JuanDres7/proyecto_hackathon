"use client";

import { AuthProvider } from "@/lib/auth-context";
import { PwaRegister } from "@/components/PwaRegister";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PwaRegister />
      {children}
    </AuthProvider>
  );
}
