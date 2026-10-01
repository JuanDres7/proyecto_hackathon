import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyComment } from "./classify";
import { findOrder, logTurn } from "./orders";
import { signedPhotoUrl, storeComplaintPhoto } from "./photos";
import { dissatisfactionSummary } from "./summary";
import type { ChatRequest, ChatResponse } from "./types";
import { comparePhoto } from "./vision";

export async function handleEvaluation(db: SupabaseClient, body: ChatRequest): Promise<ChatResponse> {
  const code = body.serviceNumber?.trim() || null;
  const order = code ? await findOrder(db, { serviceNumber: code }) : null;
  if (!order || order.status !== "confirmed" || !order.serviceNumber) {
    return empty(body.draftId ?? null, "No hay un servicio activo con ese código.");
  }

  const { data: visit } = await db
    .from("visits")
    .select("id, check_out_at, contracted_activity")
    .eq("service_number", order.serviceNumber)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const activities = visit?.contracted_activity
    ? String(visit.contracted_activity)
        .split("\n")
        .map((line: string) => line.trim())
        .filter(Boolean)
    : [];
  const photos = await closurePhotos(db, visit?.id ?? null);

  if (body.rating == null && !body.message?.trim() && !body.photoDataUrl) {
    const reply = `Tu servicio ${order.serviceNumber} ha finalizado.`;
    return {
      ...empty(order.draftId, reply, order.serviceNumber),
      activities,
      photos,
    };
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return empty(order.draftId, "La calificación debe ser de 1 a 5 estrellas.", order.serviceNumber);
  }

  const { data: existing } = await db
    .from("complaints")
    .select("id")
    .eq("service_number", order.serviceNumber)
    .maybeSingle();
  if (existing) {
    return empty(order.draftId, "Esta evaluación ya fue enviada.", order.serviceNumber);
  }

  const comment = body.message?.trim() ?? "";
  const photoPath = await storeComplaintPhoto(db, order.serviceNumber, body.photoDataUrl);
  const classified = await classifyComment(comment, order.serviceNumber);
  const vision = await comparePhoto(comment, body.photoDataUrl);
  const summary = await dissatisfactionSummary({
    rating,
    comment,
    label: classified.label,
  });

  const { error } = await db.from("complaints").insert({
    service_number: order.serviceNumber,
    body: comment,
    photo_path: photoPath,
    rating,
    label: classified.label,
    confidence: classified.confidence,
    vision_valid: vision.visionValid,
    vision_note: vision.visionNote,
    summary,
  });
  if (error) throw new Error(error.message);

  let pqrOpened = false;
  if (rating < 3) {
    const { error: pqrError } = await db.from("pqr_cases").insert({
      service_number: order.serviceNumber,
      priority: "alta",
      status: "open",
    });
    if (pqrError && !pqrError.message.includes("duplicate")) throw new Error(pqrError.message);
    pqrOpened = true;
  }

  const reply = pqrOpened
    ? "Recibimos tu evaluación. Quedó escalada al coordinador con prioridad alta."
    : "Recibimos tu evaluación. Gracias.";
  await logTurn(db, {
    draftId: order.draftId,
    serviceNumber: order.serviceNumber,
    phase: "finalizacion",
    role: "assistant",
    content: reply,
  });

  return {
    draftId: order.draftId,
    serviceNumber: order.serviceNumber,
    phase: "finalizacion",
    reply,
    canEdit: false,
    canCancel: false,
    progress: "finalizado",
    evaluationSaved: true,
    pqrOpened,
    activities,
    photos,
  };
}

async function closurePhotos(db: SupabaseClient, visitId: string | null) {
  if (!visitId) return [];
  const { data } = await db.from("visit_evidence").select("caption, storage_path").eq("visit_id", visitId);
  const photos = [];
  for (const row of data ?? []) {
    const url = await signedPhotoUrl(db, row.storage_path);
    if (!url) continue;
    photos.push({ label: row.caption || "Evidencia", url });
  }
  return photos;
}

function empty(draftId: string | null, reply: string, serviceNumber: string | null = null): ChatResponse {
  return {
    draftId,
    serviceNumber,
    phase: "finalizacion",
    reply,
    canEdit: false,
    canCancel: false,
    progress: serviceNumber ? "finalizado" : null,
    evaluationSaved: false,
    pqrOpened: false,
  };
}
