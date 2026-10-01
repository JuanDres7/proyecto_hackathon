import { db, enqueueOutbox } from "./db";
import { memory } from "./memory-store";
import { createClient, isSupabaseConfigured } from "./supabase/client";
import type { LocalVisit } from "./types";

const MAX_ATTEMPTS = 5;

function visitToRow(visit: LocalVisit) {
  return {
    client_uuid: visit.clientUuid,
    supervisor_id: visit.supervisorId.startsWith("demo-") ? null : visit.supervisorId,
    service_number: visit.serviceNumber ?? null,
    cost_center_id: visit.costCenterId ?? null,
    site_name: visit.siteName,
    contracted_activity: visit.contractedActivity,
    status: visit.status,
    check_in_at: visit.checkInAt ?? null,
    check_out_at: visit.checkOutAt ?? null,
    check_in_lat: visit.checkInLat ?? null,
    check_in_lng: visit.checkInLng ?? null,
    check_out_lat: visit.checkOutLat ?? null,
    check_out_lng: visit.checkOutLng ?? null,
    check_in_accuracy_m: visit.checkInAccuracyM ?? null,
    gps_mocked: visit.gpsMocked ?? null,
    site_lat: visit.siteLat ?? null,
    site_lng: visit.siteLng ?? null,
    geofence_radius_m: visit.geofenceRadiusM ?? 120,
    identity_verified: visit.identityVerified ?? false,
    notes: visit.notes ?? null,
    novedad: visit.novedad ?? null,
    novedad_priority: visit.novedadPriority ?? null,
    sync_status: "synced",
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
    novedad: visit.novedad ?? null,
    notes: visit.notes ?? null,
    novedad_priority: visit.novedadPriority ?? null,
    created_at: visit.createdAt,
    updated_at: visit.updatedAt,
  });
}

export async function persistVisit(visit: LocalVisit) {
  await db.visits.put(visit);
  await enqueueOutbox("visit", { id: visit.id });
  ingestMemory(visit);
}

async function hashBlob(blob: Blob) {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function postVisitApi(visit: LocalVisit) {
  const res = await fetch("/api/field-visit", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(visit),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function syncPending(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const pending = await db.outbox.orderBy("createdAt").toArray();
  const due = pending.filter((item) => !item.nextAttemptAt || item.nextAttemptAt <= new Date().toISOString());
  if (due.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const supabase = createClient();

  for (const item of due) {
    try {
      if (item.entity === "visit") {
        const visit = await db.visits.get(String(item.payload.id));
        if (!visit) {
          await db.outbox.delete(item.id);
          continue;
        }
        await db.visits.update(visit.id, { syncStatus: "syncing" });
        if (isSupabaseConfigured() && supabase && !visit.supervisorId.startsWith("demo-")) {
          const { error } = await supabase.from("visits").upsert(visitToRow(visit), { onConflict: "client_uuid" });
          if (error) throw error;
        } else {
          await postVisitApi(visit);
        }
        await db.visits.update(visit.id, { syncStatus: "synced" });
      }

      if (item.entity === "evidence") {
        const evidence = await db.evidence.get(String(item.payload.id));
        if (!evidence) {
          await db.outbox.delete(item.id);
          continue;
        }
        if (!isSupabaseConfigured() || !supabase) {
          await db.evidence.update(evidence.id, { syncStatus: "synced" });
          await db.outbox.delete(item.id);
          synced += 1;
          continue;
        }
        const hash = evidence.contentHash ?? (await hashBlob(evidence.blob));
        await db.evidence.update(evidence.id, { contentHash: hash, syncStatus: "syncing" });
        const path = `${evidence.visitId}/${hash}`;
        const { error: uploadError } = await supabase.storage.from("evidencias").upload(path, evidence.blob, {
          contentType: evidence.mimeType,
          upsert: true,
        });
        if (uploadError) throw uploadError;
        const visit = await db.visits.get(evidence.visitId);
        const { data: visitRow, error: findErr } = await supabase
          .from("visits")
          .select("id")
          .eq("client_uuid", visit?.clientUuid ?? "")
          .maybeSingle();
        if (findErr) throw findErr;
        if (!visitRow?.id) throw new Error("visit_not_synced");
        const { error: rowError } = await supabase.from("visit_evidence").upsert(
          {
            visit_id: visitRow.id,
            storage_path: path,
            caption: evidence.caption ?? null,
            content_hash: hash,
            client_uuid: evidence.id,
          },
          { onConflict: "visit_id,storage_path" },
        );
        if (rowError) throw rowError;
        await db.evidence.update(evidence.id, { syncStatus: "synced", storagePath: path, contentHash: hash });
      }

      await db.outbox.delete(item.id);
      synced += 1;
    } catch (err) {
      failed += 1;
      const attempts = item.attempts + 1;
      const lastError = err instanceof Error ? err.message : "sync_error";
      if (attempts >= MAX_ATTEMPTS) {
        await db.deadletter.add({
          ...item,
          attempts,
          lastError,
          failedAt: new Date().toISOString(),
        });
        await db.outbox.delete(item.id);
        if (item.entity === "visit") {
          await db.visits.update(String(item.payload.id), { syncStatus: "dead" });
        }
        if (item.entity === "evidence") {
          await db.evidence.update(String(item.payload.id), { syncStatus: "dead" });
        }
      } else {
        const delayMs = Math.min(30 * 60 * 1000, 2000 * 2 ** attempts);
        await db.outbox.update(item.id, {
          attempts,
          lastError,
          nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
        });
        if (item.entity === "visit") {
          await db.visits.update(String(item.payload.id), { syncStatus: "error" });
        }
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
  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event.data?.type === "CAMPO_SYNC") run();
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
