import Link from "next/link";

const modules = [
  {
    href: "/login?next=/supervisor",
    kicker: "Módulo A",
    title: "Supervisor",
    body: "Offline-first con Dexie, GPS, fotos y Sync Worker hacia Supabase.",
  },
  {
    href: "/login?next=/coordinador",
    kicker: "Módulo B",
    title: "Coordinador",
    body: "Panel de escritorio: visitas en tiempo real, supervisores y alertas.",
  },
  {
    href: "/login?next=/cliente",
    kicker: "Módulo C",
    title: "Cliente + IA",
    body: "Chat en 3 estados: cotización, seguimiento y quejas con visión + NLP.",
  },
];

export default function Home() {
  return (
    <div className="min-h-full bg-[#0b1f3a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-teal-300">PWA única</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight">
          Supervisión inteligente de servicios en campo
        </h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          Una sola Progressive Web App con enrutamiento por roles: supervisor en
          territorio, coordinador en escritorio y cliente público con Gemini.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {modules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="rounded-2xl bg-white/10 p-5 transition hover:bg-white/15"
            >
              <p className="text-xs uppercase tracking-wider text-teal-300">
                {mod.kicker}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{mod.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{mod.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
