import { SERVICE_CATALOG } from "@/lib/catalog";

export type QuoteSlots = {
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

const SERVICE_HINTS: { id: string; pattern: RegExp }[] = [
  { id: "limpieza_piscinas", pattern: /piscina/i },
  { id: "jardineria", pattern: /jard[ií]n|jardiner/i },
  { id: "aseo_general", pattern: /aseo|limpieza general|\blimpieza\b(?!\s+de\s+piscinas)/i },
];

function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

function clean(value: unknown, max = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

export function overlaps(source: string, value: string) {
  const hay = norm(source);
  const needle = norm(value);
  if (!needle) return false;
  if (needle.length >= 4 && hay.includes(needle.slice(0, Math.min(needle.length, 40)))) return true;
  const words = needle.split(/\s+/).filter((word) => word.length > 3);
  if (!words.length) return false;
  const hits = words.filter((word) => hay.includes(word)).length;
  return hits / words.length >= 0.6;
}

export function userStatedDateTime(text: string) {
  const hasDate =
    /\d{4}-\d{2}-\d{2}/.test(text) ||
    /\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/.test(text) ||
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i.test(
      text,
    );
  const hasTime =
    /\b\d{1,2}[:.]\d{2}\b/.test(text) ||
    /\b\d{1,2}\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)\b/i.test(text) ||
    /\ba las\s+\d{1,2}\b/i.test(text);
  return hasDate && hasTime;
}

export function servicesMentioned(text: string) {
  return SERVICE_HINTS.filter((hint) => hint.pattern.test(text)).map((hint) => hint.id);
}

export function findServiceCode(text: string, fallback?: string | null) {
  const hashed = text.match(/#\s*(\d{3,8})\b/);
  if (hashed) return `#${hashed[1]}`;
  if (/^\d{3,8}$/.test(text.trim())) return `#${text.trim()}`;
  const fb = fallback?.trim() ?? "";
  if (/^#?\d{3,8}$/.test(fb)) return `#${fb.replace(/^#/, "")}`;
  return null;
}

export function heuristicSlots(text: string): QuoteSlots {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const labeledPhone = text.match(
    /(?:tel[eé]fono|celular|m[oó]vil|whatsapp)\s*[:#]?\s*(\+?\d[\d\s-]{6,16}\d)/i,
  )?.[1];
  const phone = (labeledPhone ?? text.match(/(?:\+?\d[\d\s-]{6,16}\d)/)?.[0])?.replace(/\s|-/g, "");
  const document = text.match(
    /(?:identificaci[oó]n|c[eé]dula|documento|nit)\s*[:#]?\s*(\d{5,15})/i,
  )?.[1];
  const name = text.match(
    /(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ ]{2,60})/i,
  )?.[1];
  const location = text.match(
    /(?:ubicaci[oó]n|direcci[oó]n|queda en|vivo en)\s*[:#]?\s*([^\n.]{5,120})/i,
  )?.[1];
  const access = text.match(
    /(?:acceso|porter[ií]a|observaci[oó]n(?:es)? de acceso)\s*[:#]?\s*([^\n.]{3,160})/i,
  )?.[1];
  const services = servicesMentioned(text);
  const scheduledAt = explicitDateTime(text);
  const opening =
    text.trim().length >= 15 && !/^(si|sí|no|hola|ok|vale)[.!]?$/i.test(text.trim())
      ? text.trim().slice(0, 500)
      : undefined;
  return {
    customerName: name?.trim(),
    customerDocument: document,
    email,
    phone,
    openingMessage: opening,
    services: services.length ? services : undefined,
    scheduledAt,
    location: location?.trim(),
    accessNotes: access?.trim(),
  };
}

function explicitDateTime(text: string) {
  if (!userStatedDateTime(text)) return undefined;
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const dmy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  const clock = text.match(/\b(\d{1,2})[:.](\d{2})\b/);
  const spoken = text.match(/\ba las\s+(\d{1,2})(?::(\d{2}))?\b/i);
  const time = clock ?? spoken;
  if (!time || (!iso && !dmy)) return undefined;
  const year = iso ? Number(iso[1]) : Number(dmy?.[3]);
  const month = iso ? Number(iso[2]) : Number(dmy?.[2]);
  const day = iso ? Number(iso[3]) : Number(dmy?.[1]);
  const hour = Number(time[1]);
  const minute = Number(time[2] ?? "0");
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return undefined;
  // The hour written by the client is America/Bogota (UTC-5, sin horario de verano).
  const parsed = new Date(Date.UTC(year, month - 1, day, hour + 5, minute));
  if (Number.isNaN(parsed.getTime())) return undefined;
  const bogota = new Date(parsed.getTime() - 5 * 60 * 60 * 1000);
  if (
    bogota.getUTCFullYear() !== year ||
    bogota.getUTCMonth() !== month - 1 ||
    bogota.getUTCDate() !== day ||
    bogota.getUTCHours() !== hour
  ) {
    return undefined;
  }
  return parsed.toISOString();
}

export function sanitizeSlots(raw: unknown, sourceText: string): QuoteSlots {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const slots: QuoteSlots = {};
  const name = clean(row.customerName, 80);
  if (name && overlaps(sourceText, name)) slots.customerName = name;
  const document = clean(row.customerDocument, 20)?.replace(/\D/g, "");
  if (document && sourceText.includes(document)) slots.customerDocument = document;
  const email = clean(row.email, 120);
  if (email && sourceText.toLowerCase().includes(email.toLowerCase())) slots.email = email;
  const phone = clean(row.phone, 20)?.replace(/[^\d+]/g, "");
  if (phone && sourceText.replace(/\D/g, "").includes(phone.replace(/\D/g, ""))) slots.phone = phone;
  const opening = clean(row.openingMessage, 500);
  if (opening && overlaps(sourceText, opening)) slots.openingMessage = opening;
  const services = Array.isArray(row.services)
    ? row.services.filter((id): id is string => SERVICE_CATALOG.some((item) => item.id === id))
    : [];
  const allowed = new Set(servicesMentioned(sourceText));
  const picked = services.filter((id) => allowed.has(id));
  if (picked.length) slots.services = picked;
  const when = clean(row.scheduledAt, 40);
  if (when && userStatedDateTime(sourceText) && !Number.isNaN(new Date(when).getTime())) {
    slots.scheduledAt = new Date(when).toISOString();
  }
  const location = clean(row.location, 160);
  const looksLikeGps = /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(location ?? "");
  if (location && !looksLikeGps && overlaps(sourceText, location)) slots.location = location;
  const access = clean(row.accessNotes, 240);
  if (access && overlaps(sourceText, access)) slots.accessNotes = access;
  return slots;
}

const UNSAFE_LINE =
  /(\$\s?\d|\b(?:precio|tarifa|cop|usd)\b|\bgps\b|lat(?:itud)?\s*[:=]\s*-?\d|lon(?:gitud)?\s*[:=]\s*-?\d)/i;

export function scrubReply(reply: string, allowedCodes: string[]) {
  const kept = reply
    .split("\n")
    .filter((line) => !UNSAFE_LINE.test(line))
    .join("\n")
    .replace(/#\d+/g, (code) => (allowedCodes.includes(code) ? code : ""))
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return kept;
}
