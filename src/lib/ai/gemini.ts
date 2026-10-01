import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GeminiContent } from "./gemini-types";

export type { GeminiContent, GeminiPart } from "./gemini-types";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

const KEY_NAMES = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_KEY"];

function unquote(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function keyFromEnvText(text: string) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    if (!KEY_NAMES.includes(name)) continue;
    const value = unquote(trimmed.slice(eq + 1));
    if (value) return value;
  }
  return "";
}

export function geminiApiKey() {
  for (const name of KEY_NAMES) {
    const value = unquote(process.env[name] ?? "");
    if (value) return value;
  }
  for (const file of [".env", ".env.local"]) {
    try {
      const value = keyFromEnvText(readFileSync(join(process.cwd(), file), "utf8"));
      if (value) return value;
    } catch {
      // El archivo puede no estar en este entorno.
    }
  }
  return "";
}

function stripFences(text: string) {
  return text.replace(/```json|```/g, "").trim();
}

function redact(text: string) {
  return text.replace(/AIza[\w-]{8,}/g, "AIza…").slice(0, 280);
}

function errorMessage(status: number, body: string) {
  let message = body;
  try {
    const json = JSON.parse(body) as { error?: { message?: string; status?: string } };
    message = json.error?.message || json.error?.status || body;
  } catch {
    // El cuerpo no vino en JSON.
  }
  return `Gemini respondió ${status}: ${redact(message)}`;
}

type ModelPart = { text?: string; thought?: boolean };

export async function generateGeminiJson<T>(options: {
  system: string;
  contents: GeminiContent[];
}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = geminiApiKey();
  if (!key) {
    return { ok: false, error: "No encontré GEMINI_API_KEY en el archivo .env." };
  }

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
          thinkingConfig: { thinkingLevel: "low" },
        },
        contents: options.contents,
      }),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, error: errorMessage(res.status, body) };

    const json = JSON.parse(body) as {
      candidates?: { content?: { parts?: ModelPart[] } }[];
    };
    const parts = (json.candidates?.[0]?.content?.parts ?? []).filter((part) => part.text && !part.thought);
    for (const part of parts) {
      try {
        return { ok: true, data: JSON.parse(stripFences(part.text ?? "")) as T };
      } catch {
        // Puede ser texto normal, no JSON.
      }
    }
    const text = parts
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    if (!text) return { ok: false, error: "Gemini respondió vacío." };
    return { ok: true, data: { reply: text } as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "error de red";
    return { ok: false, error: `No pude llamar a Gemini: ${redact(message)}` };
  }
}
