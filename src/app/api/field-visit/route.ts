import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldVisitSchema } from "@/lib/schemas";
import { memory } from "@/lib/memory-store";
import { validateGeofence } from "@/lib/geo";
import { dispatchAlert } from "@/lib/notify";

export async function POST(req: Request) {
  const gate = await requireRole(req, ["supervisor", "coordinador"]);
  if (gate.error) return gate.error;

  const parsed = fieldVisitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const visit = parsed.data;

  if (visit.checkInLat != null && visit.checkInLng != null) {
    const geo = validateGeofence(
      {
        lat: visit.checkInLat,
        lng: visit.checkInLng,
        accuracy: visit.checkInAccuracyM,
        mocked: visit.gpsMocked,
      },
      visit.siteLat != null && visit.siteLng != null
        ? { lat: visit.siteLat, lng: visit.siteLng }
        : null,
      visit.geofenceRadiusM ?? 120,
    );
    if (!geo.ok) {
      return NextResponse.json({ error: geo.reason, distanceM: geo.distanceM }, { status: 422 });
    }
  }

  const admin = createAdminClient();
  if (admin) {
    const row = {
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
      identity_verified: visit.identityVerified ?? !visit.supervisorId.startsWith("demo-"),
      notes: visit.notes ?? null,
      novedad: visit.novedad ?? null,
      novedad_priority: visit.novedadPriority ?? null,
      sync_status: "synced",
      updated_at: visit.updatedAt,
    };
    const { data, error } = await admin
      .from("visits")
      .upsert(row, { onConflict: "client_uuid" })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (visit.checklist?.length && data?.id) {
      const { error: actErr } = await admin.from("visit_activity_results").upsert(
        visit.checklist.map((item) => ({
          visit_id: data.id,
          title: item.title,
          status: item.status,
          notes: item.subtitle ?? null,
        })),
        { onConflict: "visit_id,title" },
      );
      if (actErr) {
        return NextResponse.json({ error: actErr.message }, { status: 500 });
      }
    }
    if (visit.status === "novedad") {
      await dispatchAlert({
        title: `Novedad en ${visit.siteName}`,
        body: `${visit.novedadPriority ?? "alta"}: ${visit.novedad ?? "sin detalle"} (${visit.serviceNumber ?? visit.siteName})`,
      });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  }

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
  return NextResponse.json({ ok: true, warning: "memory_fallback" });
}
