import { NextResponse } from "next/server";
import { generateGeminiJson } from "@/lib/ai/gemini";
import { heuristicSlots, sanitizeSlots } from "@/lib/ai/slots";
import { requireRole } from "@/lib/api-auth";

export async function POST(req: Request) {
  const gate = await requireRole(req, ["cliente", "coordinador"]);
  if (gate.error) return gate.error;

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const fallback = heuristicSlots(text);
  const model = await generateGeminiJson<Record<string, unknown>>({
    system:
      "Extrae datos de cotización dichos en el texto. Responde solo JSON con customerName, customerDocument, email, phone, openingMessage, services (aseo_general|jardineria|limpieza_piscinas), scheduledAt, location y accessNotes. Null si no está. No inventes código, precio, GPS, fecha ni estado de visita.",
    contents: [{ role: "user", parts: [{ text }] }],
  });
  if (!model.ok) {
    return NextResponse.json({ extracted: fallback, source: "heuristic" });
  }
  const extracted = { ...fallback, ...sanitizeSlots(model.data, text) };
  return NextResponse.json({ extracted, source: "gemini" });
}
