import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/client-chat/orders";
import { signedPhotoUrl } from "@/lib/client-chat/photos";

type ComplaintRow = {
  service_number: string;
  rating: number;
  body: string | null;
  photo_path: string | null;
  label: string | null;
  confidence: number | null;
  vision_valid: boolean | null;
  vision_note: string | null;
  summary: string | null;
};

export async function GET() {
  try {
    const db = requireAdmin();
    const { data: cases, error } = await db
      .from("pqr_cases")
      .select("service_number, priority, opened_at")
      .eq("priority", "alta")
      .order("opened_at", { ascending: false });
    if (error) throw new Error(error.message);

    const items = [];
    for (const row of cases ?? []) {
      const { data: complaint } = await db
        .from("complaints")
        .select("service_number, rating, body, photo_path, label, confidence, vision_valid, vision_note, summary")
        .eq("service_number", row.service_number)
        .maybeSingle();
      const typed = complaint as ComplaintRow | null;
      if (!typed || typed.rating >= 3) continue;
      items.push({
        serviceNumber: row.service_number,
        priority: "alta",
        rating: typed.rating,
        comment: typed.body ?? "",
        photoUrl: await signedPhotoUrl(db, typed.photo_path),
        label: typed.label ?? "pending",
        confidencePercent: typed.confidence,
        vision: visionCode(typed.vision_valid, typed.vision_note),
        summary: typed.summary ?? "",
        openedAt: row.opened_at,
      });
    }
    return NextResponse.json({ cases: items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer la cola.";
    return NextResponse.json({ cases: [], reply: message }, { status: 500 });
  }
}

function visionCode(valid: boolean | null, note: string | null) {
  if (note?.includes("No hay texto")) return "sin_texto";
  if (valid === true) return "corresponde";
  if (valid === false) return "no_corresponde";
  return "sin_foto";
}
