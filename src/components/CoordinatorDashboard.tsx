"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { LocalVisit } from "@/lib/types";

type Alert = { id: string; message: string; severity: string; created_at: string };

export function CoordinatorDashboard() {
  const [visits, setVisits] = useState<LocalVisit[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [source, setSource] = useState("IndexedDB local");

  useEffect(() => {
    let active = true;

    async function load() {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        if (supabase) {
          const { data } = await supabase
            .from("visits")
            .select("*")
            .order("updated_at", { ascending: false });
          if (data && active) {
            setSource("PostgreSQL (Supabase)");
            setVisits(
              data.map((row) => ({
                id: row.id,
                clientUuid: row.client_uuid,
                supervisorId: row.supervisor_id ?? "remoto",
                siteName: row.site_name,
                contractedActivity: row.contracted_activity,
                status: row.status,
                checkInAt: row.check_in_at,
                checkOutAt: row.check_out_at,
                novedad: row.novedad,
                syncStatus: "synced",
                createdAt: row.created_at,
                updatedAt: row.updated_at,
              })),
            );
          }
          const { data: alertRows } = await supabase
            .from("alerts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(8);
          if (alertRows && active) setAlerts(alertRows as Alert[]);

          const channel = supabase
            .channel("visits-live")
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "visits" },
              () => void load(),
            )
            .subscribe();
          return () => {
            void supabase.removeChannel(channel);
          };
        }
      }

      let local = await db.visits.orderBy("updatedAt").reverse().toArray();
      if (local.length === 0) {
        const now = new Date().toISOString();
        local = [
          {
            id: "demo-1",
            clientUuid: "demo-1",
            supervisorId: "demo-supervisor",
            siteName: "Planta Norte — limpieza industrial",
            contractedActivity: "Inspección de cuadrilla",
            status: "en_curso",
            checkInAt: now,
            syncStatus: "pending",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "demo-2",
            clientUuid: "demo-2",
            supervisorId: "demo-supervisor",
            siteName: "Obra Centro — vigilancia",
            contractedActivity: "Verificar puestos",
            status: "novedad",
            novedad: "Falta un guardia en el acceso 2",
            syncStatus: "pending",
            createdAt: now,
            updatedAt: now,
          },
        ];
      }
      if (active) {
        setSource("IndexedDB (modo demo / sin nube)");
        setVisits(local);
        setAlerts(
          local
            .filter((v) => v.status === "novedad")
            .map((v) => ({
              id: v.id,
              message: `Novedad en ${v.siteName}: ${v.novedad || "sin detalle"}`,
              severity: "alta",
              created_at: v.updatedAt,
            })),
        );
      }
      return () => undefined;
    }

    let cleanup: (() => void) | undefined;
    void load().then((fn) => {
      cleanup = fn;
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  const stats = useMemo(() => {
    return {
      total: visits.length,
      enCurso: visits.filter((v) => v.status === "en_curso").length,
      novedad: visits.filter((v) => v.status === "novedad").length,
      hechas: visits.filter((v) => v.status === "completada").length,
    };
  }, [visits]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Fuente: {source}</p>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Visitas" value={stats.total} />
        <Stat label="En curso" value={stats.enCurso} />
        <Stat label="Completadas" value={stats.hechas} />
        <Stat label="Alertas / novedades" value={stats.novedad} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 overflow-hidden rounded-2xl bg-white shadow-sm">
          <header className="border-b px-4 py-3 font-semibold">Estado de visitas</header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2">Sitio</th>
                  <th className="px-4 py-2">Estado</th>
                  <th className="px-4 py-2">Check-in</th>
                  <th className="px-4 py-2">Novedad</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id} className="border-t">
                    <td className="px-4 py-2">
                      <p className="font-medium">{visit.siteName}</p>
                      <p className="text-xs text-slate-400">{visit.contractedActivity}</p>
                    </td>
                    <td className="px-4 py-2 capitalize">{visit.status.replace("_", " ")}</td>
                    <td className="px-4 py-2 text-xs">
                      {visit.checkInAt ? new Date(visit.checkInAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">{visit.novedad || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Alertas de campo</h2>
          <ul className="mt-3 space-y-3">
            {alerts.length === 0 ? (
              <li className="text-sm text-slate-500">Sin alertas.</li>
            ) : (
              alerts.map((alert) => (
                <li key={alert.id} className="rounded-lg bg-amber-50 p-3 text-sm">
                  <p className="font-medium text-amber-900">{alert.message}</p>
                  <p className="text-xs text-amber-700">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-semibold text-[#0b1f3a]">{value}</p>
    </div>
  );
}
