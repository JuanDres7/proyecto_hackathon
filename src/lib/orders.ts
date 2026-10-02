import { ensureDemoShowcase } from "./demo-data";
import { createAdminClient, withAdminTimeout } from "./supabase/admin";
import { memory } from "./memory-store";
import { CANCELLATION_REASONS, SERVICE_CATALOG } from "./catalog";
import { deriveProgress, progressMessage } from "./progress";
import { dispatchAlert } from "./notify";
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
      const { error } = await admin.from("service_orders").update(row).eq("id", existing.id);
      if (error) throw error;
      return existing.id as string;
    }
    const { data, error } = await admin.from("service_orders").insert(row).select("id").single();
    if (error) throw error;
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
    const { data, error } = await admin.rpc("confirm_service_draft", {
      p_draft: {
        draftId: draft.draftId,
        customerName: next.customerName,
        customerDocument: next.customerDocument,
        email: next.email,
        phone: next.phone,
        openingMessage: next.openingMessage,
        services: next.services,
        scheduledAt: next.scheduledAt,
        location: next.location,
        accessNotes: next.accessNotes,
      },
    });
    if (error) {
      return { ok: false as const, missing: ["persistencia"] };
    }
    if (typeof data === "string") next.serviceNumber = data;
  } else {
    memory.orders.upsert({ ...next, id: draft.draftId });
  }
  return { ok: true as const, serviceNumber: next.serviceNumber ?? code };
}

export async function simulatePayment(serviceNumber: string) {
  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.rpc("simulate_payment", { p_service_number: serviceNumber });
    if (error) return { ok: false as const };
    return { ok: true as const };
  }
  const o = memory.orders.byNumber(serviceNumber);
  if (o) memory.orders.upsert({ ...o, quoteJson: { ...(o.quoteJson ?? {}), payment: "simulated_paid" } });
  return { ok: true as const };
}

export async function getOrderByNumber(serviceNumber: string) {
  ensureDemoShowcase();
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("service_orders")
      .select("*")
      .eq("service_number", serviceNumber)
      .maybeSingle();
    if (data) {
      let supervisorName: string | null = null;
      if (data.supervisor_id) {
        const { data: profile } = await admin
          .from("profiles")
          .select("full_name")
          .eq("id", data.supervisor_id)
          .maybeSingle();
        supervisorName = profile?.full_name ?? null;
      }
      return { ...data, supervisorName };
    }
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
    visit = (data as typeof visit) ?? null;
  }
  if (!visit) visit = memory.visits.byNumber(serviceNumber);

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

function confirmedFromMemory() {
  return memory.orders.confirmed().map((order) => ({
    service_number: order.serviceNumber,
    location: order.location,
    services: order.services,
    customer_name: order.customerName,
    en_route_at: order.enRouteAt,
    supervisor_id: order.supervisorId,
    status: order.status,
  }));
}

export async function listConfirmedServices() {
  ensureDemoShowcase();
  const local = confirmedFromMemory();
  const admin = createAdminClient();
  if (!admin) return local;
  const result = await withAdminTimeout(
    admin
      .from("service_orders")
      .select("service_number, location, services, customer_name, en_route_at, supervisor_id, status")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false }),
  );
  if (!result || result.error || !result.data) return local;
  const seen = new Set(result.data.map((row) => row.service_number));
  return [...result.data, ...local.filter((row) => row.service_number && !seen.has(row.service_number))];
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
  serviceNumber?: string;
  action: "authorize_close" | "reassign" | "close_alert" | "assign_route";
  supervisorId?: string;
  alertId?: string;
  comment?: string;
  costCenterId?: string;
  scheduledStart?: string;
  actorId?: string;
}) {
  const admin = createAdminClient();
  if (opts.action === "assign_route" && opts.serviceNumber && opts.supervisorId) {
    if (admin) {
      const { data: order, error: orderErr } = await admin
        .from("service_orders")
        .select("id")
        .eq("service_number", opts.serviceNumber)
        .maybeSingle();
      if (orderErr || !order) return { ok: false, error: "no_encontrado" };
      const { error: upErr } = await admin
        .from("service_orders")
        .update({
          supervisor_id: opts.supervisorId,
          assigned_by: opts.actorId?.startsWith("demo-") ? null : opts.actorId,
          cost_center_id: opts.costCenterId ?? null,
          route_date: opts.scheduledStart ? opts.scheduledStart.slice(0, 10) : null,
        })
        .eq("id", order.id);
      if (upErr) return { ok: false, error: upErr.message };
      const { error: asErr } = await admin.from("visit_assignments").upsert(
        {
          service_order_id: order.id,
          supervisor_id: opts.supervisorId,
          assigned_by: opts.actorId?.startsWith("demo-") ? null : opts.actorId,
          scheduled_start: opts.scheduledStart ?? null,
          status: "asignada",
        },
        { onConflict: "service_order_id,supervisor_id" },
      );
      if (asErr) return { ok: false, error: asErr.message };
      await admin.from("audit_log").insert({
        actor_id: opts.actorId?.startsWith("demo-") ? null : opts.actorId,
        action: "assign_route",
        entity: "service_orders",
        entity_id: order.id,
      });
      await dispatchAlert({
        title: "Ruta asignada",
        body: `Servicio ${opts.serviceNumber} asignado.`,
        recipientIds: [opts.supervisorId],
      });
    }
    return { ok: true };
  }
  if (opts.action === "close_alert" && opts.alertId) {
    if (admin) {
      const { error } = await admin
        .from("alerts")
        .update({
          status: "closed",
          coordinator_comment: opts.comment ?? null,
          closed_at: new Date().toISOString(),
          closed_by: opts.actorId?.startsWith("demo-") ? null : opts.actorId,
        })
        .eq("id", opts.alertId);
      if (error) return { ok: false, error: error.message };
      const { data: alertRow } = await admin
        .from("alerts")
        .select("visit_id")
        .eq("id", opts.alertId)
        .maybeSingle();
      const { error: incErr } = await admin
        .from("incidents")
        .update({
          status: "closed",
          coordinator_comment: opts.comment ?? null,
          closed_at: new Date().toISOString(),
          closed_by: opts.actorId?.startsWith("demo-") ? null : opts.actorId,
        })
        .eq("alert_id", opts.alertId);
      if (incErr) return { ok: false, error: incErr.message };
      if (alertRow?.visit_id) {
        await admin
          .from("incidents")
          .update({
            status: "closed",
            coordinator_comment: opts.comment ?? null,
            closed_at: new Date().toISOString(),
            closed_by: opts.actorId?.startsWith("demo-") ? null : opts.actorId,
          })
          .eq("visit_id", alertRow.visit_id)
          .eq("status", "open");
      }
      await dispatchAlert({
        title: "Novedad cerrada",
        body: opts.comment ?? `Alerta ${opts.alertId} cerrada por coordinador.`,
      });
    }
    return { ok: true };
  }
  if (opts.action === "reassign" && opts.supervisorId && opts.serviceNumber) {
    if (admin) {
      const { error } = await admin
        .from("service_orders")
        .update({ supervisor_id: opts.supervisorId, en_route_at: null })
        .eq("service_number", opts.serviceNumber);
      if (error) return { ok: false, error: error.message };
    } else {
      const o = memory.orders.byNumber(opts.serviceNumber);
      if (o) memory.orders.upsert({ ...o, supervisorId: opts.supervisorId, enRouteAt: undefined });
    }
    return { ok: true };
  }
  if (opts.action === "authorize_close" && opts.serviceNumber) {
    if (admin) {
      const { data, error } = await admin
        .from("service_orders")
        .select("quote_json")
        .eq("service_number", opts.serviceNumber)
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
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
  const { error } = await admin.from("chat_turns").insert({
    service_number: input.serviceNumber ?? null,
    draft_id: input.draftId ?? null,
    phase: input.phase,
    role: input.role,
    content: input.content,
  });
  if (error) {
    console.error("chat_turns", error.message);
  }
}
