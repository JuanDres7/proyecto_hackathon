import { NextResponse } from "next/server";
import { lookupProgress, saveChatTurn } from "@/lib/orders";

export async function POST(req: Request) {
  const body = (await req.json()) as { serviceNumber?: string };
  const raw = (body.serviceNumber ?? "").trim();
  const code = raw.startsWith("#") ? raw : raw ? `#${raw.replace(/^#/, "")}` : "";
  if (!code || code === "#") {
    return NextResponse.json({
      status: "sin_servicio_activo",
      message: "No hay un servicio activo con ese código.",
    });
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
