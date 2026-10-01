import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { loadClientPicture } from "@/lib/ai/client-context";
import { puroTurn } from "@/lib/ai/puro";
import { saveChatTurn } from "@/lib/orders";
import type { QuoteDraft } from "@/lib/types";

async function clientActor(req: Request) {
  const gate = await requireRole(req, ["cliente"]);
  if (gate.error) return { error: gate.error };
  if (!gate.actor.email) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { actor: gate.actor };
}

export async function GET(req: Request) {
  const gate = await clientActor(req);
  if (gate.error) return gate.error;
  const picture = await loadClientPicture({
    email: gate.actor.email!,
    fullName: gate.actor.fullName,
  });
  return NextResponse.json(picture);
}

export async function POST(req: Request) {
  const gate = await clientActor(req);
  if (gate.error) return gate.error;

  const body = (await req.json().catch(() => null)) as {
    message?: string;
    history?: { role: "user" | "assistant"; content: string }[];
    draft?: Partial<QuoteDraft>;
  } | null;

  const message = typeof body?.message === "string" ? body.message : "";
  const draft: Partial<QuoteDraft> = {
    ...(body?.draft ?? {}),
    email: gate.actor.email,
    customerName: body?.draft?.customerName?.trim() || gate.actor.fullName,
  };
  const result = await puroTurn({
    email: gate.actor.email!,
    fullName: gate.actor.fullName,
    message,
    history: Array.isArray(body?.history) ? body.history : [],
    draft,
  });

  if (message.trim()) {
    await saveChatTurn({
      draftId: draft.draftId,
      serviceNumber: result.progress?.serviceNumber,
      phase: result.situation,
      role: "user",
      content: message.slice(0, 2000),
    });
    if (result.reply) {
      await saveChatTurn({
        draftId: draft.draftId,
        serviceNumber: result.progress?.serviceNumber,
        phase: result.situation,
        role: "assistant",
        content: result.reply.slice(0, 2000),
      });
    }
  }

  return NextResponse.json(result);
}
