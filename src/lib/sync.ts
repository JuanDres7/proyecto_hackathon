import { db, enqueueOutbox } from "./db";
import { memory } from "./memory-store";
import { createClient, isSupabaseConfigured } from "./supabase/client";
import type { LocalVisit } from "./types";

function visitToRow(visit: LocalVisit) {
  return {
    client_uuid: visit.clientUuid,
    supervisor_id: visit.supervisorId.startsWith("demo-")
      ? null
      : visit.supervisorId,
    service_number: visit.serviceNumber ?? null,
    site_name: visit.siteName,
    contracted_activity: visit.contractedActivity,
    status: visit.status,
    check_in_at: visit.checkInAt ?? null,
    check_out_at: visit.checkOutAt ?? null,
    check_in_lat: visit.checkInLat ?? null,
    check_in_lng: visit.checkInLng ?? null,
    check_out_lat: visit.checkOutLat ?? null,
    check_out_lng: visit.checkOutLng ?? null,
    notes: visit.notes ?? null,
    novedad: visit.novedad ?? null,
    novedad_priority: visit.novedadPriority ?? null,
    updated_at: visit.updatedAt,
  };
}

function ingestMemory(visit: LocalVisit) {
  memory.visits.upsert({
    id: visit.id,
    client_uuid: visit.clientUuid,
    supervisor_id: visit.supervisorId,
    service_number: visit.serviceNumber ?? null,
    site_name: visit.siteName,
    contracted_activity: visit.contractedActivity,
    status: visit.status,
    check_in_at: visit.checkInAt ?? null,
    check_out_at: visit.checkOutAt ?? null,
    check_in_lat: visit.checkInLat ?? null,
    check_in_lng: visit.checkInLng ?? null,
    check_out_lat: visit.checkOutLat ?? null,
    check_out_lng: visit.checkOutLng ?? null,
    novedad: visit.novedad ?? null,
    notes: visit.notes ?? null,
    novedad_priority: visit.novedadPriority ?? null,
    created_at: visit.createdAt,
    updated_at: visit.updatedAt,
  });
  if (visit.status === "novedad") {
    const exists = memory.alerts.all().some((a) => a.visit_id === visit.id);
    if (!exists) {
      memory.alerts.add({
        id: crypto.randomUUID(),
        visit_id: visit.id,
        message: `Novedad en ${visit.siteName}: ${visit.novedad ?? "sin detalle"}`,
        severity: "alta",
        created_at: new Date().toISOString(),
      });
    }
  }
}

export async function persistVisit(visit: LocalVisit) {
  await db.visits.put(visit);
  await enqueueOutbox("visit", { id: visit.id });
  ingestMemory(visit);
}

export async function syncPending(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const pending = await db.outbox.orderBy("createdAt").toArray();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  if (!isSupabaseConfigured()) {
    for (const item of pending) {
      if (item.entity === "visit") {
        const visit = await db.visits.get(String(item.payload.id));
        if (visit) {
          await db.visits.update(visit.id, { syncStatus: "synced" });
          await fetch("/api/field-visit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(visit),
          }).catch(() => undefined);
        }
      }
      if (item.entity === "evidence") {
        await db.evidence.update(String(item.payload.id), { syncStatus: "synced" });
      }
      await db.outbox.delete(item.id);
    }
    return { synced: pending.length, failed: 0 };
  }

  const supabase = createClient();
  if (!supabase) return { synced: 0, failed: pending.length };

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      if (item.entity === "visit") {
        const visit = await db.visits.get(String(item.payload.id));
        if (!visit) {
          await db.outbox.delete(item.id);
          continue;
        }
        await db.visits.update(visit.id, { syncStatus: "syncing" });
        const { error } = await supabase
          .from("visits")
          .upsert(visitToRow(visit), { onConflict: "client_uuid" });
        if (error) throw error;
        await db.visits.update(visit.id, { syncStatus: "synced" });
      }

      if (item.entity === "evidence") {
        const evidence = await db.evidence.get(String(item.payload.id));
        if (!evidence) {
          await db.outbox.delete(item.id);
          continue;
        }
        await db.evidence.update(evidence.id, { syncStatus: "syncing" });
        const path = `${evidence.visitId}/${evidence.id}`;
        const { error: uploadError } = await supabase.storage
          .from("evidencias")
          .upload(path, evidence.blob, {
            contentType: evidence.mimeType,
            upsert: true,
          });
        if (uploadError) throw uploadError;
        const visit = await db.visits.get(evidence.visitId);
        const { data: visitRow } = await supabase
          .from("visits")
          .select("id")
          .eq("client_uuid", visit?.clientUuid ?? "")
          .maybeSingle();
        const { error: rowError } = await supabase.from("visit_evidence").insert({
          visit_id: visitRow?.id ?? null,
          storage_path: path,
          caption: evidence.caption ?? null,
        });
        if (rowError) throw rowError;
        await db.evidence.update(evidence.id, {
          syncStatus: "synced",
          storagePath: path,
        });
      }

      await db.outbox.delete(item.id);
      synced += 1;
    } catch {
      failed += 1;
      await db.outbox.update(item.id, { attempts: item.attempts + 1 });
      if (item.entity === "visit") {
        await db.visits.update(String(item.payload.id), { syncStatus: "error" });
      }
    }
  }

  return { synced, failed };
}

export function startSyncWorker() {
  if (typeof window === "undefined") return () => undefined;

  const run = () => {
    void syncPending();
  };

  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") run();
  });
  run();

  const interval = window.setInterval(run, 30000);

  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then((reg) => {
        const syncReg = reg as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };
        return syncReg.sync?.register("campo-sync");
      })
      .catch(() => undefined);
  }

  return () => {
    window.removeEventListener("online", run);
    window.clearInterval(interval);
  };
}
