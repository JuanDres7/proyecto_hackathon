"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db, enqueueOutbox } from "@/lib/db";
import { getCurrentPosition } from "@/lib/geo";
import { syncPending, persistVisit } from "@/lib/sync";
import type { LocalEvidence, LocalVisit, NovedadPriority } from "@/lib/types";
import type { ServiceCatalogId } from "@/lib/catalog";
import { serviceLabels } from "@/lib/catalog";
import {
  activitiesFor,
  decodeVisitFlow,
  encodeVisitFlow,
  finishBlockers,
  hasCaption,
  markPhaseFour,
  type VisitFlow,
} from "./visit-flow";

export function useSupervisorVisit(visitId: string) {
  const [visit, setVisit] = useState<LocalVisit | null>(null);
  const [flow, setFlow] = useState<VisitFlow | null>(null);
  const [photos, setPhotos] = useState<LocalEvidence[]>([]);
  const [novedad, setNovedad] = useState("");
  const [priority, setPriority] = useState<NovedadPriority>("media");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const visitRef = useRef<LocalVisit | null>(null);
  const flowRef = useRef<VisitFlow | null>(null);
  const flushGate = useRef({ writing: false, dirty: false, pending: Promise.resolve() });

  const remember = useCallback((nextVisit: LocalVisit, nextFlow: VisitFlow) => {
    visitRef.current = nextVisit;
    flowRef.current = nextFlow;
    setVisit(nextVisit);
    setFlow(nextFlow);
  }, []);

  const flush = useCallback(async () => {
    const gate = flushGate.current;
    if (gate.writing) {
      gate.dirty = true;
      return gate.pending;
    }
    gate.writing = true;
    gate.pending = (async () => {
      try {
        do {
          gate.dirty = false;
          const currentVisit = visitRef.current;
          const currentFlow = flowRef.current;
          if (!currentVisit || !currentFlow) return;
          const saved: LocalVisit = {
            ...currentVisit,
            notes: encodeVisitFlow(currentFlow),
            contractedActivity:
              currentFlow.serviceIds.length > 0
                ? serviceLabels(currentFlow.serviceIds)
                : currentVisit.contractedActivity,
            siteName: currentFlow.address || currentVisit.siteName,
            updatedAt: new Date().toISOString(),
            syncStatus: "pending",
          };
          await persistVisit(saved);
          if (visitRef.current === currentVisit && flowRef.current === currentFlow) {
            remember(saved, currentFlow);
          } else {
            gate.dirty = true;
          }
        } while (gate.dirty);
      } finally {
        gate.writing = false;
      }
    })();
    return gate.pending;
  }, [remember]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const row = (await db.visits.get(visitId)) ?? null;
      const evidence = await db.evidence.where("visitId").equals(visitId).toArray();
      if (cancelled) return;
      setPhotos(evidence);
      if (row) {
        const decoded = decodeVisitFlow(row.notes, row);
        remember(row, decoded);
        setNovedad(row.novedad ?? "");
        setPriority(row.novedadPriority ?? "media");
      } else {
        visitRef.current = null;
        flowRef.current = null;
        setVisit(null);
        setFlow(null);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [remember, visitId]);

  async function chooseService(serviceId: ServiceCatalogId) {
    const currentFlow = flowRef.current;
    if (!visitRef.current || !currentFlow) return;
    flowRef.current = {
      ...currentFlow,
      serviceIds: [serviceId],
      activities: activitiesFor([serviceId]),
    };
    setFlow(flowRef.current);
    await flush();
  }

  async function goToPhase(phase: VisitFlow["phase"]) {
    const currentVisit = visitRef.current;
    const currentFlow = flowRef.current;
    if (!currentVisit || !currentFlow || currentVisit.checkOutAt) return;
    setError("");
    if (phase > currentFlow.phase) {
      const evidence = await db.evidence.where("visitId").equals(visitId).toArray();
      const captions = evidence.map((photo) => photo.caption ?? "");
      if (currentFlow.phase === 1 && currentFlow.serviceIds.length === 0) {
        setError("Elige el tipo de servicio.");
        return;
      }
      if (currentFlow.phase === 2 && !currentVisit.checkInAt) {
        setError("Inicia la visita.");
        return;
      }
      if (currentFlow.phase === 2 && !hasCaption(captions, "antes")) {
        setError("Adjunta la foto pedida.");
        return;
      }
    }
    flowRef.current =
      phase === 4 && currentFlow.phase < 4 ? markPhaseFour(currentFlow) : { ...currentFlow, phase };
    setFlow(flowRef.current);
    await flush();
  }

  async function startVisit() {
    const currentVisit = visitRef.current;
    const currentFlow = flowRef.current;
    if (!currentVisit || !currentFlow || currentVisit.checkInAt) return false;
    setBusy(true);
    setError("");
    try {
      const geo = await getCurrentPosition();
      visitRef.current = {
        ...currentVisit,
        status: "en_curso",
        checkInAt: new Date().toISOString(),
        checkInLat: geo.lat,
        checkInLng: geo.lng,
        checkInAccuracyM: geo.accuracy,
      };
      setVisit(visitRef.current);
      await flush();
      return true;
    } catch {
      setError("Activa la ubicación para iniciar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(file: File, kind: "antes" | "despues" | "novedad") {
    const currentFlow = flowRef.current;
    if (!currentFlow) return;
    const caption = kind === "antes" ? `antes:${currentFlow.beforeSubject}` : kind;
    const evidence: LocalEvidence = {
      id: crypto.randomUUID(),
      visitId,
      blob: file,
      mimeType: file.type || "image/jpeg",
      caption,
      syncStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    await db.evidence.put(evidence);
    await enqueueOutbox("evidence", { id: evidence.id });
    setPhotos(await db.evidence.where("visitId").equals(visitId).toArray());
    setError("");
  }

  function updateActivity(id: string, patch: Partial<VisitFlow["activities"][number]>) {
    const currentFlow = flowRef.current;
    if (!currentFlow) return;
    const nextFlow = {
      ...currentFlow,
      activities: currentFlow.activities.map((activity) =>
        activity.id === id ? { ...activity, ...patch } : activity,
      ),
    };
    flowRef.current = nextFlow;
    setFlow(nextFlow);
  }

  async function persistFlow() {
    await flush();
  }

  function updateClientNotes(clientNotes: string) {
    const currentFlow = flowRef.current;
    if (!currentFlow) return;
    const nextFlow = { ...currentFlow, clientNotes };
    flowRef.current = nextFlow;
    setFlow(nextFlow);
  }

  async function saveNovedad(text: string, nextPriority: NovedadPriority) {
    const currentVisit = visitRef.current;
    const currentFlow = flowRef.current;
    if (!currentVisit || !currentFlow) return;
    setNovedad(text);
    setPriority(nextPriority);
    visitRef.current = {
      ...currentVisit,
      novedad: text.trim() || undefined,
      novedadPriority: nextPriority,
    };
    setVisit(visitRef.current);
    await flush();
  }

  async function finishVisit() {
    const currentVisit = visitRef.current;
    const currentFlow = flowRef.current;
    if (!currentVisit || !currentFlow || currentVisit.checkOutAt) return;
    const evidence = await db.evidence.where("visitId").equals(visitId).toArray();
    const captions = evidence.map((photo) => photo.caption ?? "");
    const blocker = finishBlockers(currentFlow, hasCaption(captions, "despues"));
    if (blocker) {
      setError(blocker);
      return;
    }
    setBusy(true);
    setError("");
    try {
      let checkOutLat = currentVisit.checkInLat;
      let checkOutLng = currentVisit.checkInLng;
      try {
        const geo = await getCurrentPosition();
        checkOutLat = geo.lat;
        checkOutLng = geo.lng;
      } catch {
        // La hora de salida la fija el sistema aunque el GPS falle en la salida.
      }
      const trimmed = novedad.trim();
      visitRef.current = {
        ...currentVisit,
        status: trimmed ? "novedad" : "completada",
        checkOutAt: new Date().toISOString(),
        checkOutLat,
        checkOutLng,
        novedad: trimmed || undefined,
        novedadPriority: trimmed ? priority : currentVisit.novedadPriority,
      };
      flowRef.current = { ...currentFlow, phase: 4 };
      setVisit(visitRef.current);
      setFlow(flowRef.current);
      await flush();
      if (typeof navigator === "undefined" || navigator.onLine) {
        await syncPending();
        const row = (await db.visits.get(visitId)) ?? null;
        if (row) remember(row, decodeVisitFlow(row.notes, row));
      }
    } finally {
      setBusy(false);
    }
  }

  return {
    visit,
    flow,
    photos,
    novedad,
    priority,
    error,
    busy,
    ready,
    chooseService,
    goToPhase,
    startVisit,
    addPhoto,
    updateActivity,
    persistFlow,
    updateClientNotes,
    setNovedad,
    setPriority,
    saveNovedad,
    finishVisit,
  };
}
