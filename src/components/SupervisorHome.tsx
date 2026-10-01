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
        id: "vis-eldorado-42",
        clientUuid: crypto.randomUUID(),
        supervisorId,
        siteName: "Subestación El Dorado #42",
        contractedActivity: "Inspección Termográfica y Puesta a Tierra RETIE",
        status: "en_curso",
        checkInAt: new Date(Date.now() - 3600000).toISOString(),
        checkInLat: 4.6982,
        checkInLng: -74.1415,
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        clientUuid: crypto.randomUUID(),
        supervisorId,
        siteName: "Torre Celular Calle 127",
        contractedActivity: "Verificación de Tableros Eléctricos y Baterías",
        status: "pendiente",
        syncStatus: "pending",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: crypto.randomUUID(),
        clientUuid: crypto.randomUUID(),
        supervisorId,
        siteName: "Planta Industrial Puente Aranda",
        contractedActivity: "Inspección de Cuadrilla y Protocolo de Alturas",
        status: "completada",
        checkInAt: new Date(Date.now() - 7200000).toISOString(),
        checkOutAt: new Date(Date.now() - 3600000).toISOString(),
        syncStatus: "synced",
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
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [showNewModal, setShowNewModal] = useState(false);

  async function refresh() {
    const rows = await db.visits.orderBy("updatedAt").reverse().toArray();
    setVisits(rows);
    setPhotoCount(await db.evidence.count());
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
      contractedActivity: activity.trim() || "Inspección general de campo",
      status: "pendiente",
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };
    await persistVisit(visit);
    setSiteName("");
    setActivity("");
    setShowNewModal(false);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* 1. Offline-First Telemetry Banner */}
      <section className="bg-surface-container-high rounded-xl p-4 border border-border-subtle shadow-md transition-all">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isSimulatedOffline
                  ? "bg-status-warning animate-pulse"
                  : "bg-status-online animate-pulse"
              }`}
            />
            <span
              className={`font-mono text-xs font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                isSimulatedOffline
                  ? "bg-surface-container-highest text-tertiary border border-tertiary/30"
                  : "bg-surface-container-highest text-secondary border border-secondary/30"
              }`}
            >
              {isSimulatedOffline ? "Modo Offline Activo" : "Red Operativa"}
            </span>
          </div>

          {/* Toggle Simulator */}
          <button
            type="button"
            onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-bright active:scale-95 transition-all text-xs font-medium text-text-primary border border-border-subtle cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px] text-primary">
              {isSimulatedOffline ? "wifi_off" : "wifi"}
            </span>
            <span>Simular Red</span>
          </button>
        </div>

        <div className="flex items-start gap-2.5 bg-surface-container-low p-2.5 rounded-lg border border-border-subtle">
          <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0 mt-0.5">
            storage
          </span>
          <div className="flex flex-col min-w-0">
            <p className="font-mono text-xs text-text-primary font-medium">
              <span className="text-secondary font-bold">{visits.length}</span> registros y{" "}
              <span className="text-secondary font-bold">{photoCount}</span> fotografías en Dexie.js
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Sincronización estructurada automática pendiente con Supabase al detectar señal.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Active Supervisor Card (Telemetry & Hardware) */}
      <section className="bg-surface-container-low rounded-xl p-4 border border-border-subtle shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-surface-container-high border border-border-subtle flex items-center justify-center shrink-0 text-primary">
              <span className="material-symbols-outlined text-[22px]">engineering</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-text-primary truncate">
                {user?.fullName || "Ing. Carlos Mendoza"}
              </span>
              <span className="text-xs text-secondary font-medium font-mono">
                Cuadrilla Norte • #OP-994
              </span>
            </div>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-surface-container-high border border-secondary/30 flex items-center gap-1 shrink-0">
            <span className="material-symbols-outlined text-status-online text-[14px]">
              verified_user
            </span>
            <span className="font-mono text-[10px] text-text-primary font-bold">ACTIVO</span>
          </div>
        </div>

        {/* Micro Field Telemetry (Battery + GNSS) */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 bg-surface-container px-2.5 py-1.5 rounded-lg border border-border-subtle">
            <span className="material-symbols-outlined text-secondary text-[18px]">
              battery_charging_80
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">Batería terminal</span>
              <span className="font-mono font-medium text-text-primary">88% (Óptimo)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-container px-2.5 py-1.5 rounded-lg border border-border-subtle">
            <span className="material-symbols-outlined text-primary text-[18px]">radar</span>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted">Precisión GNSS</span>
              <span className="font-mono font-medium text-text-primary">±3m (RTK Lock)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Visits List Header & Add Button */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">
            format_list_bulleted
          </span>
          <h2 className="text-sm font-semibold text-text-primary">Ruta de Visitas Asignadas</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-medium transition-colors shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Nueva Visita</span>
        </button>
      </div>

      {/* New Visit Form Modal / Panel */}
      {showNewModal && (
        <form
          onSubmit={createVisit}
          className="space-y-3 rounded-xl bg-surface-container p-4 border border-border-active shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
              Registrar Nueva Visita Local
            </h3>
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="text-text-muted hover:text-text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
          <input
            className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            placeholder="Sitio / Subestación / Contrato"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            placeholder="Actividad contratada a supervisar"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-secondary text-on-secondary px-4 py-1.5 text-xs font-semibold hover:bg-secondary/90 transition-colors"
            >
              Guardar en Dexie.js
            </button>
          </div>
        </form>
      )}

      {/* 4. Visits Cards Feed */}
      <div className="space-y-3">
        {visits.map((visit) => (
          <Link
            key={visit.id}
            href={`/supervisor/visita/${visit.id}`}
            className="block rounded-xl bg-surface-container-low border border-border-subtle p-4 hover:border-border-active hover:bg-surface-container transition-all shadow-sm group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    factory
                  </span>
                  <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                    {visit.siteName}
                  </h3>
                </div>
                <p className="text-xs text-text-secondary truncate">
                  {visit.contractedActivity}
                </p>
              </div>
              <StatusBadge status={visit.status} />
            </div>

            <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-text-muted">
                <span className="material-symbols-outlined text-[13px] text-secondary">
                  location_on
                </span>
                <span>Geocerca Validada</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full ${
                  visit.syncStatus === "synced"
                    ? "text-secondary bg-secondary/10"
                    : "text-status-warning bg-status-warning/10"
                }`}
              >
                Sync: {visit.syncStatus}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LocalVisit["status"] }) {
  const map = {
    pendiente: "bg-surface-container-highest text-text-muted border-border-subtle",
    en_curso: "bg-primary/10 text-primary border-primary/30",
    completada: "bg-secondary/10 text-secondary border-secondary/30",
    novedad: "bg-error-container/20 text-error border-error/30",
  };
  const labelMap = {
    pendiente: "Pendiente",
    en_curso: "En Ejecución",
    completada: "Completada",
    novedad: "Con Novedad",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border ${map[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}
