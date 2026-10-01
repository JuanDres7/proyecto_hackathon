import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { clientOwnsService, lookupProgress, saveChatTurn } from "@/lib/orders";
import { z } from "zod";

const schema = z.object({ serviceNumber: z.string().optional() });

export async function POST(req: Request) {
  const gate = await requireRole(req, ["cliente", "coordinador", "supervisor"]);
  if (gate.error) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const raw = (parsed.data.serviceNumber ?? "").trim();
  const code = raw.startsWith("#") ? raw : raw ? `#${raw.replace(/^#/, "")}` : "";
  if (!code || code === "#") {
    return NextResponse.json({
      status: "sin_servicio_activo",
      message: "No hay un servicio activo con ese código.",
    });
  }
  if (gate.actor.role === "cliente") {
    const owns = await clientOwnsService(gate.actor.email, code);
    if (!owns) {
      return NextResponse.json({
        status: "sin_servicio_activo",
        message: `El código ${code} no está entre tus servicios.`,
        serviceNumber: code,
      });
    }
  }
  const result = await lookupProgress(code);
  await saveChatTurn({
    serviceNumber: code,
    phase: "progreso",
    role: "assistant",
    content: result.message,
  });
  return NextResponse.json({ ...result, serviceNumber: code });
}
