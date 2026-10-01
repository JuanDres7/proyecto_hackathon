import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";
import { confirmationReply, mergeSlots, missingSlotFields, slotsFromUnknown } from "./slots";
import {
  emptySlots,
  type CancellationReason,
  type ChatPhase,
  type QuoteSlots,
} from "./types";

export type OrderRecord = {
  id: string;
  serviceNumber: string | null;
  status: string;
  slots: QuoteSlots;
  draftId: string | null;
  enRouteAt: string | null;
  supervisorId: string | null;
  awaitingConfirmation: boolean;
};

type Row = {
  id: string;
  service_number: string | null;
  status: string;
  quote_json: { draftId?: string; awaitingConfirmation?: boolean; slots?: QuoteSlots } | null;
  en_route_at: string | null;
  supervisor_id: string | null;
  customer_name: string | null;
  customer_document: string | null;
  email: string | null;
  phone: string | null;
  opening_message: string | null;
  services: string[] | null;
  scheduled_at: string | null;
  location: string | null;
  access_notes: string | null;
};

function fromRow(row: Row): OrderRecord {
  const stored = slotsFromUnknown(row.quote_json?.slots);
  const slots = mergeSlots(stored, {
    customerName: row.customer_name ?? "",
    customerDocument: row.customer_document ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    openingMessage: row.opening_message ?? "",
    services: (row.services ?? []) as QuoteSlots["services"],
    scheduledAt: row.scheduled_at ? row.scheduled_at.slice(0, 16) : "",
    location: row.location ?? "",
    accessNotes: row.access_notes ?? "",
  });
  return {
    id: row.id,
    serviceNumber: row.service_number,
    status: row.status,
    slots,
    draftId: row.quote_json?.draftId ?? null,
    enRouteAt: row.en_route_at,
    supervisorId: row.supervisor_id,
    awaitingConfirmation: Boolean(row.quote_json?.awaitingConfirmation),
  };
}

const COLUMNS =
  "id, service_number, status, quote_json, en_route_at, supervisor_id, customer_name, customer_document, email, phone, opening_message, services, scheduled_at, location, access_notes";

export function requireAdmin(): SupabaseClient {
  const client = createAdminClient();
  if (!client) {
    throw new Error("No hay réplica local de la base. Configura Supabase CLI y SUPABASE_SERVICE_ROLE_KEY.");
  }
  return client;
}

export async function findOrder(
  db: SupabaseClient,
  input: { draftId?: string | null; serviceNumber?: string | null },
): Promise<OrderRecord | null> {
  if (input.serviceNumber) {
    const { data } = await db
      .from("service_orders")
      .select(COLUMNS)
      .eq("service_number", input.serviceNumber)
      .maybeSingle();
    if (data) return fromRow(data as Row);
  }
  if (input.draftId) {
    const { data } = await db
      .from("service_orders")
      .select(COLUMNS)
      .filter("quote_json->>draftId", "eq", input.draftId)
      .maybeSingle();
    if (data) return fromRow(data as Row);
  }
  return null;
}

export async function createDraft(db: SupabaseClient, draftId: string): Promise<OrderRecord> {
  const existing = await findOrder(db, { draftId });
  if (existing) return existing;
  const { data, error } = await db
    .from("service_orders")
    .insert({
      status: "draft",
      customer_name: "",
      quote_json: { draftId, awaitingConfirmation: false, slots: emptySlots() },
    })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el borrador");
  return fromRow(data as Row);
}

function rowPatch(slots: QuoteSlots, extra: Record<string, unknown>) {
  return {
    customer_name: slots.customerName,
    customer_document: slots.customerDocument,
    email: slots.email,
    phone: slots.phone,
    opening_message: slots.openingMessage,
    services: slots.services,
    scheduled_at: slots.scheduledAt ? new Date(slots.scheduledAt).toISOString() : null,
    location: slots.location,
    access_notes: slots.accessNotes || null,
    ...extra,
  };
}

export async function saveSlots(
  db: SupabaseClient,
  order: OrderRecord,
  slots: QuoteSlots,
  awaitingConfirmation: boolean,
): Promise<OrderRecord> {
  const missing = missingSlotFields(slots);
  const status =
    order.serviceNumber && order.status === "confirmed"
      ? awaitingConfirmation
        ? "pending_confirmation"
        : "confirmed"
      : awaitingConfirmation
        ? "pending_confirmation"
        : "draft";
  const { data, error } = await db
    .from("service_orders")
    .update(
      rowPatch(slots, {
        status: missing.length > 0 ? "draft" : status,
        quote_json: {
          draftId: order.draftId,
          awaitingConfirmation: missing.length === 0 && awaitingConfirmation,
          slots,
        },
      }),
    )
    .eq("id", order.id)
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo guardar la cotización");
  return fromRow(data as Row);
}

export async function confirmOrder(db: SupabaseClient, order: OrderRecord): Promise<OrderRecord> {
  if (missingSlotFields(order.slots).length > 0) {
    throw new Error("Faltan datos para confirmar");
  }
  if (order.serviceNumber && order.status === "confirmed") return order;

  let serviceNumber = order.serviceNumber;
  if (!serviceNumber) {
    const { data: seq, error: seqError } = await db.rpc("next_service_code");
    if (seqError) throw new Error(seqError.message);
    serviceNumber = `#${seq as number}`;
  }

  const { data, error } = await db
    .from("service_orders")
    .update(
      rowPatch(order.slots, {
        status: "confirmed",
        service_number: serviceNumber,
        cancellation_reason: null,
        quote_json: {
          draftId: order.draftId,
          awaitingConfirmation: false,
          slots: order.slots,
        },
      }),
    )
    .eq("id", order.id)
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo confirmar");
  return fromRow(data as Row);
}

export async function cancelOrder(
  db: SupabaseClient,
  order: OrderRecord,
  reason: CancellationReason,
): Promise<OrderRecord> {
  if (order.enRouteAt) throw new Error("El supervisor ya va en ruta. No se puede cancelar.");
  if (order.status !== "confirmed" && order.status !== "pending_confirmation") {
    throw new Error("No hay un servicio confirmado para cancelar.");
  }
  const { data, error } = await db
    .from("service_orders")
    .update({ status: "cancelled", cancellation_reason: reason })
    .eq("id", order.id)
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "No se pudo cancelar");
  return fromRow(data as Row);
}

export async function logTurn(
  db: SupabaseClient,
  input: { draftId: string | null; serviceNumber: string | null; phase: ChatPhase; role: "user" | "assistant"; content: string },
) {
  if (!input.content.trim()) return;
  await db.from("chat_turns").insert({
    draft_id: input.draftId,
    service_number: input.serviceNumber,
    phase: input.phase,
    role: input.role,
    content: input.content,
  });
}

export function summarize(order: OrderRecord): string {
  return confirmationReply(order.slots);
}

export async function listConfirmed(db: SupabaseClient) {
  const { data, error } = await db
    .from("service_orders")
    .select("service_number, location, services, status")
    .eq("status", "confirmed")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    serviceNumber: row.service_number as string,
    location: (row.location as string | null) ?? "",
    services: (row.services as string[] | null) ?? [],
  }));
}
