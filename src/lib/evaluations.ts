import { createAdminClient } from "./supabase/admin";
import { memory } from "./memory-store";

export async function classifyComment(text: string, serviceNumber?: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { label: "general", confidence: 100, source: "empty", nlp_json: null as Record<string, unknown> | null };
  }

  const base = process.env.NLP_SERVICE_URL ?? "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${base}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, serviceNumber }),
    });
    if (res.ok) {
      const json = (await res.json()) as { label?: string; confidence?: number };
      const raw = json.confidence ?? 0;
      const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
      return {
        label: json.label ?? "pending",
        confidence: Math.min(100, Math.max(0, pct)),
        source: "nlp",
        nlp_json: json as Record<string, unknown>,
      };
    }
  } catch {
    // classifier down
  }
  return { label: "pending", confidence: null as number | null, source: "unavailable", nlp_json: null };
}

export async function visionCheck(opts: { comment: string; image?: string }) {
  if (!opts.image) {
    return { vision_valid: null as boolean | null, vision_note: "No se adjuntó foto." };
  }
  if (!opts.comment.trim()) {
    return {
      vision_valid: null as boolean | null,
      vision_note: "No hay texto que contrastar.",
    };
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      vision_valid: true,
      vision_note: "Revisión visual no disponible; se guarda la foto sin bloquear la evaluación.",
    };
  }

  const [meta, data] = opts.image.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "¿La foto corresponde al comentario del cliente? Responde solo JSON {\"match\":true|false,\"note\":\"frase corta en español\"}. No inventes códigos, precios, horas ni estados.",
              },
              { text: `Comentario: ${opts.comment}` },
              { inline_data: { mime_type: mime, data } },
            ],
          },
        ],
      }),
    },
  );
  if (!res.ok) {
    return {
      vision_valid: null as boolean | null,
      vision_note: "La revisión visual no estuvo disponible.",
    };
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as { match?: boolean; note?: string };
    return {
      vision_valid: Boolean(parsed.match),
      vision_note: parsed.note ?? (parsed.match ? "La foto corresponde al texto." : "La foto no corresponde al texto."),
    };
  } catch {
    return {
      vision_valid: null as boolean | null,
      vision_note: "No se pudo interpretar la revisión visual.",
    };
  }
}

export function fallbackSummary(rating: number, comment: string) {
  const c = comment.trim() || "sin comentario";
  return `Calificación ${rating} de 5. Comentario: ${c}.`;
}

export async function summarizeEvaluation(rating: number, comment: string, label: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fallbackSummary(rating, comment);
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Resume en español, una o dos frases, esta evaluación. No inventes código, precio, hora, ubicación ni estado de visita. Estrellas:${rating}. Clase:${label}. Comentario:${comment || "(vacío)"}`,
                },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) return fallbackSummary(rating, comment);
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n").trim() || fallbackSummary(rating, comment);
  } catch {
    return fallbackSummary(rating, comment);
  }
}

export async function submitEvaluation(input: {
  serviceNumber: string;
  rating: number;
  comment: string;
  image?: string;
}) {
  const rating = Math.round(input.rating);
  if (rating < 1 || rating > 5) return { ok: false as const, error: "estrellas" };

  const admin = createAdminClient();
  const existing = admin
    ? (await admin.from("complaints").select("id").eq("service_number", input.serviceNumber).maybeSingle()).data
    : memory.complaints.byNumber(input.serviceNumber);
  if (existing) {
    return { ok: false as const, error: "ya_enviada" };
  }

  const classified = await classifyComment(input.comment, input.serviceNumber);
  const vision = await visionCheck({
    comment: input.comment,
    image: input.image,
  });
  if (!input.image) {
    vision.vision_note = "No se adjuntó foto.";
    vision.vision_valid = null;
  } else if (!input.comment.trim()) {
    vision.vision_note = "No hay texto que contrastar.";
    vision.vision_valid = null;
  }

  const summary = await summarizeEvaluation(rating, input.comment, classified.label);

  let photoPath: string | null = null;
  if (input.image && admin) {
    const raw = input.image.split(",")[1];
    if (raw) {
      const buf = Buffer.from(raw, "base64");
      photoPath = `quejas/${input.serviceNumber.replace("#", "")}-${Date.now()}`;
      await admin.storage.from("evidencias").upload(photoPath, buf, {
        contentType: "image/jpeg",
        upsert: true,
      });
    }
  }

  const row = {
    service_number: input.serviceNumber,
    body: input.comment,
    rating,
    photo_path: photoPath,
    label: classified.label,
    confidence: classified.confidence,
    vision_valid: vision.vision_valid,
    vision_note: vision.vision_note,
    summary,
    nlp_json: classified.nlp_json,
  };

  if (admin) {
    await admin.from("complaints").insert(row);
    if (rating <= 2) {
      await admin.from("pqr_cases").insert({
        service_number: input.serviceNumber,
        priority: "alta",
        status: "open",
      });
    }
  } else {
    memory.complaints.add({
      id: crypto.randomUUID(),
      ...row,
      created_at: new Date().toISOString(),
    });
    if (rating <= 2) {
      memory.pqr.add({
        id: crypto.randomUUID(),
        service_number: input.serviceNumber,
        priority: "alta",
        status: "open",
        opened_at: new Date().toISOString(),
      });
    }
  }

  return { ok: true as const, already: false, label: classified.label, pqr: rating <= 2 };
}
