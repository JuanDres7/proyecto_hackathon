import { NextResponse } from "next/server";
import {
  cancelOrder,
  confirmDraft,
  requiredQuoteFields,
  saveChatTurn,
  saveDraft,
  sanitizeServices,
} from "@/lib/orders";
import type { QuoteDraft } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: "save" | "confirm" | "cancel" | "reject";
    draft: QuoteDraft;
    reason?: string;
  };

  const draft: QuoteDraft = {
    ...body.draft,
    services: sanitizeServices(body.draft.services),
  };

  if (body.action === "save" || body.action === "reject") {
    const next = { ...draft, status: body.action === "reject" ? "draft" as const : (draft.status === "confirmed" ? "pending_confirmation" as const : draft.status) };
    await saveDraft(next);
    await saveChatTurn({
      draftId: draft.draftId,
      serviceNumber: draft.serviceNumber,
      phase: "cotizacion",
      role: "user",
      content: body.action === "reject" ? "No" : "Borrador actualizado",
    });
    return NextResponse.json({ ok: true, draft: next, missing: requiredQuoteFields(next) });
  }

  if (body.action === "confirm") {
    const result = await confirmDraft(draft);
    if (!result.ok) {
      return NextResponse.json({ ok: false, missing: result.missing });
    }
    await saveChatTurn({
      draftId: draft.draftId,
      serviceNumber: result.serviceNumber,
      phase: "cotizacion",
      role: "assistant",
      content: `Código emitido: ${result.serviceNumber}`,
    });
    return NextResponse.json({ ok: true, serviceNumber: result.serviceNumber });
  }

  if (body.action === "cancel") {
    if (!draft.serviceNumber) {
      return NextResponse.json({ ok: false, error: "sin_codigo" }, { status: 400 });
    }
    if (!body.reason) {
      return NextResponse.json({ ok: false, error: "sin_motivo" }, { status: 400 });
    }
    const result = await cancelOrder(draft.serviceNumber, body.reason);
    return NextResponse.json(result);
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
