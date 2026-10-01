import { NextResponse } from "next/server";
import { SERVICE_CATALOG } from "@/lib/catalog";

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
  const services = SERVICE_CATALOG.filter((s) =>
    text.toLowerCase().includes(s.label.toLowerCase()) || text.toLowerCase().includes(s.id),
  ).map((s) => s.id);
  return {
    email,
    phone,
    openingMessage: text,
    services,
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as { text: string };
  const base = heuristic(body.text);
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ extracted: base, source: "heuristic" });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Extrae datos de cotización. Responde SOLO JSON con claves: customerName, customerDocument, email, phone, openingMessage, services (array con valores aseo_general|jardineria|limpieza_piscinas), scheduledAt (ISO si puedes), location, accessNotes. No inventes campos vacíos, ni código, ni precio, ni hora si no está, ni ubicación si no está, ni estado de visita.\nTexto:${body.text}`,
              },
            ],
          },
        ],
      }),
    },
  );
  if (!res.ok) return NextResponse.json({ extracted: base, source: "heuristic" });
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as Extracted;
    return NextResponse.json({
      extracted: {
        ...base,
        ...Object.fromEntries(Object.entries(parsed).filter(([, v]) => v != null && v !== "")),
      },
      source: "gemini",
    });
  } catch {
    return NextResponse.json({ extracted: base, source: "heuristic" });
  }
}
