export type GeminiJson = {
  reply?: string;
  slots?: Record<string, unknown>;
  corresponds?: boolean;
  reason?: string;
};

export async function askGemini(
  prompt: string,
  imageDataUrl?: string | null,
): Promise<{ ok: true; data: GeminiJson } | { ok: false }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false };

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (imageDataUrl?.startsWith("data:")) {
    const [meta, data] = imageDataUrl.split(",");
    const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
    parts.push({ inline_data: { mime_type: mime, data } });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationConfig: { responseMimeType: "application/json" },
          contents: [{ role: "user", parts }],
        }),
      },
    );
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text) return { ok: false };
    return { ok: true, data: JSON.parse(text) as GeminiJson };
  } catch {
    return { ok: false };
  }
}
