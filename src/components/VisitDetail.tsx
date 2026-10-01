"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, enqueueOutbox } from "@/lib/db";
import { getCurrentPosition, validateGeofence } from "@/lib/geo";
import { persistVisit, syncPending } from "@/lib/sync";
import type { ChecklistItem, LocalEvidence, LocalVisit, NovedadPriority } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

type ChecklistTask = ChecklistItem;

const INITIAL_CHECKLIST: ChecklistTask[] = [
  {
    id: "task-1",
    title: "Verificación de cableado de potencia principal",
    subtitle: "Aprobado • Protocolo RETIE",
    status: "completed",
  },
  {
    id: "task-2",
    title: "Inspección de fugas en transformador auxiliar",
    subtitle: "En ejecución técnica in-situ",
    status: "progress",
  },
  {
    id: "task-3",
    title: "Medición de resistencia de puesta a tierra",
    subtitle: "Telurómetro calibrado",
    status: "pending",
  },
];

const NOVELTY_TAGS = [
  "Retraso contratista",
  "Inconsistencia planos",
  "Acceso bloqueado",
  "Deterioro estructural",
  "Falla de suministro",
];

export function VisitDetail({ visitId }: { visitId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [visit, setVisit] = useState<LocalVisit | null>(null);
  const [photos, setPhotos] = useState<LocalEvidence[]>([]);
  const [novedad, setNovedad] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<NovedadPriority>("alta");
  const [error, setError] = useState("");
  const [checklist, setChecklist] = useState<ChecklistTask[]>(INITIAL_CHECKLIST);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const load = useCallback(async () => {
    const row = (await db.visits.get(visitId)) ?? null;
    setVisit(row);
    setNovedad(row?.novedad ?? "");
    setNotes(row?.notes ?? "");
    setPriority(row?.novedadPriority ?? "alta");
    if (row?.checklist?.length) setChecklist(row.checklist);
    setPhotos(await db.evidence.where("visitId").equals(visitId).toArray());
  }, [visitId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const row = (await db.visits.get(visitId)) ?? null;
      if (cancelled) return;
      setVisit(row);
      setNovedad(row?.novedad ?? "");
      setNotes(row?.notes ?? "");
      setPriority(row?.novedadPriority ?? "alta");
      if (row?.checklist?.length) setChecklist(row.checklist);
      const ph = await db.evidence.where("visitId").equals(visitId).toArray();
      if (cancelled) return;
      setPhotos(ph);
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  async function save(patch: Partial<LocalVisit>) {
    if (!visit) return;
    const next = {
      ...visit,
      ...patch,
      checklist: patch.checklist ?? visit.checklist ?? checklist,
      updatedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    };
    await persistVisit(next);
    setVisit(next);
  }

  async function check(kind: "in" | "out") {
    setError("");
    try {
      const geo = await getCurrentPosition();
      const fence = validateGeofence(
        geo,
        visit?.siteLat != null && visit?.siteLng != null
          ? { lat: visit.siteLat, lng: visit.siteLng }
          : { lat: 4.7642, lng: -74.0465 },
        visit?.geofenceRadiusM ?? 120,
      );
      if (!fence.ok) {
        setError(
          fence.reason === "outside_geofence"
            ? `Fuera de geocerca (${Math.round(fence.distanceM ?? 0)} m)`
            : fence.reason === "gps_spoofed"
              ? "GPS simulado detectado"
              : "Precisión GPS insuficiente",
        );
        return;
      }
      if (kind === "in") {
        await save({
          status: "en_curso",
          checkInAt: new Date().toISOString(),
          checkInLat: geo.lat,
          checkInLng: geo.lng,
          checkInAccuracyM: geo.accuracy,
          gpsMocked: geo.mocked,
          siteLat: visit?.siteLat ?? 4.7642,
          siteLng: visit?.siteLng ?? -74.0465,
          identityVerified: Boolean(user && !user.demo),
        });
      } else {
        await save({
          status: visit?.novedad ? "novedad" : "completada",
          checkOutAt: new Date().toISOString(),
          checkOutLat: geo.lat,
          checkOutLng: geo.lng,
        });
      }
    } catch {
      setError("No se pudo leer GPS. Activa ubicación o continúa con estimación local.");
    }
  }

  async function onPhoto(file: File) {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const contentHash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const evidence: LocalEvidence = {
      id: crypto.randomUUID(),
      visitId,
      blob: file,
      mimeType: file.type || "image/jpeg",
      caption: "Evidencia de campo",
      contentHash,
      syncStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    await db.evidence.put(evidence);
    await enqueueOutbox("evidence", { id: evidence.id });
    await load();
  }

  async function toggleTask(id: string) {
    const next = checklist.map((t) => {
      if (t.id !== id) return t;
      const nextStatus: ChecklistTask["status"] =
        t.status === "pending" ? "progress" : t.status === "progress" ? "completed" : "pending";
      return { ...t, status: nextStatus };
    });
    setChecklist(next);
    await save({ checklist: next });
  }

  const completedCount = checklist.filter((t) => t.status === "completed").length;
  const progressPercent = Math.round((completedCount / checklist.length) * 100);

  async function handleSaveNovelty() {
    if (!novedad.trim()) return;
    await save({
      novedad: novedad.trim(),
      notes: notes.trim(),
      novedadPriority: priority,
      status: "novedad",
    });
    setFeedbackMsg("Guardado localmente en Dexie.js");
    setTimeout(() => setFeedbackMsg(""), 3000);
  }

  async function handleManualSync() {
    setIsSyncing(true);
    try {
      await syncPending();
      await load();
    } finally {
      setIsSyncing(false);
    }
  }

  if (!visit) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-xs font-mono text-text-muted">
        Cargando detalles de la visita desde Dexie.js...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-12">
      {/* Top Navigation */}
      <button
        type="button"
        className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-fixed-dim transition-colors cursor-pointer"
        onClick={() => router.push("/supervisor")}
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        <span>Volver a la ruta de visitas</span>
      </button>

      {/* 1. Point of Service Header & Tactical Satellite Map */}
      <section className="bg-surface-container rounded-xl overflow-hidden border border-border-subtle shadow-md">
        <div className="p-4 flex items-center justify-between bg-surface-container-high border-b border-border-subtle">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">factory</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] text-text-muted uppercase">
                Punto de Servicio
              </span>
              <h2 className="text-sm font-semibold text-text-primary truncate">
                {visit.siteName}
              </h2>
              {visit.serviceNumber && (
                <p className="font-mono text-xs text-primary">Servicio {visit.serviceNumber}</p>
              )}
            </div>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/30 font-semibold">
            {visit.checkInLat != null ? "Geocerca validada" : "Geocerca pendiente"}
          </span>
        </div>

        {/* Night Tactical Satellite Map Simulation */}
        <div className="relative w-full h-40 bg-surface-container-lowest overflow-hidden flex items-center justify-center">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(#3b82f6 1px, transparent 1px), radial-gradient(#1c1b1d 1px, #0e0e10 1px)",
              backgroundSize: "20px 20px",
            }}
          />

          {/* Glowing geofence circle */}
          <div className="relative w-28 h-28 rounded-full border-2 border-primary/60 bg-primary/10 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            <div className="w-4 h-4 rounded-full bg-secondary animate-ping" />
            <div className="absolute w-2.5 h-2.5 rounded-full bg-secondary" />
          </div>

          {/* Overlay Geofence Reticle info */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-lowest/90 backdrop-blur-md border border-border-subtle text-[11px] font-mono text-text-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span>Radio: 120m | Dentro de geocerca</span>
          </div>
        </div>

        {/* Current Check-in Information */}
        <div className="p-4 space-y-3">
          <div className="bg-surface-container-low p-3 rounded-lg border border-border-subtle flex items-start gap-2.5">
            <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
              verified
            </span>
            <div className="flex flex-col text-xs">
              <p className="text-text-primary">
                <span className="font-semibold text-secondary">
                  {visit.checkInAt ? "Check-in realizado" : "Check-in pendiente"}
                </span>{" "}
                  {visit.checkInAt ? `a las ${new Date(visit.checkInAt).toLocaleString("es-CO")}` : ""}
              </p>
              <span className="font-mono text-[10px] text-text-muted mt-0.5">
                {visit.checkInLat != null
                  ? `GPS Validado: Lat ${visit.checkInLat.toFixed(4)}, Long ${visit.checkInLng?.toFixed(4)}`
                  : "Coordenadas fijadas por antena GNSS"}
              </span>
            </div>
          </div>

          {/* Big Tactile Action Buttons (Ergonomic for gloves) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {!visit.checkInAt ? (
              <button
                type="button"
                onClick={() => void check("in")}
                className="w-full min-h-[48px] bg-primary hover:bg-primary-container active:scale-[0.99] transition-all rounded-xl text-on-primary text-xs font-semibold flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">login</span>
                <span>Registrar Check-In con GPS</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void check("out")}
                className="w-full min-h-[48px] bg-primary-container hover:bg-primary active:scale-[0.99] transition-all rounded-xl text-on-primary text-xs font-semibold flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
                <span>Registrar Check-Out con GPS</span>
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                if (!visit.serviceNumber || !user) return;
                await fetch("/api/en-route", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    serviceNumber: visit.serviceNumber,
                    supervisorId: user.id,
                  }),
                });
                setFeedbackMsg("En ruta registrado para la solicitud");
                setTimeout(() => setFeedbackMsg(""), 3000);
              }}
              className="w-full min-h-[44px] bg-surface-container-high hover:bg-surface-bright active:scale-[0.99] transition-all rounded-xl text-text-primary text-xs font-medium flex items-center justify-center gap-2 border border-border-subtle cursor-pointer"
            >
              <span className="material-symbols-outlined text-tertiary text-[18px]">
                directions_walk
              </span>
              <span>Marcar en ruta</span>
            </button>
          </div>

          {error && <p className="text-xs text-status-warning font-mono">{error}</p>}
        </div>
      </section>

      {/* 2. Interactive Field Checklist */}
      <section className="bg-surface-container rounded-xl p-4 border border-border-subtle shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">checklist</span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Lista de Verificación de Campo
            </h2>
          </div>
          <span className="font-mono text-xs text-secondary font-semibold">
            {completedCount} / {checklist.length} Completadas
          </span>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Task Items */}
        <div className="space-y-2 pt-1">
          {checklist.map((task) => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className="bg-surface-container-low hover:bg-surface-container-high p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer select-none transition-colors border border-border-subtle"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    task.status === "completed"
                      ? "bg-secondary-container/40 text-secondary"
                      : task.status === "progress"
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-container-highest text-text-muted"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {task.status === "completed"
                      ? "check"
                      : task.status === "progress"
                      ? "sync"
                      : "hourglass_empty"}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-xs font-medium truncate ${
                      task.status === "completed"
                        ? "line-through text-text-muted"
                        : "text-text-primary"
                    }`}
                  >
                    {task.title}
                  </span>
                  <span className="text-[10px] text-text-muted">{task.subtitle}</span>
                </div>
              </div>

              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 ${
                  task.status === "completed"
                    ? "bg-surface-container-highest text-secondary"
                    : task.status === "progress"
                    ? "bg-primary/10 text-primary"
                    : "bg-surface-container-highest text-text-muted"
                }`}
              >
                {task.status === "completed"
                  ? "Listo"
                  : task.status === "progress"
                  ? "Activo"
                  : "Pendiente"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Photographic Evidence & Offline Novelties */}
      <section className="bg-surface-container rounded-xl p-4 border border-border-subtle shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-ai-accent text-[20px]">
              photo_camera
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Evidencias & Novedades
            </h2>
          </div>
          <span className="font-mono text-[10px] text-ai-accent">Dexie Camera API</span>
        </div>

        {/* Camera Native Capture Button */}
        <label className="cursor-pointer flex items-center justify-center gap-2 w-full min-h-[44px] rounded-xl bg-surface-container-highest hover:bg-surface-bright active:scale-[0.99] transition-transform text-text-primary border border-border-subtle">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPhoto(file);
            }}
          />
          <span className="material-symbols-outlined text-secondary text-[22px]">
            add_a_photo
          </span>
          <span className="text-xs font-semibold">Tomar Foto de Evidencia</span>
        </label>

        {/* Gallery */}
        <div>
          <span className="text-[10px] font-mono text-text-muted uppercase mb-2 block">
            Imágenes en cola local ({photos.length})
          </span>
          <div className="grid grid-cols-2 gap-2">
            {photos.map((photo) => (
              <LocalPhotoItem key={photo.id} photo={photo} />
            ))}
          </div>
        </div>

        {/* Incident Reporting Form */}
        <div className="space-y-2 pt-2 border-t border-border-subtle">
          <label className="text-[11px] text-text-secondary font-medium">
            Reportar Novedad / Impedimento de Campo:
          </label>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5">
            {NOVELTY_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setNovedad((prev) => (prev ? `${prev}, ${tag}` : tag))}
                className="px-2.5 py-1 rounded-full bg-surface-container-low hover:bg-surface-container-highest text-on-surface text-[11px] transition-colors border border-border-subtle active:scale-95"
              >
                {tag}
              </button>
            ))}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas de la visita"
            className="w-full bg-surface-container-lowest px-3 py-2 rounded-lg text-xs"
          />
          <label className="text-[11px] text-text-secondary">Prioridad de la novedad (la define el supervisor)</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as NovedadPriority)}
            className="w-full bg-surface-container-lowest px-3 py-2 rounded-lg text-xs"
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          <input
            type="text"
            value={novedad}
            onChange={(e) => setNovedad(e.target.value)}
            placeholder="Escriba detalle o seleccione etiqueta..."
            className="w-full bg-surface-container-lowest px-3 py-2 rounded-lg text-xs text-text-primary placeholder:text-text-muted outline-none border border-border-subtle focus:border-primary transition-colors"
          />
          <button
            type="button"
            onClick={handleSaveNovelty}
            className="h-8 px-3 rounded bg-surface-container-high hover:bg-primary hover:text-on-primary text-text-primary text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">save</span>
            <span>Guardar</span>
          </button>

          {feedbackMsg && (
            <p className="text-[11px] text-secondary flex items-center gap-1 font-mono pt-1">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              <span>{feedbackMsg}</span>
            </p>
          )}
        </div>
      </section>

      {/* 4. Supabase Sync Engine Bottom Panel */}
      <section className="bg-surface-container-high rounded-xl p-4 border border-border-subtle shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">
              cloud_sync
            </span>
            <span className="text-xs font-semibold text-text-primary">
              Motor de Sincronización Supabase
            </span>
          </div>
          <span className="font-mono text-[10px] text-secondary">Offline-First Engine</span>
        </div>

        <p className="text-[11px] text-text-secondary leading-relaxed">
          Toda la información capturada (check-in, fotos, novedades) persiste de manera segura en el
          navegador y se enviará al restaurar la conexión a Supabase Storage y PostgreSQL.
        </p>

        <div className="mt-3 flex items-center justify-between pt-2 border-t border-border-subtle">
          <span className="text-[10px] font-mono text-text-muted">
            Estado de visita: <b>{visit.syncStatus}</b>
          </span>
          <button
            type="button"
            disabled={isSyncing}
            onClick={handleManualSync}
            className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-bright text-xs font-medium text-text-primary border border-border-subtle flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-[14px] text-primary ${
                isSyncing ? "animate-spin" : ""
              }`}
            >
              sync
            </span>
            <span>{isSyncing ? "Sincronizando..." : "Forzar Sincronización"}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function LocalPhotoItem({ photo }: { photo: LocalEvidence }) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const objectUrl = URL.createObjectURL(photo.blob);
    queueMicrotask(() => {
      if (!cancelled) setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [photo.blob]);

  return (
    <div className="relative rounded-lg overflow-hidden bg-surface-container-lowest h-28 border border-border-subtle group">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Evidencia" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-surface-container" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas-base via-canvas-base/80 to-transparent p-1.5 flex flex-col">
        <span className="font-mono text-[9px] text-text-primary truncate">
          {photo.caption || "Evidencia.jpg"}
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
          <span className="font-mono text-[9px] text-tertiary">Dexie.js Stored</span>
        </div>
      </div>
      <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-canvas-base/80 text-secondary backdrop-blur-sm">
        ±3m GPS
      </span>
    </div>
  );
}
