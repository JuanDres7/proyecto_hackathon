import type { SupabaseClient } from "@supabase/supabase-js";
import { askGemini } from "./gemini";
import {
  cancelOrder,
  confirmOrder,
  createDraft,
  findOrder,
  logTurn,
  saveSlots,
  type OrderRecord,
} from "./orders";
import { confirmationReply, mergeSlots, missingSlotFields, slotsFromUnknown } from "./slots";
import {
  CANCEL_LABELS,
  type CancellationReason,
  type ChatRequest,
  type ChatResponse,
  type QuoteSlots,
} from "./types";

const REASONS = new Set<CancellationReason>(["data_error", "plans_changed", "too_expensive", "other"]);

function baseResponse(order: OrderRecord | null, reply: string, extra: Partial<ChatResponse> = {}): ChatResponse {
  const locked = Boolean(order?.enRouteAt);
  return {
    draftId: order?.draftId ?? null,
    serviceNumber: order?.status === "cancelled" ? null : (order?.serviceNumber ?? null),
    phase: "cotizacion",
    reply,
    canEdit: Boolean(order?.serviceNumber) && order?.status === "confirmed" && !locked,
    canCancel: Boolean(order?.serviceNumber) && order?.status === "confirmed" && !locked,
    progress: null,
    evaluationSaved: false,
    pqrOpened: false,
    awaitingConfirmation: order?.awaitingConfirmation ?? false,
    ...extra,
  };
}

async function phraseConfirmation(slots: QuoteSlots): Promise<string> {
  const fallback = confirmationReply(slots);
  const gemini = await askGemini(
    `Redacta en español, en una sola pregunta, la confirmación de esta cita. No inventes un código de servicio ni un precio. Datos: ${JSON.stringify(slots)}. Responde JSON {"reply":"..."}.`,
  );
  if (!gemini.ok || !gemini.data.reply) return fallback;
  return gemini.data.reply;
}

export async function handleQuote(db: SupabaseClient, body: ChatRequest): Promise<ChatResponse> {
  const draftId = body.draftId || crypto.randomUUID();
  const order = (await findOrder(db, { draftId, serviceNumber: body.serviceNumber })) ?? (await createDraft(db, draftId));

  if (body.cancellationReason) {
    if (!REASONS.has(body.cancellationReason)) {
      return baseResponse(order, "Elige un motivo de cancelación: error de datos, cambio de planes, costoso u otro.");
    }
    if (order.enRouteAt) {
      return baseResponse(order, "El supervisor ya va en ruta. Ya no puedes cancelar este servicio.");
    }
    const cancelled = await cancelOrder(db, order, body.cancellationReason);
    const reply = `El servicio quedó cancelado. Motivo: ${CANCEL_LABELS[body.cancellationReason]}.`;
    await logTurn(db, { draftId: cancelled.draftId, serviceNumber: cancelled.serviceNumber, phase: "cotizacion", role: "assistant", content: reply });
    return baseResponse(cancelled, reply, { serviceNumber: null, canEdit: false, canCancel: false, awaitingConfirmation: false });
  }

  if (body.confirmation === "no") {
    const saved = await saveSlots(db, order, order.slots, false);
    const reply = "De acuerdo. Corrige los datos y vuelve a confirmar.";
    await logTurn(db, { draftId: saved.draftId, serviceNumber: saved.serviceNumber, phase: "cotizacion", role: "assistant", content: reply });
    return baseResponse(saved, reply);
  }

  if (body.confirmation === "yes") {
    const missing = missingSlotFields(order.slots);
    if (missing.length > 0) {
      return baseResponse(order, `Falta: ${missing.join(", ")}.`);
    }
    const confirmed = await confirmOrder(db, order);
    const reply = confirmed.serviceNumber
      ? `Listo. Tu código de servicio es ${confirmed.serviceNumber}. Es el mismo que verá el supervisor.`
      : "No se pudo emitir el código.";
    await logTurn(db, { draftId: confirmed.draftId, serviceNumber: confirmed.serviceNumber, phase: "cotizacion", role: "assistant", content: reply });
    return baseResponse(confirmed, reply);
  }

  let slots = mergeSlots(order.slots, body.slots);
  if (body.message?.trim()) {
    await logTurn(db, { draftId: order.draftId, serviceNumber: order.serviceNumber, phase: "cotizacion", role: "user", content: body.message });
    const gemini = await askGemini(
      `Extrae datos de cotización de servicios de aseo, jardinería o piscinas. No inventes código ni precio. Servicios válidos: aseo_general, jardineria, limpieza_piscinas. Responde JSON {"reply":"...","slots":{"customerName":"","customerDocument":"","email":"","phone":"","openingMessage":"","services":[],"scheduledAt":"","location":"","accessNotes":""}}. Mensaje: ${body.message}. Datos ya conocidos: ${JSON.stringify(order.slots)}`,
    );
    if (gemini.ok) slots = slotsFromUnknown(gemini.data.slots, slots);
    else if (!body.slots) {
      const reply = "No pude completar la conversación. Completa el formulario y confirma.";
      return baseResponse(order, reply);
    }
  }

  const missing = missingSlotFields(slots);
  if (missing.length > 0) {
    const saved = await saveSlots(db, order, slots, false);
    const reply = `Me falta: ${missing.join(", ")}.`;
    await logTurn(db, { draftId: saved.draftId, serviceNumber: saved.serviceNumber, phase: "cotizacion", role: "assistant", content: reply });
    return baseResponse(saved, reply);
  }

  const saved = await saveSlots(db, order, slots, true);
  const reply = await phraseConfirmation(saved.slots);
  await logTurn(db, { draftId: saved.draftId, serviceNumber: saved.serviceNumber, phase: "cotizacion", role: "assistant", content: reply });
  return baseResponse(saved, reply, { awaitingConfirmation: true });
}
