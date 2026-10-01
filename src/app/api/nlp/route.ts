import { NextResponse } from "next/server";

function fallbackClassify(text: string) {
  const t = text.toLowerCase();
  if (t.includes("no llegó") || t.includes("no llego") || t.includes("ausente")) {
    return { label: "inasistencia", confidence: 0.72 };
  }
  if (t.includes("mal") || t.includes("sucio") || t.includes("incompleto")) {
    return { label: "calidad", confidence: 0.7 };
  }
  if (t.includes("trato") || t.includes("grosero") || t.includes("maltrato")) {
    return { label: "conducta", confidence: 0.68 };
  }
  return { label: "general", confidence: 0.55 };
}

export async function POST(req: Request) {
  const body = (await req.json()) as { text: string; serviceNumber?: string };
  const base = process.env.NLP_SERVICE_URL ?? "http://127.0.0.1:8000";

  try {
    const res = await fetch(`${base}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {
    // microservicio caído → heurística local
  }

  return NextResponse.json({
    ...fallbackClassify(body.text ?? ""),
    source: "fallback",
    serviceNumber: body.serviceNumber ?? null,
  });
}
