"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { LocalVisit } from "@/lib/types";

type Alert = {
  id: string;
  message: string;
  severity: string;
  created_at: string;
  code?: string;
  supervisor?: string;
  aiVerification?: string;
  imageUrl?: string;
};

export function CoordinatorDashboard() {
  const [visits, setVisits] = useState<LocalVisit[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [source, setSource] = useState("Conectando...");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuad, setSelectedQuad] = useState("all");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPromptStatus, setAiPromptStatus] = useState("");

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

          if (data && active && data.length > 0) {
            setSource("PostgreSQL (Supabase Live)");
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

          if (alertRows && active && alertRows.length > 0) {
            setAlerts(
              alertRows.map((a) => ({
                id: a.id,
                message: a.message,
                severity: a.severity || "alta",
                created_at: a.created_at,
                code: "#ORD-9804",
                supervisor: "Elena Pardo",
              })),
            );
          }

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

      // Local / Offline fallback with seed records matching Stitch design
      const local = await db.visits.orderBy("updatedAt").reverse().toArray();
      const now = new Date().toISOString();

      const defaultVisits: LocalVisit[] = [
        {
          id: "ORD-9801",
          clientUuid: "cl-1",
          supervisorId: "Carlos Ramos",
          siteName: "Torre Celular Cerro Oriental",
          contractedActivity: "Mantenimiento Preventivo Enlace Microondas",
          status: "completada",
          checkInAt: "08:15 am",
          checkOutAt: "09:40 am",
          syncStatus: "synced",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "ORD-9804",
          clientUuid: "cl-2",
          supervisorId: "Elena Pardo",
          siteName: "Subestación Norte Transmisión",
          contractedActivity: "Inspección de Gabinete y Fibra Óptica",
          status: "novedad",
          novedad: "Gabinete exterior vandalizado. Acometida cortada.",
          checkInAt: "09:30 am",
          syncStatus: "syncing",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "ORD-9807",
          clientUuid: "cl-3",
          supervisorId: "Diego Moreno",
          siteName: "Bodega Logística Celta Km 7",
          contractedActivity: "Auditoría RETIE Puesta a Tierra",
          status: "en_curso",
          novedad: "Demora en portería por protocolo",
          checkInAt: "10:02 am",
          syncStatus: "pending",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "ORD-9809",
          clientUuid: "cl-4",
          supervisorId: "Marcela Ruiz",
          siteName: "C.C. Titán Plaza — Generadora 2",
          contractedActivity: "Inspección de Transformador y Generadores",
          status: "completada",
          checkInAt: "07:50 am",
          checkOutAt: "08:45 am",
          syncStatus: "synced",
          createdAt: now,
          updatedAt: now,
        },
      ];

      if (active) {
        setSource(local.length > 0 ? "Dexie.js (Local IndexedDB)" : "Docker + Mock Telemetry");
        setVisits(local.length > 0 ? [...local, ...defaultVisits] : defaultVisits);

        setAlerts([
          {
            id: "alt-1",
            code: "#ORD-9804",
            message: "Gabinete exterior vandalizado. Acometida de fibra cortada en poste 14.",
            severity: "alta",
            created_at: "hace 8 min",
            supervisor: "Elena Pardo",
            aiVerification: "Gemini: 98% Daño Físico",
            imageUrl:
              "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80",
          },
          {
            id: "alt-2",
            code: "#ORD-9799",
            message: "Inconsistencia de serie: Código QR del transformador no coincide con la orden técnica.",
            severity: "media",
            created_at: "hace 26 min",
            supervisor: "Rodrigo Soto",
            aiVerification: "OCR Inconsistencia",
          },
        ]);
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

  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        v.siteName.toLowerCase().includes(q) ||
        v.contractedActivity.toLowerCase().includes(q) ||
        (v.supervisorId && v.supervisorId.toLowerCase().includes(q)) ||
        v.id.toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [visits, searchQuery]);

  const stats = useMemo(() => {
    const total = visits.length || 48;
    const completed = visits.filter((v) => v.status === "completada").length || 38;
    const inProgress = visits.filter((v) => v.status === "en_curso").length || 7;
    const incidents = visits.filter((v) => v.status === "novedad").length || 4;

    return { total, completed, inProgress, incidents };
  }, [visits]);

  function handleSendPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiPromptStatus(`Despachado: "${aiPrompt.trim()}"`);
    setAiPrompt("");
    setTimeout(() => setAiPromptStatus(""), 4000);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Top System Telemetry Bar */}
      <div className="w-full bg-surface-container-low rounded-xl p-4 border border-border-subtle shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-status-online animate-pulse" />
            <span className="text-sm font-semibold text-text-primary">
              Cluster Docker & Supabase PG
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded-full border border-border-subtle">
              <span className="material-symbols-outlined text-[15px] text-primary">dns</span>
              <span className="font-mono text-text-secondary">us-east-1 (PostgreSQL 16.2)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded-full border border-border-subtle">
              <span className="material-symbols-outlined text-[15px] text-secondary">speed</span>
              <span className="font-mono text-secondary">24ms Latencia</span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded-full border border-border-subtle">
              <span className="material-symbols-outlined text-[15px] text-primary-container">sync</span>
              <span className="font-mono text-text-primary">Sync Worker: 100% OK</span>
            </div>
          </div>
        </div>

        {/* Date selector & quad filter */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-surface-container px-3 py-1.5 rounded-lg border border-border-subtle">
            <span className="material-symbols-outlined text-[16px] text-text-muted">calendar_today</span>
            <span className="text-text-primary font-medium">Hoy, 24 Oct</span>
          </div>

          <div className="flex items-center gap-1.5 bg-surface-container px-3 py-1 rounded-lg border border-border-subtle">
            <span className="material-symbols-outlined text-[16px] text-text-muted">groups</span>
            <select
              value={selectedQuad}
              onChange={(e) => setSelectedQuad(e.target.value)}
              className="bg-transparent text-text-primary focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-surface-popover text-text-primary">
                Todas las Cuadrillas
              </option>
              <option value="alfa" className="bg-surface-popover text-text-primary">
                Cuadrilla Alfa (Norte)
              </option>
              <option value="bravo" className="bg-surface-popover text-text-primary">
                Cuadrilla Bravo (Centro)
              </option>
              <option value="delta" className="bg-surface-popover text-text-primary">
                Cuadrilla Delta (Fibra)
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => window.alert("Reporte de operaciones exportado en formato JSON/CSV.")}
            className="bg-primary hover:bg-primary-container text-on-primary font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Ops KPI Metric Cards (4 Bento tiles) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Visitas Programadas */}
        <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-container transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                Visitas Programadas
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <h3 className="text-3xl font-bold tracking-tight text-text-primary">
                  {stats.total}
                </h3>
                <span className="text-xs font-mono text-text-muted">/ 50 Max</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden flex">
              <div className="bg-secondary h-full" style={{ width: "78%" }} />
              <div className="bg-primary-container h-full" style={{ width: "16%" }} />
              <div className="bg-border-muted h-full" style={{ width: "6%" }} />
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-text-secondary pt-1">
              <span className="text-secondary font-medium">{stats.completed} Completadas</span>
              <span className="text-primary">{stats.inProgress} En Curso</span>
              <span className="text-text-muted">3 Pend.</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Supervisores en Campo */}
        <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-container transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                Supervisores en Campo
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <h3 className="text-3xl font-bold tracking-tight text-text-primary">14</h3>
                <span className="text-xs font-mono text-secondary">Desplegados</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">engineering</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 bg-surface-container px-2 py-0.5 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-status-online" />
              <span className="text-[11px] text-text-primary">11 Online Realtime</span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-container px-2 py-0.5 rounded-full text-xs">
              <span className="w-2 h-2 rounded-full bg-status-warning" />
              <span className="text-[11px] font-mono text-status-warning">3 Dexie Offline</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Novedades Críticas */}
        <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-container transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                Novedades Críticas
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <h3 className="text-3xl font-bold tracking-tight text-status-critical">
                  0{stats.incidents}
                </h3>
                <span className="text-xs font-mono text-error">Por Auditar</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-status-critical">
              <span className="material-symbols-outlined text-[20px]">notification_important</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="material-symbols-outlined text-[16px] text-status-warning">crisis_alert</span>
            <span>2 Bloqueos acceso, 2 Daños graves</span>
          </div>
        </div>

        {/* KPI 4: SLA de Cumplimiento */}
        <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle flex flex-col justify-between shadow-sm relative overflow-hidden group hover:bg-surface-container transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
                SLA de Cumplimiento
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <h3 className="text-3xl font-bold tracking-tight text-text-primary">96.4%</h3>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-fixed-dim">
              <span className="material-symbols-outlined text-[20px]">verified</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-secondary font-medium">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              <span>+2.1% vs sem. ant.</span>
            </div>
            <span className="font-mono text-[11px] text-text-muted">Target: 95.0%</span>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace: 8 Cols Left (Map & Table) + 4 Cols Right (Incidents & AI) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Map + Realtime Table (8 Cols) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* Map Section */}
          <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle shadow-md flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                <h2 className="text-base font-semibold text-text-primary">
                  Monitoreo Geográfico y Rutas de Cuadrilla
                </h2>
                <span className="bg-surface-container text-primary font-mono text-[11px] px-2 py-0.5 rounded-full border border-border-subtle">
                  GPS Live Telemetry
                </span>
              </div>

              {/* Filter Toggles */}
              <div className="flex items-center gap-1 bg-surface-container p-1 rounded-lg border border-border-subtle text-xs">
                <button
                  type="button"
                  className="bg-surface-container-high text-text-primary px-2.5 py-1 rounded font-medium flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-status-online" /> En Sitio (8)
                </button>
                <button
                  type="button"
                  className="text-text-secondary hover:text-text-primary px-2.5 py-1 rounded flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-border-active" /> Tránsito (4)
                </button>
                <button
                  type="button"
                  className="text-text-secondary hover:text-text-primary px-2.5 py-1 rounded flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-status-warning" /> Geocerca (2)
                </button>
              </div>
            </div>

            {/* Tactical Map Container */}
            <div className="relative w-full h-[340px] rounded-xl overflow-hidden bg-surface-container-lowest border border-border-subtle flex items-center justify-center">
              {/* Map background grid simulation */}
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(#27272a 1px, transparent 1px), radial-gradient(#1c1b1d 1px, #09090b 1px)",
                  backgroundSize: "24px 24px",
                }}
              />

              {/* Visual Radar concentric circles */}
              <div className="absolute w-72 h-72 rounded-full border border-primary/20 pointer-events-none" />
              <div className="absolute w-44 h-44 rounded-full border border-primary/30 pointer-events-none" />
              <div className="absolute w-20 h-20 rounded-full border border-primary/40 pointer-events-none animate-ping" />

              {/* Map HUD Overlay Top-Left */}
              <div className="absolute top-4 left-4 bg-surface-popover/90 backdrop-blur-md p-3 rounded-lg border border-border-muted shadow-lg pointer-events-none">
                <div className="flex items-center gap-1.5 text-text-primary text-xs font-medium">
                  <span className="material-symbols-outlined text-[15px] text-secondary">
                    share_location
                  </span>
                  <span>Geocerca Activa: <b>Distrito Norte Telecom #04</b></span>
                </div>
                <div className="font-mono text-[11px] text-text-secondary mt-0.5">
                  Perímetro: 14.8 km² • Cuadrillas en radio: 5
                </div>
              </div>

              {/* Pin 1: Sup. Carlos Ramos */}
              <div className="absolute top-1/4 left-1/4 flex flex-col items-center group cursor-pointer">
                <div className="bg-surface-popover px-2 py-0.5 rounded shadow border border-border-subtle text-text-primary font-mono text-[10px] mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-online" /> Carlos Ramos (#OP-12)
                </div>
                <div className="w-7 h-7 rounded-full bg-surface-container border border-secondary text-status-online flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[16px]">verified_user</span>
                </div>
              </div>

              {/* Pin 2: Sup. Mateo Silva */}
              <div className="absolute bottom-1/3 left-1/2 flex flex-col items-center group cursor-pointer">
                <div className="bg-surface-popover px-2 py-0.5 rounded shadow border border-border-subtle text-text-primary font-mono text-[10px] mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-border-active" /> Mateo Silva (Av. Suba)
                </div>
                <div className="w-7 h-7 rounded-full bg-surface-container border border-primary text-border-active flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[16px]">directions_car</span>
                </div>
              </div>

              {/* Pin 3: Alerta Geocerca */}
              <div className="absolute top-1/2 right-1/4 flex flex-col items-center group cursor-pointer">
                <div className="bg-surface-popover px-2 py-0.5 rounded shadow border border-status-warning/40 text-status-warning font-mono text-[10px] mb-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-warning animate-ping" /> Desvío (+3.2km)
                </div>
                <div className="w-7 h-7 rounded-full bg-surface-container border border-status-warning text-status-warning flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                </div>
              </div>

              {/* Bottom Action Controls */}
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
                <button
                  type="button"
                  title="Centrar Mapa"
                  className="bg-surface-popover hover:bg-surface-bright text-text-primary p-2 rounded-lg border border-border-subtle shadow-md transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">my_location</span>
                </button>
                <button
                  type="button"
                  title="Capas"
                  className="bg-surface-popover hover:bg-surface-bright text-text-primary p-2 rounded-lg border border-border-subtle shadow-md transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">layers</span>
                </button>
              </div>
            </div>
          </div>

          {/* Visits Table Section */}
          <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle shadow-md flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary">
                  Visitas en Ejecución en Tiempo Real
                </h2>
                <span className="bg-surface-container text-text-secondary font-mono text-[11px] px-2 py-0.5 rounded-full border border-border-subtle">
                  {filteredVisits.length} Registros
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-text-muted">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por código, cliente o supervisor..."
                  className="bg-surface-container text-text-primary placeholder:text-text-muted text-xs pl-8 pr-3 py-1.5 rounded-lg border border-border-subtle focus:border-primary focus:outline-none w-64"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-text-muted font-mono uppercase bg-surface-container/60 border-b border-border-subtle">
                    <th className="px-3 py-2.5 rounded-l-lg">Cód. Servicio</th>
                    <th className="px-3 py-2.5">Cliente / Sitio</th>
                    <th className="px-3 py-2.5">Supervisor</th>
                    <th className="px-3 py-2.5">Check-In / Out</th>
                    <th className="px-3 py-2.5">Novedad / Incidente</th>
                    <th className="px-3 py-2.5 rounded-r-lg">Sync Supabase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredVisits.map((visit) => (
                    <tr
                      key={visit.id}
                      className="hover:bg-surface-container/50 transition-colors"
                    >
                      <td className="px-3 py-3 font-mono text-primary font-medium">
                        {visit.id.startsWith("ORD-") ? visit.id : `#${visit.id.slice(0, 8)}`}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-text-primary">{visit.siteName}</div>
                        <div className="text-[11px] text-text-muted truncate max-w-xs">
                          {visit.contractedActivity}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-surface-container-high border border-border-subtle flex items-center justify-center text-[10px] font-bold text-text-primary">
                            {visit.supervisorId?.charAt(0) || "S"}
                          </div>
                          <span className="text-text-primary font-medium">
                            {visit.supervisorId || "Supervisor"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px]">
                        <div className="text-text-secondary">
                          {visit.checkInAt ? visit.checkInAt : "Sin check-in"}
                        </div>
                        {visit.checkOutAt && (
                          <span className="text-secondary text-[10px]">
                            Out: {visit.checkOutAt}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {visit.novedad ? (
                          <span className="bg-error-container/20 text-error px-2 py-0.5 rounded-full font-mono text-[10px] inline-flex items-center gap-1 border border-error/30">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            <span className="truncate max-w-[120px]">{visit.novedad}</span>
                          </span>
                        ) : (
                          <span className="bg-surface-container text-text-muted px-2 py-0.5 rounded-full font-mono text-[10px] inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px] text-status-online">
                              check_circle
                            </span>
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px]">
                        {visit.syncStatus === "synced" ? (
                          <div className="flex items-center gap-1 text-secondary">
                            <span className="material-symbols-outlined text-[14px]">cloud_done</span>
                            <span>Storage Synced</span>
                          </div>
                        ) : visit.syncStatus === "syncing" ? (
                          <div className="flex items-center gap-1 text-primary animate-pulse">
                            <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                            <span>Streaming</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-status-warning">
                            <span className="material-symbols-outlined text-[14px]">save_as</span>
                            <span>Dexie.js Buffer</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs text-text-muted font-mono">
              <span>Fuente: {source}</span>
              <span>Mostrando {filteredVisits.length} visitas</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Incidents Feed + AI NLP Widget (4 Cols) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* Incidents Feed */}
          <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-status-critical text-[20px]">
                  e911_emergency
                </span>
                <h2 className="text-base font-semibold text-text-primary">Novedades de Campo</h2>
              </div>
              <span className="bg-error-container text-on-error-container font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
                {alerts.length} Alertas
              </span>
            </div>

            {/* List */}
            <div className="flex flex-col gap-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-surface-container p-4 rounded-xl border border-border-subtle flex flex-col gap-2.5 hover:border-border-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                          alert.severity === "alta"
                            ? "bg-status-critical/15 text-status-critical border border-status-critical/30"
                            : "bg-status-warning/15 text-status-warning border border-status-warning/30"
                        }`}
                      >
                        Severidad {alert.severity}
                      </span>
                      <span className="text-[11px] font-mono text-text-muted">
                        {alert.created_at}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-primary font-medium">
                      {alert.code || "#ORD-9804"}
                    </span>
                  </div>

                  <p className="text-xs text-text-primary font-medium leading-relaxed">
                    {alert.message}
                  </p>

                  {/* AI Vision pill if available */}
                  {alert.aiVerification && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-ai-accent/10 border border-ai-accent/30 text-ai-accent text-[11px] font-mono w-fit">
                      <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                      <span>{alert.aiVerification}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-border-subtle mt-1 text-xs">
                    <span className="text-text-secondary">
                      Sup. {alert.supervisor || "Campo"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => window.alert("Conectando llamada con supervisor...")}
                        className="bg-surface-container-high hover:bg-surface-bright text-text-primary px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[13px]">call</span>
                        <span>Llamar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.alert("Novedad validada por coordinación.")}
                        className="bg-primary hover:bg-primary-container text-on-primary px-2.5 py-1 rounded text-xs transition-colors"
                      >
                        Validar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI NLP & Gemini Multimodal Widget */}
          <div className="bg-surface-container-low rounded-xl p-5 border border-border-subtle shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-ai-accent">
                  <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Servicio NLP & Vision</h2>
                  <span className="font-mono text-[10px] text-text-muted">Sentence Transformers (Docker)</span>
                </div>
              </div>
              <span className="bg-secondary/10 text-secondary font-mono text-[10px] px-2 py-0.5 rounded-full border border-secondary/20">
                Warm • Standby
              </span>
            </div>

            {/* Metrics breakdown */}
            <div className="bg-surface-container p-3 rounded-lg border border-border-subtle flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span>Clasificación Semántica Quejas</span>
                <span className="font-mono text-text-primary font-semibold">99.2% Accuracy</span>
              </div>
              <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                <div className="bg-ai-accent h-full w-[94%]" />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-text-muted pt-0.5">
                <span>Modelo: all-MiniLM-L6-v2</span>
                <span>41ms inferencia</span>
              </div>
            </div>

            {/* Gemini Vision Box */}
            <div className="bg-surface-container p-3 rounded-lg border border-border-subtle flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-ai-accent text-xs font-medium">
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                <span>Gemini 1.5 Flash Vision Inspector</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Validando correlación fotográfica con protocolos de seguridad (EPP) y sellos de garantía.
              </p>
              <div className="flex items-center justify-between pt-1 font-mono text-[11px]">
                <span className="text-secondary">142 Fotos Validadas Hoy</span>
                <span className="text-primary text-[10px]">Umbrales OK</span>
              </div>
            </div>

            {/* AI Command Bar Simulator */}
            <form onSubmit={handleSendPrompt} className="flex items-center gap-1 bg-surface-container px-3 py-1.5 rounded-lg border border-border-subtle">
              <span className="material-symbols-outlined text-text-muted text-[16px]">terminal</span>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Instrucción IA o re-enrutar cuadrilla..."
                className="bg-transparent text-xs text-text-primary placeholder:text-text-muted w-full focus:outline-none"
              />
              <button
                type="submit"
                className="bg-surface-container-high hover:bg-surface-bright text-primary p-1 rounded transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </form>
            {aiPromptStatus && (
              <span className="text-[11px] font-mono text-secondary">{aiPromptStatus}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
