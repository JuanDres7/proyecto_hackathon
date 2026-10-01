import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string; serviceNumber?: string };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({
      label: "general",
      confidence: 1,
      source: "rule",
      serviceNumber: body.serviceNumber ?? null,
    });
  }

  const base = process.env.NLP_SERVICE_URL ?? "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${base}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, serviceNumber: body.serviceNumber }),
    });
    if (res.ok) return NextResponse.json(await res.json());
  } catch {
    // El contenedor no está disponible. No se inventa una clase.
  }

  return NextResponse.json({
    label: "pending",
    confidence: null,
    source: "fallback",
    serviceNumber: body.serviceNumber ?? null,
  });
}
