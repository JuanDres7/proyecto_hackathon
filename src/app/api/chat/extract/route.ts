import { NextResponse } from "next/server";
import { SERVICE_CATALOG } from "@/lib/catalog";
import { requireRole } from "@/lib/api-auth";
import { generateGeminiJson } from "@/lib/ai/gemini";

type Extracted = {
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

function heuristic(text: string): Extracted {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = text.match(/\b\d{7,15}\b/)?.[0];
  const services = SERVICE_CATALOG.filter(
    (s) => text.toLowerCase().includes(s.label.toLowerCase()) || text.toLowerCase().includes(s.id),
  ).map((s) => s.id);
  return {
    email,
    phone,
    openingMessage: text,
    services,
  };
}

export async function POST(req: Request) {
  const gate = await requireRole(req, ["cliente", "coordinador"]);
  if (gate.error) return gate.error;
  const body = (await req.json()) as { text: string };
  const base = heuristic(body.text);
  const model = await generateGeminiJson<Extracted>({
    system:
      "Extrae datos de cotización. Responde SOLO JSON con claves: customerName, customerDocument, email, phone, openingMessage, services (array aseo_general|jardineria|limpieza_piscinas), scheduledAt, location, accessNotes. No inventes código, precio ni estado de visita.",
    contents: [{ role: "user", parts: [{ text: body.text }] }],
  });
  if (!model.ok) return NextResponse.json({ extracted: base, source: "heuristic" });
  return NextResponse.json({
    extracted: {
      ...base,
      ...Object.fromEntries(Object.entries(model.data).filter(([, v]) => v != null && v !== "")),
    },
    source: "gemini",
  });
}
