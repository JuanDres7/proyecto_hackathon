import { NextResponse } from "next/server";
import { memory } from "@/lib/memory-store";

export async function POST(req: Request) {
  const visit = (await req.json()) as {
    id: string;
    clientUuid: string;
    supervisorId: string;
    serviceNumber?: string;
    siteName: string;
    contractedActivity: string;
    status: string;
    checkInAt?: string;
    checkOutAt?: string;
    checkInLat?: number;
    checkInLng?: number;
    checkOutLat?: number;
    checkOutLng?: number;
    novedad?: string;
    notes?: string;
    novedadPriority?: string;
    createdAt: string;
    updatedAt: string;
  };
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
  return NextResponse.json({ ok: true });
}
