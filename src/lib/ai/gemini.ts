export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

function stripFences(text: string) {
  return text.replace(/```json|```/g, "").trim();
}

export async function generateGeminiJson<T>(options: {
  system: string;
  contents: GeminiContent[];
}): Promise<{ ok: true; data: T } | { ok: false }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.system }] },
        generationConfig: {
          responseMimeType: "application/json",
        },
        contents: options.contents,
      }),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text.trim()) return { ok: false };
    return { ok: true, data: JSON.parse(stripFences(text)) as T };
  } catch {
    return { ok: false };
  }
}
