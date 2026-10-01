"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";

const ROLES: { id: UserRole; title: string; desc: string }[] = [
  {
    id: "supervisor",
    title: "Supervisor",
    desc: "PWA móvil offline-first: visitas, GPS y evidencias.",
  },
  {
    id: "coordinador",
    title: "Coordinador",
    desc: "Panel de escritorio con estado, supervisores y alertas.",
  },
  {
    id: "cliente",
    title: "Cliente",
    desc: "Chat público: cotizar, seguir y quejas con IA.",
  },
];

export default function LoginClient() {
  const { user, enterDemo } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  useEffect(() => {
    if (user) router.replace(next || `/${user.role}`);
  }, [next, router, user]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-[#0b1f3a] px-4 py-16 text-white">
      <p className="text-xs uppercase tracking-[0.25em] text-teal-300">CampoSync</p>
      <h1 className="mt-2 text-3xl font-semibold">Entrar por rol</h1>
      <p className="mt-2 max-w-md text-center text-sm text-slate-300">
        En hackathon puedes usar el modo demo. Cuando exista Supabase Auth, el
        mismo enrutamiento lee el rol desde profiles.
      </p>
      <div className="mt-8 grid w-full max-w-3xl gap-4 md:grid-cols-3">
        {ROLES.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => {
              enterDemo(role.id);
              router.push(next || `/${role.id}`);
            }}
            className="rounded-2xl bg-white/10 p-5 text-left hover:bg-white/15"
          >
            <h2 className="text-lg font-semibold">{role.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{role.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
