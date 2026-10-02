import { NextResponse } from "next/server";
import { puroTurn, type PuroPhase } from "@/lib/ai/puro";
import { saveChatTurn } from "@/lib/orders";
import { requireRole } from "@/lib/api-auth";
import { seedUserById } from "@/lib/seed-users";

const PHASES = new Set<PuroPhase>(["cotizacion", "progreso", "finalizacion"]);

export async function POST(req: Request) {
  const gate = await requireRole(req, ["cliente", "coordinador", "supervisor"]);
  if (gate.error) return gate.error;

  const body = (await req.json().catch(() => null)) as {
    phase?: PuroPhase;
    message?: string;
    history?: { role: "user" | "assistant"; content: string }[];
    draft?: {
      draftId?: string;
      serviceNumber?: string;
      customerName?: string;
      customerDocument?: string;
      email?: string;
      phone?: string;
      openingMessage?: string;
      services?: string[];
      scheduledAt?: string;
      location?: string;
      accessNotes?: string;
    };
    serviceNumber?: string;
    editsLocked?: boolean;
  } | null;

  const phase = body?.phase && PHASES.has(body.phase) ? body.phase : "cotizacion";
  const message = typeof body?.message === "string" ? body.message : "";
  const result = await puroTurn({
    phase,
    message,
    history: Array.isArray(body?.history) ? body.history : [],
    draft: body?.draft,
    serviceNumber: body?.serviceNumber ?? body?.draft?.serviceNumber,
    editsLocked: body?.editsLocked,
    email: gate.actor.email || seedUserById(gate.actor.id)?.email,
  });

  if (message.trim()) {
    void saveChatTurn({
      draftId: body?.draft?.draftId,
      serviceNumber: result.progress?.serviceNumber ?? body?.serviceNumber,
      phase,
      role: "user",
      content: message.slice(0, 2000),
    });
    if (result.reply) {
      void saveChatTurn({
        draftId: body?.draft?.draftId,
        serviceNumber: result.progress?.serviceNumber ?? body?.serviceNumber,
        phase,
        role: "assistant",
        content: result.reply.slice(0, 2000),
      });
    }
  }

  return NextResponse.json(result);
}
