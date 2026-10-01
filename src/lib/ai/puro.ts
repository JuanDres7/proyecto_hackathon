import { generateGeminiJson, type GeminiContent } from "@/lib/ai/gemini";
import {
  findServiceCode,
  heuristicSlots,
  sanitizeSlots,
  scrubReply,
  type QuoteSlots,
} from "@/lib/ai/slots";
import { requiredQuoteFields } from "@/lib/quote-fields";
import { listServicesForEmail, statusLabel } from "@/lib/client-services";
import { getOrderByNumber, lookupProgress } from "@/lib/orders";
import type { QuoteDraft } from "@/lib/types";

export type PuroPhase = "cotizacion" | "progreso" | "finalizacion";

type HistoryTurn = { role: "user" | "assistant"; content: string };

type ModelJson = QuoteSlots & { reply?: string };

export type PuroTurnResult = {
  available: boolean;
  reply: string | null;
  grounded: boolean;
  extracted: QuoteSlots;
  editLocked: boolean;
  progress: {
    status: string;
    message: string;
    serviceNumber: string;
    visit: {
      contractedActivity?: string | null;
      checkInAt?: string | null;
      checkOutAt?: string | null;
      novedad?: string | null;
      siteName?: string | null;
    } | null;
  } | null;
};

const SYSTEM = `Eres Puro, el nombre del asistente de LimpiApp. Esta respuesta la genera Gemini.
Conversas en español, breve y natural.
Reglas:
- El estado de un servicio sale solo de SERVICIOS_DEL_CLIENTE y de HECHOS. No inventes códigos, precios, coordenadas ni estados.
- Si la persona pregunta por sus servicios, resume los de SERVICIOS_DEL_CLIENTE.
- Extrae solo datos que dijo en el último mensaje. Si dijo fecha y hora explícitas, scheduledAt va en ISO de America/Bogota (UTC-5).
- Servicios permitidos: aseo_general, jardineria, limpieza_piscinas.
- El código lo emite el sistema después de un sí explícito al resumen. Tú no lo emites.
- No digas que guardaste una evaluación: eso lo hace el formulario.
Responde solo JSON con reply (string) y, si aplica, customerName, customerDocument, email, phone, openingMessage, services, scheduledAt, location, accessNotes. Usa null cuando no esté en el último mensaje.`;

function draftContext(draft?: Partial<QuoteDraft>) {
  return {
    nombre: draft?.customerName ?? null,
    identificacion: draft?.customerDocument ?? null,
    correo: draft?.email ?? null,
    telefono: draft?.phone ?? null,
    mensaje: draft?.openingMessage ?? null,
    servicios: draft?.services ?? [],
    fechaHora: draft?.scheduledAt ?? null,
    ubicacion: draft?.location ?? null,
    acceso: draft?.accessNotes ?? null,
    codigoExistente: draft?.serviceNumber ?? null,
    faltan: requiredQuoteFields({ ...draft, services: draft?.services ?? [] }),
  };
}

function contentsFrom(history: HistoryTurn[], latest: string): GeminiContent[] {
  const previous = history
    .slice(-8)
    .filter((turn) => typeof turn?.content === "string" && turn.content.trim())
    .map((turn) => `${turn.role === "assistant" ? "Puro" : "Cliente"}: ${turn.content.slice(0, 800)}`)
    .join("\n");
  const text = [previous ? `Conversación previa:\n${previous}` : "", latest.slice(0, 4000)]
    .filter(Boolean)
    .join("\n\n");
  return [{ role: "user", parts: [{ text }] }];
}

async function orderIsEnRoute(serviceNumber: string) {
  const order = await getOrderByNumber(serviceNumber);
  if (!order) return false;
  const row = order as { en_route_at?: string | null; enRouteAt?: string | null };
  return Boolean(row.en_route_at || row.enRouteAt);
}

export async function puroTurn(input: {
  phase: PuroPhase;
  message: string;
  history?: HistoryTurn[];
  draft?: Partial<QuoteDraft>;
  serviceNumber?: string | null;
  editsLocked?: boolean;
  email?: string | null;
}): Promise<PuroTurnResult> {
  const message = input.message.trim();
  const phase = input.phase;
  const code = findServiceCode(message, input.serviceNumber);
  let progress: PuroTurnResult["progress"] = null;
  let editLocked = Boolean(input.editsLocked);

  if (code) {
    const looked = await lookupProgress(code);
    const visit = "visit" in looked ? looked.visit ?? null : null;
    progress = {
      status: looked.status,
      message: looked.message,
      serviceNumber: code,
      visit,
    };
    if (await orderIsEnRoute(code)) editLocked = true;
  }

  const base: PuroTurnResult = {
    available: false,
    reply: null,
    grounded: false,
    extracted: {},
    editLocked,
    progress,
  };

  if (!message) return base;

  const services = input.email ? await listServicesForEmail(input.email) : [];
  const factual = progress ? factualReply(progress) : null;
  const facts = progress
    ? {
        codigo: progress.serviceNumber,
        estado: progress.message,
        actividad: progress.visit?.contractedActivity ?? null,
        sitio: progress.visit?.siteName ?? null,
        checkIn: progress.visit?.checkInAt ?? null,
        checkOut: progress.visit?.checkOutAt ?? null,
        novedad: progress.visit?.novedad ?? null,
      }
    : null;
  const serviceFacts = services.map((service) => ({
    codigo: service.serviceNumber,
    tipo: service.serviceLabel,
    lugar: service.location,
    estado: statusLabel(service.status),
    cuando: service.scheduledAt,
    supervisor: service.supervisorName,
  }));

  const latest = [
    `FASE: ${phase}`,
    `EDICION_BLOQUEADA: ${editLocked ? "si" : "no"}`,
    `BORRADOR: ${JSON.stringify(draftContext(input.draft))}`,
    `SERVICIOS_DEL_CLIENTE: ${serviceFacts.length ? JSON.stringify(serviceFacts) : "ninguno"}`,
    `HECHOS: ${facts ? JSON.stringify(facts) : "ninguno"}`,
    `ULTIMO_MENSAJE: ${message}`,
  ].join("\n");

  let model = await generateGeminiJson<ModelJson>({
    system: SYSTEM,
    contents: contentsFrom(input.history ?? [], latest),
  });
  if (!model.ok && (input.history?.length ?? 0) > 0) {
    model = await generateGeminiJson<ModelJson>({
      system: SYSTEM,
      contents: contentsFrom([], latest),
    });
  }

  const allowedCodes = [
    ...services.map((service) => service.serviceNumber),
    input.draft?.serviceNumber,
    progress?.serviceNumber,
  ].filter((value): value is string => Boolean(value?.startsWith("#")));

  if (!model.ok) {
    return {
      ...base,
      extracted: phase === "cotizacion" && !editLocked ? heuristicSlots(message) : {},
      reply: model.error,
    };
  }

  const reply = scrubReply(model.data.reply ?? "", allowedCodes);
  const extracted =
    phase === "cotizacion" && !editLocked ? sanitizeSlots(model.data, message) : {};
  return {
    ...base,
    available: true,
    grounded: !reply && Boolean(factual),
    reply: reply || factual,
    extracted,
  };
}

function factualReply(progress: NonNullable<PuroTurnResult["progress"]>) {
  if (progress.status !== "finalizado") return progress.message;
  const activity = progress.visit?.contractedActivity || "las registradas en la visita";
  return `${progress.message} Cierre del servicio ${progress.serviceNumber}. Actividades: ${activity}. Fotos de antes y después: las que existan en el depósito.`;
}
