"use client";

import { useEffect, useMemo, useState } from "react";
import { COORDINATOR_PROFILE, TEAM_SUPERVISORS } from "@/lib/seed-users";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type VisitRow = {
  id: string;
  site_name: string;
  contracted_activity: string;
  status: string;
  check_in_at?: string | null;
  check_out_at?: string | null;
  novedad?: string | null;
  service_number?: string | null;
  check_in_lat?: number | null;
  check_in_lng?: number | null;
  supervisor_id?: string | null;
};

type AlertRow = {
  id: string;
  message: string;
  severity: string;
  status?: string;
  coordinator_comment?: string | null;
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

type Kpis = {
  total: number;
  completed: number;
  inProgress: number;
  incidents: number;
  compliancePct: number;
  assignedSupervisors: number;
  activeSupervisors: number;
};

function fmt(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-CO");
}

export function CoordinatorDashboard() {
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [pqr, setPqr] = useState<PqrItem[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [supervisors, setSupervisors] = useState<{ id: string; full_name: string }[]>([]);
  const [tab, setTab] = useState<"visitas" | "alertas" | "pqr" | "reportes">("visitas");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reassignId, setReassignId] = useState("");
  const [alertComment, setAlertComment] = useState("");
  const [live, setLive] = useState(false);

  async function load() {
    const [v, a, p, k] = await Promise.all([
      fetch("/api/coordinator?kind=visits&limit=100", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/coordinator?kind=alerts&limit=100", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/coordinator?kind=pqr", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/coordinator?kind=kpis", { credentials: "include" }).then((r) => r.json()),
    ]);
    setVisits(v.visits ?? []);
    setAlerts(a.alerts ?? []);
    setPqr(p.items ?? []);
    setKpis(k.kpis ?? null);
    setSupervisors(k.supervisors ?? []);
  }

  useEffect(() => {
    const start = window.setTimeout(() => {
      void load();
    }, 0);
    if (!isSupabaseConfigured()) {
      return () => window.clearTimeout(start);
    }
    const supabase = createClient();
    if (!supabase) return () => window.clearTimeout(start);
    const channel = supabase
      .channel("coord-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => void load())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      window.clearTimeout(start);
      void supabase.removeChannel(channel);
    };
  }, []);

  const filteredVisits = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return visits.filter(
      (v) =>
        (!statusFilter || v.status === statusFilter) &&
        (!q ||
          v.site_name.toLowerCase().includes(q) ||
          (v.service_number ?? "").toLowerCase().includes(q) ||
          v.contracted_activity.toLowerCase().includes(q)),
    );
  }, [visits, searchQuery, statusFilter]);

  const stats = kpis ?? {
    total: visits.length,
    completed: visits.filter((v) => v.status === "completada").length,
    inProgress: visits.filter((v) => v.status === "en_curso").length,
    incidents: visits.filter((v) => v.status === "novedad").length,
    compliancePct: visits.length
      ? Math.round((visits.filter((v) => v.status === "completada").length / visits.length) * 100)
      : 0,
    assignedSupervisors: 0,
    activeSupervisors: 0,
  };

  async function act(
    action: "authorize_close" | "reassign" | "close_alert" | "assign_route",
    extra: Record<string, string | undefined>,
  ) {
    await fetch("/api/coordinator", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border-subtle bg-surface-container-low p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-container-high text-lg font-bold text-primary">
              MD
            </div>
            <div>
              <p className="text-[11px] font-mono uppercase tracking-wide text-text-muted">Perfil operativo</p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">{COORDINATOR_PROFILE.fullName}</h2>
              <p className="text-sm text-text-secondary">{COORDINATOR_PROFILE.title}</p>
              <p className="mt-2 text-xs text-text-muted">
                {COORDINATOR_PROFILE.zone} · {COORDINATOR_PROFILE.shift}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {COORDINATOR_PROFILE.email} · {COORDINATOR_PROFILE.phone}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-border-subtle bg-surface-container px-3 py-2">
              <p className="font-mono text-[10px] uppercase text-text-muted">Centros</p>
              <p className="mt-1 text-text-primary">{COORDINATOR_PROFILE.costCenters.length}</p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface-container px-3 py-2">
              <p className="font-mono text-[10px] uppercase text-text-muted">Equipo</p>
              <p className="mt-1 text-text-primary">{supervisors.length || TEAM_SUPERVISORS.length} supervisores</p>
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface-container px-3 py-2 col-span-2 sm:col-span-1">
              <p className="font-mono text-[10px] uppercase text-text-muted">Cobertura</p>
              <p className="mt-1 text-text-primary">{COORDINATOR_PROFILE.costCenters.join(" · ")}</p>
            </div>
          </div>
        </div>
      </section>
      <p className="text-[11px] font-mono text-text-muted">
        {live ? "Realtime conectado" : "Polling / sin canal Realtime"}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        <Kpi title="Visitas" value={stats.total} />
        <Kpi title="Completadas" value={stats.completed} />
        <Kpi title="En curso" value={stats.inProgress} />
        <Kpi title="Novedades" value={stats.incidents} />
        <Kpi title="Cumplimiento %" value={stats.compliancePct} />
        <Kpi title="Superv. asignados" value={stats.assignedSupervisors} />
        <Kpi title="Superv. activos" value={stats.activeSupervisors} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["visitas", "Visitas y mapa"],
            ["alertas", "Novedades"],
            ["pqr", "Cola PQR"],
            ["reportes", "Reportes"],
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
        <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="bg-surface-container text-xs px-3 py-1.5 rounded-lg border max-w-sm"
              placeholder="Filtrar sitio o código"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="bg-surface-container text-xs px-3 py-1.5 rounded-lg border"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="pendiente">pendiente</option>
              <option value="en_curso">en_curso</option>
              <option value="completada">completada</option>
              <option value="novedad">novedad</option>
            </select>
            <select
              className="bg-surface-container text-xs px-3 py-1.5 rounded-lg border"
              value={reassignId}
              onChange={(e) => setReassignId(e.target.value)}
            >
              <option value="">Supervisor destino</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {filteredVisits
              .filter((v) => v.check_in_lat != null)
              .map((v) => (
                <a
                  key={v.id}
                  className="text-primary underline"
                  href={`https://www.openstreetmap.org/?mlat=${v.check_in_lat}&mlon=${v.check_in_lng}#map=16/${v.check_in_lat}/${v.check_in_lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {v.site_name}
                </a>
              ))}
          </div>
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
                          onClick={() =>
                            void act("authorize_close", { serviceNumber: visit.service_number! })
                          }
                        >
                          Autorizar cierre
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void act("assign_route", {
                              serviceNumber: visit.service_number!,
                              supervisorId: reassignId,
                            })
                          }
                        >
                          Asignar ruta
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void act("reassign", {
                              serviceNumber: visit.service_number!,
                              supervisorId: reassignId,
                            })
                          }
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
        </div>
      )}

      {tab === "alertas" && (
        <div className="bg-surface-container-low rounded-xl p-5 border space-y-3">
          <p className="text-xs text-text-secondary">
            Ciclo de vida de novedades: abierta → comentario del coordinador → cierre.
          </p>
          <input
            className="bg-surface-container text-xs px-3 py-1.5 rounded-lg border w-full"
            placeholder="Comentario de cierre"
            value={alertComment}
            onChange={(e) => setAlertComment(e.target.value)}
          />
          {alerts.map((alert) => (
            <div key={alert.id} className="p-3 rounded-lg border border-border-subtle">
              <span className="text-[10px] font-mono uppercase text-status-critical">
                {alert.status ?? "open"} · {alert.severity}
              </span>
              <p className="text-xs mt-1">{alert.message}</p>
              <p className="text-[10px] text-text-muted">{fmt(alert.created_at)}</p>
              {alert.status !== "closed" && (
                <button
                  type="button"
                  className="text-xs text-primary mt-2"
                  onClick={() =>
                    void act("close_alert", { alertId: alert.id, comment: alertComment })
                  }
                >
                  Cerrar novedad
                </button>
              )}
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
                {item.label === "pending" || !item.label ? "clasificación pendiente" : item.label}
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
              <p>Resumen: {item.summary}</p>
            </div>
          ))}
          {pqr.length === 0 && (
            <p className="text-xs text-text-muted">No hay casos de 1 o 2 estrellas.</p>
          )}
        </div>
      )}

      {tab === "reportes" && <ReportsPanel />}
    </div>
  );
}

function ReportsPanel() {
  const [group, setGroup] = useState<"supervisor" | "cost_center" | "period">("supervisor");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<
    { key: string; label: string; total: number; completed: number; novedad: number; compliancePct: number }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ group });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    let cancelled = false;
    void fetch(`/api/reports?${params}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("reports");
        return response.json() as Promise<{ rows?: typeof rows; total?: number }>;
      })
      .then((json) => {
        if (cancelled) return;
        setRows(json.rows ?? []);
        setTotal(json.total ?? 0);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo generar el reporte.");
      });
    return () => {
      cancelled = true;
    };
  }, [group, from, to]);

  function reportHref(format: "csv" | "pdf") {
    const params = new URLSearchParams({ group, format });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/reports?${params}`;
  }

  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Reportes</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Agrupa las visitas por supervisor, centro de costo o mes. Puedes verlas aquí o descargarlas.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="bg-surface-container text-xs px-3 py-1.5 rounded-lg border"
          value={group}
          onChange={(event) => setGroup(event.target.value as typeof group)}
        >
          <option value="supervisor">Por supervisor</option>
          <option value="cost_center">Por centro de costo</option>
          <option value="period">Por mes</option>
        </select>
        <input
          type="date"
          className="bg-surface-container text-xs px-3 py-1.5 rounded-lg border"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <input
          type="date"
          className="bg-surface-container text-xs px-3 py-1.5 rounded-lg border"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
        <a className="text-xs text-primary underline" href={reportHref("csv")}>
          Descargar CSV
        </a>
        <a className="text-xs text-primary underline" href={reportHref("pdf")}>
          Descargar PDF
        </a>
      </div>
      {error ? <p className="text-xs text-status-warning">{error}</p> : null}
      <p className="text-xs text-text-muted">{total} visitas en el período.</p>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-text-muted border-b border-border-subtle">
            <th className="py-2">Grupo</th>
            <th>Total</th>
            <th>Completadas</th>
            <th>Novedades</th>
            <th>Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border-subtle">
              <td className="py-2">{row.label}</td>
              <td>{row.total}</td>
              <td>{row.completed}</td>
              <td>{row.novedad}</td>
              <td>{row.compliancePct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && !error ? (
        <p className="text-xs text-text-muted">No hay visitas en este período.</p>
      ) : null}
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
