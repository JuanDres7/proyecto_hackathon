import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GeminiContent } from "./gemini-types";

export type { GeminiContent, GeminiPart } from "./gemini-types";

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

function modelsToTry() {
  const preferred = process.env.GEMINI_MODEL?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return ["gemini-3.8-flash", ...preferred, "gemini-3.5-flash-lite", "gemini-3.5-flash"].filter(
    (model, i, all) => all.indexOf(model) === i,
  );
}

function endpoint(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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

async function generateOnce(opts: {
  model: string;
  key: string;
  system?: string;
  contents: GeminiContent[];
  json: boolean;
}) {
  const body: Record<string, unknown> = {
    contents: opts.contents,
    generationConfig: opts.json
      ? { temperature: 0.4, responseMimeType: "application/json" }
      : { temperature: 0.3 },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }
  const res = await fetch(endpoint(opts.model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": opts.key,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  return { status: res.status, raw };
}

function candidateText(raw: string) {
  try {
    const json = JSON.parse(raw) as {
      candidates?: { content?: { parts?: ModelPart[] } }[];
    };
    return (json.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => part.text && !part.thought)
      .map((part) => part.text ?? "")
      .join("");
  } catch {
    return "";
  }
}

export async function generateGeminiText(options: {
  system?: string;
  contents: GeminiContent[];
  json?: boolean;
}): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const key = geminiApiKey();
  if (!key) return { ok: false, error: "No encontré GEMINI_API_KEY en el archivo .env." };

  let last = "sin respuesta";
  for (const model of modelsToTry()) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const { status, raw } = await generateOnce({
          model,
          key,
          system: options.system,
          contents: options.contents,
          json: options.json === true,
        });
        if (status === 503) {
          last = `${model}: saturado`;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        if (status === 401 || status === 403) {
          return { ok: false, error: errorMessage(status, raw) };
        }
        if (status === 400 && /API key|API_KEY|PERMISSION_DENIED/i.test(raw)) {
          return { ok: false, error: errorMessage(status, raw) };
        }
        if (!status.toString().startsWith("2")) {
          last = errorMessage(status, raw);
          break;
        }
        const text = candidateText(raw);
        if (!text.trim()) {
          last = `${model}: vacío`;
          break;
        }
        return { ok: true, text, model };
      } catch (err) {
        last = err instanceof Error ? `No pude llamar a Gemini: ${redact(err.message)}` : "red";
      }
    }
  }
  return { ok: false, error: last };
}

export async function generateGeminiJson<T>(options: {
  system: string;
  contents: GeminiContent[];
}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const result = await generateGeminiText({ ...options, json: true });
  if (!result.ok) return result;
  try {
    return { ok: true, data: JSON.parse(stripFences(result.text)) as T };
  } catch {
    return { ok: true, data: { reply: stripFences(result.text) } as T };
  }
}
