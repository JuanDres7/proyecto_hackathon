import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { ordersBodySchema } from "@/lib/schemas";
import {
  cancelOrder,
  clientOwnsService,
  confirmDraft,
  requiredQuoteFields,
  saveChatTurn,
  saveDraft,
  sanitizeServices,
  simulatePayment,
} from "@/lib/orders";
import type { QuoteDraft } from "@/lib/types";

export async function POST(req: Request) {
  const gate = await requireRole(req, ["cliente", "coordinador", "supervisor"]);
  if (gate.error) return gate.error;

  const parsed = ordersBodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const body = parsed.data;

  const draft: QuoteDraft = {
    ...body.draft,
    services: sanitizeServices(body.draft.services),
  };

  if (gate.actor.role === "cliente") {
    if (!gate.actor.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    draft.email = gate.actor.email;
    if (!draft.customerName?.trim() && gate.actor.fullName) draft.customerName = gate.actor.fullName;
    if ((body.action === "cancel" || body.action === "pay") && draft.serviceNumber) {
      const owns = await clientOwnsService(gate.actor.email, draft.serviceNumber);
      if (!owns) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  if (body.action === "pay") {
    if (!draft.serviceNumber) {
      return NextResponse.json({ ok: false, error: "sin_codigo" }, { status: 400 });
    }
    const result = await simulatePayment(draft.serviceNumber);
    return NextResponse.json(result);
  }

  if (body.action === "save" || body.action === "reject") {
    const next = {
      ...draft,
      status:
        body.action === "reject"
          ? ("draft" as const)
          : draft.status === "confirmed"
            ? ("pending_confirmation" as const)
            : draft.status,
    };
    try {
      await saveDraft(next);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
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
