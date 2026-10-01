import { serviceLabels } from "./catalog";
import { decodeVisitFlow } from "@/components/supervisor/visit-flow";
import { ensureDemoShowcase } from "./demo-data";
import { memory } from "./memory-store";
import { deriveProgress, type DerivedStatus } from "./progress";
import { createAdminClient } from "./supabase/admin";
import type { LocalVisit } from "./types";

export type ClientServiceSummary = {
  serviceNumber: string;
  services: string[];
  serviceLabel: string;
  location: string;
  scheduledAt: string | null;
  status: DerivedStatus;
  supervisorName: string | null;
  accessNotes: string | null;
};

export type ClientServiceDetail = ClientServiceSummary & {
  customerName: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  novedad: string | null;
  novedadPriority: string | null;
  clientNotes: string;
  activities: { label: string; group: string; done: boolean; justification: string }[];
};

const STATUS_LABEL: Record<DerivedStatus, string> = {
  sin_servicio_activo: "Sin servicio activo",
  pendiente_sincronizacion: "En ruta",
  asignado: "Asignado",
  en_camino: "En camino",
  pausa_novedad: "En pausa por novedad",
  en_ejecucion: "En ejecución",
  finalizado: "Finalizado",
  confirmado_sin_supervisor: "Confirmado",
};

export function statusLabel(status: DerivedStatus) {
  return STATUS_LABEL[status];
}

function normalizeCode(raw: string) {
  const digits = raw.trim().replace(/^#/, "");
  if (!/^\d{3,8}$/.test(digits)) return "";
  return `#${digits}`;
}

export async function listServicesForEmail(email: string): Promise<ClientServiceSummary[]> {
  ensureDemoShowcase();
  const wanted = email.trim().toLowerCase();
  if (!wanted) return [];
  const rows = await loadOwned(wanted);
  return rows.sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));
}

export async function serviceDetailForEmail(email: string, code: string): Promise<ClientServiceDetail | null> {
  const serviceNumber = normalizeCode(code);
  if (!serviceNumber) return null;
  const owned = await listServicesForEmail(email);
  if (!owned.some((item) => item.serviceNumber === serviceNumber)) return null;
  const summary = owned.find((item) => item.serviceNumber === serviceNumber);
  if (!summary) return null;

  const order = memory.orders.byNumber(serviceNumber);
  let visit = memory.visits.byNumber(serviceNumber);
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("visits")
      .select("*")
      .eq("service_number", serviceNumber)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) visit = data as typeof visit;
  }

  const localVisit: LocalVisit = {
    id: visit?.id ?? serviceNumber,
    clientUuid: visit?.client_uuid ?? serviceNumber,
    supervisorId: visit?.supervisor_id ?? "demo-supervisor",
    serviceNumber,
    siteName: visit?.site_name ?? summary.location,
    contractedActivity: visit?.contracted_activity ?? summary.serviceLabel,
    status: (visit?.status as LocalVisit["status"]) ?? "pendiente",
    syncStatus: "synced",
    notes: visit?.notes ?? undefined,
    checkInAt: visit?.check_in_at ?? undefined,
    checkOutAt: visit?.check_out_at ?? undefined,
    novedad: visit?.novedad ?? undefined,
    createdAt: visit?.created_at ?? summary.scheduledAt ?? new Date().toISOString(),
    updatedAt: visit?.updated_at ?? summary.scheduledAt ?? new Date().toISOString(),
  };
  const flow = visit?.notes?.includes("limpiapp-visit-flow")
    ? decodeVisitFlow(visit.notes ?? undefined, localVisit)
    : null;

  return {
    ...summary,
    customerName: order?.customerName ?? null,
    checkInAt: visit?.check_in_at ?? null,
    checkOutAt: visit?.check_out_at ?? null,
    novedad: visit?.novedad ?? null,
    novedadPriority: visit?.novedad_priority ?? null,
    clientNotes: flow?.clientNotes ?? "",
    activities: (flow?.activities ?? []).map((activity) => ({
      label: activity.label,
      group: activity.group,
      done: activity.done,
      justification: activity.justification,
    })),
  };
}

async function loadOwned(email: string): Promise<ClientServiceSummary[]> {
  const local = servicesFromMemory(email);
  const admin = createAdminClient();
  if (!admin) return local;
  try {
    const remote = await within(servicesFromSupabase(admin, email), 1500);
    const seen = new Set(remote.map((item) => item.serviceNumber));
    return [...remote, ...local.filter((item) => !seen.has(item.serviceNumber))];
  } catch {
    return local;
  }
}

async function servicesFromSupabase(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  email: string,
): Promise<ClientServiceSummary[]> {
    const { data } = await admin
      .from("service_orders")
      .select("service_number, location, services, scheduled_at, status, supervisor_id, en_route_at, access_notes, email")
      .eq("status", "confirmed")
      .ilike("email", email);
    const items: ClientServiceSummary[] = [];
    for (const row of data ?? []) {
      if (!row.service_number) continue;
      const { data: visit } = await admin
        .from("visits")
        .select("check_in_at, check_out_at, novedad")
        .eq("service_number", row.service_number)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const status = deriveProgress(
        {
          status: row.status,
          supervisorId: row.supervisor_id,
          enRouteAt: row.en_route_at,
          services: row.services ?? [],
        },
        visit
          ? { checkInAt: visit.check_in_at, checkOutAt: visit.check_out_at, novedad: visit.novedad }
          : null,
      );
      items.push({
        serviceNumber: row.service_number,
        services: row.services ?? [],
        serviceLabel: serviceLabels(row.services ?? []) || "Servicio",
        location: row.location ?? "Sin ubicación",
        scheduledAt: row.scheduled_at,
        status,
        supervisorName: null,
        accessNotes: row.access_notes,
      });
    }
  return items;
}

function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function servicesFromMemory(email: string): ClientServiceSummary[] {
  return memory.orders
    .confirmed()
    .filter((order) => (order.email ?? "").toLowerCase() === email && order.serviceNumber)
    .map((order) => {
      const visit = memory.visits.byNumber(order.serviceNumber!);
      const status = deriveProgress(
        {
          status: order.status,
          supervisorId: order.supervisorId,
          supervisorName: order.supervisorName,
          enRouteAt: order.enRouteAt,
          services: order.services,
        },
        visit
          ? { checkInAt: visit.check_in_at, checkOutAt: visit.check_out_at, novedad: visit.novedad }
          : null,
      );
      return {
        serviceNumber: order.serviceNumber!,
        services: order.services,
        serviceLabel: serviceLabels(order.services) || "Servicio",
        location: order.location ?? "Sin ubicación",
        scheduledAt: order.scheduledAt ?? null,
        status,
        supervisorName: order.supervisorName ?? null,
        accessNotes: order.accessNotes ?? null,
      };
    });
}
