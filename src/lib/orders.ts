import { createAdminClient } from "./supabase/admin";
import { memory } from "./memory-store";
import { CANCELLATION_REASONS, SERVICE_CATALOG } from "./catalog";
import { deriveProgress, progressMessage } from "./progress";
import type { QuoteDraft } from "./types";

const CATALOG_IDS = SERVICE_CATALOG.map((s) => s.id);

export function requiredQuoteFields(d: Partial<QuoteDraft>) {
  const missing: string[] = [];
  if (!d.customerName?.trim()) missing.push("nombre");
  if (!d.customerDocument?.trim()) missing.push("identificación");
  if (!d.email?.trim()) missing.push("correo");
  if (!d.phone?.trim()) missing.push("teléfono");
  if (!d.openingMessage?.trim()) missing.push("mensaje inicial");
  if (!d.services?.length) missing.push("servicios");
  if (!d.scheduledAt?.trim()) missing.push("fecha y hora");
  if (!d.location?.trim()) missing.push("ubicación");
  return missing;
}

export function sanitizeServices(ids: string[] | undefined) {
  return (ids ?? []).filter((id) => CATALOG_IDS.includes(id as (typeof CATALOG_IDS)[number]));
}

export async function issueServiceNumber(): Promise<string> {
  const admin = createAdminClient();
  if (admin) {
    const { data, error } = await admin.rpc("issue_service_number");
    if (!error && typeof data === "string") return data;
  }
  return memory.nextCode();
}

export async function saveDraft(draft: QuoteDraft) {
  const admin = createAdminClient();
  const services = sanitizeServices(draft.services);
  const row = {
    service_number: draft.serviceNumber ?? `draft-${draft.draftId}`,
    customer_name: draft.customerName ?? null,
    customer_document: draft.customerDocument ?? null,
    email: draft.email ?? null,
    phone: draft.phone ?? null,
    opening_message: draft.openingMessage ?? null,
    services,
    scheduled_at: draft.scheduledAt ?? null,
    location: draft.location ?? null,
    access_notes: draft.accessNotes ?? null,
    quote_json: { draftId: draft.draftId },
    status: draft.status,
  };

  if (admin) {
    const { data: existing } = await admin
      .from("service_orders")
      .select("id")
      .eq("quote_json->>draftId", draft.draftId)
      .maybeSingle();
    if (existing?.id) {
      await admin.from("service_orders").update(row).eq("id", existing.id);
      return existing.id as string;
    }
    const { data } = await admin.from("service_orders").insert(row).select("id").single();
    return data?.id as string;
  }

  memory.orders.upsert({
    ...draft,
    id: draft.draftId,
    services,
  });
  return draft.draftId;
}

export async function confirmDraft(draft: QuoteDraft) {
  const missing = requiredQuoteFields(draft);
  if (missing.length) {
    return { ok: false as const, missing };
  }
  const existingNumber = draft.serviceNumber;
  const code = existingNumber?.startsWith("#") ? existingNumber : await issueServiceNumber();
  const next: QuoteDraft = {
    ...draft,
    services: sanitizeServices(draft.services),
    serviceNumber: code,
    status: "confirmed",
  };
  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("service_orders")
      .update({
        service_number: code,
        customer_name: next.customerName,
        customer_document: next.customerDocument,
        email: next.email,
        phone: next.phone,
        opening_message: next.openingMessage,
        services: next.services,
        scheduled_at: next.scheduledAt,
        location: next.location,
        access_notes: next.accessNotes ?? null,
        status: "confirmed",
        quote_json: { draftId: draft.draftId },
      })
      .or(`service_number.eq.draft-${draft.draftId},quote_json->>draftId.eq.${draft.draftId}`);
    const { data: found } = await admin
      .from("service_orders")
      .select("id")
      .eq("quote_json->>draftId", draft.draftId)
      .maybeSingle();
    if (!found) {
      await admin.from("service_orders").insert({
        service_number: code,
        customer_name: next.customerName,
        customer_document: next.customerDocument,
        email: next.email,
        phone: next.phone,
        opening_message: next.openingMessage,
        services: next.services,
        scheduled_at: next.scheduledAt,
        location: next.location,
        access_notes: next.accessNotes ?? null,
        status: "confirmed",
        quote_json: { draftId: draft.draftId },
      });
    }
  } else {
    memory.orders.upsert({ ...next, id: draft.draftId });
  }
  return { ok: true as const, serviceNumber: code };
}

export async function getOrderByNumber(serviceNumber: string) {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("service_orders")
      .select("*")
      .eq("service_number", serviceNumber)
      .maybeSingle();
    if (!data) return null;
    let supervisorName: string | null = null;
    if (data.supervisor_id) {
      const { data: p } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", data.supervisor_id)
        .maybeSingle();
      supervisorName = p?.full_name ?? null;
    }
    return { ...data, supervisorName };
  }
  return memory.orders.byNumber(serviceNumber) ?? null;
}

export async function cancelOrder(serviceNumber: string, reason: string) {
  if (!CANCELLATION_REASONS.some((r) => r.id === reason)) {
    return { ok: false as const, error: "motivo_invalido" };
  }
  const order = await getOrderByNumber(serviceNumber);
  if (!order) return { ok: false as const, error: "no_encontrado" };
  const enRoute = "en_route_at" in order ? order.en_route_at : (order as { enRouteAt?: string }).enRouteAt;
  if (enRoute) return { ok: false as const, error: "en_ruta" };

  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("service_orders")
      .update({ status: "cancelled", cancellation_reason: reason })
      .eq("service_number", serviceNumber);
  } else {
    const mem = memory.orders.byNumber(serviceNumber);
    if (mem) memory.orders.upsert({ ...mem, status: "cancelled", cancellationReason: reason });
  }
  return { ok: true as const };
}

export async function lookupProgress(serviceNumber: string) {
  const order = await getOrderByNumber(serviceNumber);
  const cancelled =
    order &&
    (("status" in order && order.status === "cancelled") ||
      (order as QuoteDraft).status === "cancelled");
  if (!order || cancelled) {
    return {
      status: "sin_servicio_activo" as const,
      message: "No hay un servicio activo con ese código.",
    };
  }

  const admin = createAdminClient();
  let visit: ReturnType<typeof memory.visits.byNumber> = null;
  if (admin) {
    const { data } = await admin
      .from("visits")
      .select("*")
      .eq("service_number", serviceNumber)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    visit = data as typeof visit;
  } else {
    visit = memory.visits.byNumber(serviceNumber);
  }

  const facts = {
    status: (order as { status: string }).status,
    supervisorName:
      (order as { supervisorName?: string }).supervisorName ?? null,
    supervisorId:
      (order as { supervisor_id?: string; supervisorId?: string }).supervisor_id ??
      (order as { supervisorId?: string }).supervisorId ??
      null,
    enRouteAt:
      (order as { en_route_at?: string; enRouteAt?: string }).en_route_at ??
      (order as { enRouteAt?: string }).enRouteAt ??
      null,
  };
  const visitFacts = visit
    ? {
        checkInAt: visit.check_in_at,
        checkOutAt: visit.check_out_at,
        novedad: visit.novedad,
        contractedActivity: visit.contracted_activity,
        siteName: visit.site_name,
      }
    : null;
  const status = deriveProgress(facts, visitFacts);
  return {
    status,
    message: progressMessage(status, facts),
    visit: visitFacts,
    services: (order as { services?: string[] }).services ?? [],
  };
}

export async function listConfirmedServices() {
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("service_orders")
      .select("service_number, location, services, customer_name, en_route_at, supervisor_id, status, scheduled_at")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false });
    return data ?? [];
  }
  return memory.orders.confirmed().map((o) => ({
    service_number: o.serviceNumber,
    location: o.location,
    services: o.services,
    customer_name: o.customerName,
    scheduled_at: o.scheduledAt,
    en_route_at: o.enRouteAt,
    supervisor_id: o.supervisorId,
    status: o.status,
  }));
}

export async function markEnRoute(serviceNumber: string, supervisorId: string) {
  const admin = createAdminClient();
  const at = new Date().toISOString();
  if (admin) {
    await admin
      .from("service_orders")
      .update({ en_route_at: at, supervisor_id: supervisorId.startsWith("demo-") ? null : supervisorId })
      .eq("service_number", serviceNumber);
  } else {
    const o = memory.orders.byNumber(serviceNumber);
    if (o) memory.orders.upsert({ ...o, enRouteAt: at, supervisorId });
  }
  return at;
}

export async function coordinatorAction(opts: {
  serviceNumber: string;
  action: "authorize_close" | "reassign";
  supervisorId?: string;
}) {
  const admin = createAdminClient();
  if (opts.action === "reassign" && opts.supervisorId) {
    if (admin) {
      await admin
        .from("service_orders")
        .update({ supervisor_id: opts.supervisorId, en_route_at: null })
        .eq("service_number", opts.serviceNumber);
    } else {
      const o = memory.orders.byNumber(opts.serviceNumber);
      if (o) memory.orders.upsert({ ...o, supervisorId: opts.supervisorId, enRouteAt: undefined });
    }
    return { ok: true };
  }
  if (opts.action === "authorize_close") {
    if (admin) {
      const { data } = await admin
        .from("service_orders")
        .select("quote_json")
        .eq("service_number", opts.serviceNumber)
        .maybeSingle();
      await admin
        .from("service_orders")
        .update({
          quote_json: { ...(data?.quote_json as object), coordinator_closed: true },
        })
        .eq("service_number", opts.serviceNumber);
    } else {
      const o = memory.orders.byNumber(opts.serviceNumber);
      if (o) memory.orders.upsert({ ...o, quoteJson: { coordinator_closed: true } });
    }
    return { ok: true };
  }
  return { ok: false };
}

export async function saveChatTurn(input: {
  serviceNumber?: string;
  draftId?: string;
  phase: string;
  role: string;
  content: string;
}) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("chat_turns").insert({
    service_number: input.serviceNumber ?? null,
    draft_id: input.draftId ?? null,
    phase: input.phase,
    role: input.role,
    content: input.content,
  });
}
