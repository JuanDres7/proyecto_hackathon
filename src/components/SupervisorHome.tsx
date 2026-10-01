"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db, enqueueOutbox } from "@/lib/db";
import { persistVisit } from "@/lib/sync";
import { useAuth } from "@/lib/auth-context";
import type { LocalVisit } from "@/lib/types";

function seedIfEmpty(supervisorId: string) {
  return db.visits.count().then(async (count) => {
    if (count > 0) return;
    const now = new Date().toISOString();
    const visits: LocalVisit[] = [
      {
        id: crypto.randomUUID(),
        clientUuid: crypto.randomUUID(),
        supervisorId,
        siteName: "Planta Norte — limpieza industrial",
        contractedActivity: "Inspección de cuadrilla de aseo y EPP",
        status: "pendiente",
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        clientUuid: crypto.randomUUID(),
        supervisorId,
        siteName: "Obra Centro — vigilancia",
        contractedActivity: "Verificar puestos y bitácora de turnos",
        status: "pendiente",
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      },
    ];
    await db.visits.bulkAdd(visits);
    for (const visit of visits) {
      await enqueueOutbox("visit", { id: visit.id });
    }
  });
}

export function SupervisorHome() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<LocalVisit[]>([]);
  const [siteName, setSiteName] = useState("");
  const [activity, setActivity] = useState("");

  async function refresh() {
    const rows = await db.visits.orderBy("updatedAt").reverse().toArray();
    setVisits(rows);
  }

  useEffect(() => {
    if (!user) return;
    void seedIfEmpty(user.id).then(refresh);
  }, [user]);

  async function createVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !siteName.trim()) return;
    const now = new Date().toISOString();
    const visit: LocalVisit = {
      id: crypto.randomUUID(),
      clientUuid: crypto.randomUUID(),
      supervisorId: user.id,
      siteName: siteName.trim(),
      contractedActivity: activity.trim() || "Actividad contratada",
      status: "pendiente",
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };
    await persistVisit(visit);
    setSiteName("");
    setActivity("");
    await refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <p className="text-sm text-slate-600">
        Trabaja sin red: check-in, fotos y novedades se guardan en el dispositivo
        y el Sync Worker las sube a Supabase cuando vuelva la conexión.
      </p>

      <form onSubmit={createVisit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Nueva visita</h2>
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Sitio / contrato"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
        />
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Actividad a verificar"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        />
        <button className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white">
          Guardar localmente
        </button>
      </form>

      <ul className="space-y-3">
        {visits.map((visit) => (
          <li key={visit.id}>
            <Link
              href={`/supervisor/visita/${visit.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{visit.siteName}</p>
                  <p className="text-sm text-slate-500">{visit.contractedActivity}</p>
                </div>
                <StatusBadge status={visit.status} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Sync: {visit.syncStatus}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: LocalVisit["status"] }) {
  const map = {
    pendiente: "bg-slate-100 text-slate-700",
    en_curso: "bg-sky-100 text-sky-800",
    completada: "bg-emerald-100 text-emerald-800",
    novedad: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
