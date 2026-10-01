import { NextResponse } from "next/server";
import { handleEvaluation } from "@/lib/client-chat/evaluation";
import { requireAdmin } from "@/lib/client-chat/orders";
import { handleProgress } from "@/lib/client-chat/progress-handler";
import { handleQuote } from "@/lib/client-chat/quote";
import type { ChatPhase, ChatRequest } from "@/lib/client-chat/types";

const PHASES = new Set<ChatPhase>(["cotizacion", "progreso", "finalizacion"]);

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ reply: "No pude leer la solicitud." }, { status: 400 });
  }
  if (!PHASES.has(body.phase)) {
    return NextResponse.json({ reply: "Fase no reconocida." }, { status: 400 });
  }

  try {
    const db = requireAdmin();
    if (body.phase === "cotizacion") return NextResponse.json(await handleQuote(db, body));
    if (body.phase === "progreso") return NextResponse.json(await handleProgress(db, body));
    return NextResponse.json(await handleEvaluation(db, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo completar la operación.";
    return NextResponse.json(
      {
        draftId: body.draftId ?? null,
        serviceNumber: null,
        phase: body.phase,
        reply: message,
        canEdit: false,
        canCancel: false,
        progress: null,
        evaluationSaved: false,
        pqrOpened: false,
      },
      { status: 500 },
    );
  }
}
