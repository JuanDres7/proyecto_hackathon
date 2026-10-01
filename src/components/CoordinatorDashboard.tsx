"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { mapsUrl } from "@/lib/geo";

type VisitRow = {
  id: string;
  client_uuid?: string;
  site_name: string;
  contracted_activity: string;
  status: string;
  check_in_at?: string | null;
  check_out_at?: string | null;
  check_in_lat?: number | string | null;
  check_in_lng?: number | string | null;
  novedad?: string | null;
  service_number?: string | null;
};

type LocalGeo = {
  id: string;
  clientUuid: string;
  siteName: string;
  serviceNumber?: string;
  lat: number;
  lng: number;
};

type AlertRow = {
  id: string;
  message: string;
  severity: string;
  created_at: string;
  visit_id?: string;
};

type PqrItem = {
  id: string;
  service_number: string;
  priority: string;
  status: string;
  rating?: number;
  body?: string;
  label?: string | null;
  confidence?: number | null;
  vision_valid?: boolean | null;
  vision_note?: string | null;
  summary?: string | null;
  photoUrl?: string | null;
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-CO");
}

function coord(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

async function readLocalGeo(): Promise<LocalGeo[]> {
  try {
    const rows = await db.visits.toArray();
    return rows.flatMap((visit) => {
      if (visit.checkInLat == null || visit.checkInLng == null) return [];
      return [
        {
          id: visit.id,
          clientUuid: visit.clientUuid,
          siteName: visit.siteName,
          serviceNumber: visit.serviceNumber,
          lat: visit.checkInLat,
          lng: visit.checkInLng,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function CoordinatorDashboard() {
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [localGeo, setLocalGeo] = useState<LocalGeo[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [pqr, setPqr] = useState<PqrItem[]>([]);
  const [tab, setTab] = useState<"visitas" | "alertas" | "pqr">("visitas");
  const [searchQuery, setSearchQuery] = useState("");
  const [reassignId, setReassignId] = useState("");

  async function load() {
    const [v, a, p] = await Promise.all([
      fetch("/api/coordinator?kind=visits").then((r) => r.json()),
      fetch("/api/coordinator?kind=alerts").then((r) => r.json()),
      fetch("/api/coordinator?kind=pqr").then((r) => r.json()),
    ]);
    setVisits(v.visits ?? []);
    setLocalGeo(await readLocalGeo());
    setAlerts(a.alerts ?? []);
    setPqr(p.items ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void (async () => {
        const [v, a, p] = await Promise.all([
          fetch("/api/coordinator?kind=visits").then((r) => r.json()),
          fetch("/api/coordinator?kind=alerts").then((r) => r.json()),
          fetch("/api/coordinator?kind=pqr").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setVisits(v.visits ?? []);
        setLocalGeo(await readLocalGeo());
        setAlerts(a.alerts ?? []);
        setPqr(p.items ?? []);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const locations = useMemo(() => {
    const items: { key: string; title: string; code?: string | null; lat: number; lng: number }[] = [];
    const seen = new Set<string>();

    function push(key: string, title: string, lat: number, lng: number, code?: string | null) {
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ key, title, code, lat, lng });
    }

    for (const visit of visits) {
      const lat = coord(visit.check_in_lat);
      const lng = coord(visit.check_in_lng);
      const local = localGeo.find(
        (row) =>
          row.clientUuid === visit.client_uuid ||
          row.id === visit.id ||
          (visit.service_number != null && row.serviceNumber === visit.service_number),
      );
      const pointLat = lat ?? local?.lat ?? null;
      const pointLng = lng ?? local?.lng ?? null;
      if (pointLat == null || pointLng == null) continue;
      push(visit.client_uuid || visit.id, visit.site_name, pointLat, pointLng, visit.service_number);
      if (visit.client_uuid) seen.add(visit.client_uuid);
      seen.add(visit.id);
      if (local) {
        seen.add(local.clientUuid);
        seen.add(local.id);
      }
    }

    for (const row of localGeo) {
      if (seen.has(row.clientUuid) || seen.has(row.id)) continue;
      push(row.clientUuid, row.siteName, row.lat, row.lng, row.serviceNumber);
    }

    return items;
  }, [localGeo, visits]);

  const filteredVisits = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return visits.filter(
      (v) =>
        !q ||
        v.site_name.toLowerCase().includes(q) ||
        (v.service_number ?? "").toLowerCase().includes(q) ||
        v.contracted_activity.toLowerCase().includes(q),
    );
  }, [visits, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: visits.length,
      completed: visits.filter((v) => v.status === "completada").length,
      inProgress: visits.filter((v) => v.status === "en_curso").length,
      incidents: visits.filter((v) => v.status === "novedad").length,
    };
  }, [visits]);

  async function act(action: "authorize_close" | "reassign", serviceNumber: string) {
    await fetch("/api/coordinator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        serviceNumber,
        supervisorId: action === "reassign" ? reassignId : undefined,
      }),
    });
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Kpi title="Visitas sincronizadas" value={stats.total} />
        <Kpi title="Completadas" value={stats.completed} />
        <Kpi title="En curso" value={stats.inProgress} />
        <Kpi title="Novedades de campo" value={stats.incidents} />
      </div>

      <div className="flex gap-2">
        {(
          [
            ["visitas", "Visitas"],
            ["alertas", "Alertas de novedad"],
            ["pqr", "Cola PQR"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-lg text-xs ${
              tab === id ? "bg-surface-container-high border border-border-subtle" : "text-text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "visitas" && (
        <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle">
          <input
            className="mb-3 bg-surface-container text-xs px-3 py-1.5 rounded-lg border w-full max-w-sm"
            placeholder="Filtrar sitio o código"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-text-muted font-mono uppercase border-b border-border-subtle">
                <th className="py-2">Sitio</th>
                <th>Actividad</th>
                <th>Estado</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Decisión</th>
              </tr>
            </thead>
            <tbody>
              {filteredVisits.map((visit) => (
                <tr key={visit.id} className="border-b border-border-subtle">
                  <td className="py-2">
                    <div>{visit.site_name}</div>
                    {visit.service_number && (
                      <div className="font-mono text-primary">Servicio {visit.service_number}</div>
                    )}
                  </td>
                  <td>{visit.contracted_activity}</td>
                  <td>{visit.status}</td>
                  <td>{fmt(visit.check_in_at)}</td>
                  <td>{fmt(visit.check_out_at)}</td>
                  <td>
                    {visit.service_number && (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="text-primary"
                          onClick={() => void act("authorize_close", visit.service_number!)}
                        >
                          Autorizar cierre
                        </button>
                        <input
                          className="bg-surface-container px-1 py-0.5 rounded"
                          placeholder="UUID supervisor"
                          value={reassignId}
                          onChange={(e) => setReassignId(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => void act("reassign", visit.service_number!)}
                        >
                          Reasignar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVisits.length === 0 && (
            <p className="text-xs text-text-muted pt-4">No hay visitas sincronizadas todavía.</p>
          )}
          {locations.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold text-text-primary">Ubicación de llegada</h3>
              <ul className="space-y-2">
                {locations.map((point) => (
                  <li key={point.key} className="text-xs text-text-secondary">
                    <span className="text-text-primary">{point.title}</span>
                    {point.code ? <span className="font-mono text-primary"> · {point.code}</span> : null}
                    <span className="font-mono">
                      {" "}
                      · {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                    </span>
                    {" · "}
                    <a
                      href={mapsUrl(point.lat, point.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      Ver mapa
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "alertas" && (
        <div className="bg-surface-container-low rounded-xl p-5 border space-y-3">
          <p className="text-xs text-text-secondary">
            Alertas de novedad de campo. No se mezclan con la cola PQR ni usan el clasificador de quejas.
          </p>
          {alerts.map((alert) => (
            <div key={alert.id} className="p-3 rounded-lg border border-border-subtle">
              <span className="text-[10px] font-mono uppercase text-status-critical">
                Severidad {alert.severity}
              </span>
              <p className="text-xs mt-1">{alert.message}</p>
              <p className="text-[10px] text-text-muted">{fmt(alert.created_at)}</p>
            </div>
          ))}
          {alerts.length === 0 && <p className="text-xs text-text-muted">Sin alertas de novedad.</p>}
        </div>
      )}

      {tab === "pqr" && (
        <div className="bg-surface-container-low rounded-xl p-5 border space-y-3">
          {pqr.map((item) => (
            <div key={item.id} className="p-3 rounded-lg border space-y-1 text-xs">
              <p className="font-mono text-primary">{item.service_number}</p>
              <p>Estrellas: {item.rating}</p>
              <p>Comentario: {item.body || "(vacío)"}</p>
              <p>
                Clase:{" "}
                {item.label === "pending" || !item.label
                  ? "clasificación pendiente"
                  : item.label}
                {item.confidence != null ? ` (${item.confidence}%)` : ""}
              </p>
              <p>
                Foto:{" "}
                {item.photoUrl ? (
                  <a href={item.photoUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                    enlace firmado
                  </a>
                ) : (
                  item.vision_note || "No se adjuntó"
                )}
              </p>
              <p>Resultado de foto: {item.vision_note}</p>
              <p>Resumen: {item.summary}</p>
            </div>
          ))}
          {pqr.length === 0 && (
            <p className="text-xs text-text-muted">No hay casos de 1 o 2 estrellas.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle">
      <span className="text-[11px] font-mono uppercase text-text-muted">{title}</span>
      <h3 className="text-3xl font-bold mt-1">{value}</h3>
    </div>
  );
}
