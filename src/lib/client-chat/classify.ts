import type { ComplaintLabel } from "./types";

export async function classifyComment(text: string, serviceNumber: string): Promise<{
  label: ComplaintLabel;
  confidence: number | null;
}> {
  if (!text.trim()) return { label: "general", confidence: 100 };
  const base = process.env.NLP_SERVICE_URL ?? "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${base}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, serviceNumber }),
    });
    if (!res.ok) return { label: "pending", confidence: null };
    const json = (await res.json()) as { label?: string; confidence?: number | null };
    const allowed: ComplaintLabel[] = [
      "inasistencia",
      "calidad",
      "conducta",
      "facturacion",
      "seguridad",
      "general",
      "pending",
    ];
    const label = allowed.includes(json.label as ComplaintLabel) ? (json.label as ComplaintLabel) : "pending";
    const confidence =
      typeof json.confidence === "number" ? Math.round(Math.min(1, Math.max(0, json.confidence)) * 100) : null;
    return { label, confidence };
  } catch {
    return { label: "pending", confidence: null };
  }
}
