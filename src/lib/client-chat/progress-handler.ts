import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrder, logTurn } from "./orders";
import { deriveClientProgress } from "./progress";
import { progressReply } from "./progress-templates";
import type { ChatRequest, ChatResponse, ProgressState } from "./types";

const PROGRESS_MAP: Record<string, ProgressState | null> = {
  inactive: null,
  pendiente_sincronizacion: "pendiente_sincronizacion",
  asignado: "asignado",
  en_camino: "en_camino",
  pausa_novedad: "pausa_novedad",
  en_ejecucion: "en_ejecucion",
  finalizado: "finalizado",
  sin_asignar: null,
};

export async function handleProgress(db: SupabaseClient, body: ChatRequest): Promise<ChatResponse> {
  const code = body.serviceNumber?.trim() || body.message?.match(/#\d+/)?.[0] || null;
  const order = code ? await findOrder(db, { serviceNumber: code }) : null;
  if (!order || order.status === "cancelled" || order.status === "draft") {
    return {
      draftId: order?.draftId ?? body.draftId ?? null,
      serviceNumber: null,
      phase: "progreso",
      reply: "No hay un servicio activo con ese código.",
      canEdit: false,
      canCancel: false,
      progress: null,
      evaluationSaved: false,
      pqrOpened: false,
    };
  }

  const { data: profile } = order.supervisorId
    ? await db.from("profiles").select("full_name, id").eq("id", order.supervisorId).maybeSingle()
    : { data: null };
  const { data: visit } = await db
    .from("visits")
    .select("check_in_at, check_out_at, novedad, contracted_activity")
    .eq("service_number", order.serviceNumber)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const derived = deriveClientProgress({
    orderStatus: order.status,
    enRouteAt: order.enRouteAt,
    supervisorName: profile?.full_name ?? null,
    supervisorDocument: profile?.id ?? null,
    visit: visit
      ? {
          checkInAt: visit.check_in_at,
          checkOutAt: visit.check_out_at,
          novedad: visit.novedad,
          contractedActivity: visit.contracted_activity,
        }
      : null,
  });
  const reply = progressReply(derived);
  const locked =
    Boolean(order.enRouteAt) ||
    derived.kind === "en_camino" ||
    derived.kind === "en_ejecucion" ||
    derived.kind === "pausa_novedad" ||
    derived.kind === "finalizado" ||
    derived.kind === "pendiente_sincronizacion";
  await logTurn(db, {
    draftId: order.draftId,
    serviceNumber: order.serviceNumber,
    phase: "progreso",
    role: "assistant",
    content: reply,
  });
  return {
    draftId: order.draftId,
    serviceNumber: order.serviceNumber,
    phase: "progreso",
    reply,
    canEdit: order.status === "confirmed" && !locked,
    canCancel: order.status === "confirmed" && !locked,
    progress: PROGRESS_MAP[derived.kind] ?? null,
    evaluationSaved: false,
    pqrOpened: false,
  };
}
