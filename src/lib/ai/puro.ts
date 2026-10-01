import { generateGeminiJson, type GeminiContent } from "@/lib/ai/gemini";
import {
  findServiceCode,
  heuristicSlots,
  sanitizeSlots,
  scrubReply,
  type QuoteSlots,
} from "@/lib/ai/slots";
import { requiredQuoteFields } from "@/lib/quote-fields";
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

const SYSTEM = `Eres Puro, el asistente de LimpiApp. Conversas en español, breve y natural, usando el historial.
Fases: cotización, progreso y finalización.
Reglas:
- Extrae solo datos que la persona dijo en el último mensaje. Si dijo fecha y hora explícitas, scheduledAt va en ISO de America/Bogota (UTC-5).
- Servicios permitidos: aseo_general, jardineria, limpieza_piscinas.
- No inventes un código de servicio, un precio, coordenadas, una fecha u hora que no haya dicho, ni el estado de una visita.
- El código lo emite el sistema después de un sí explícito al resumen. Tú no lo emites ni confirmas que ya quedó creado.
- En progreso y finalización, el estado es solo el texto de HECHOS. Si no hay HECHOS, pide el código.
- No digas que guardaste una evaluación: eso lo hace el formulario.
- Si faltan datos, pregunta por uno o dos, sin repetir el mismo párrafo de rechazo.
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
  const turns: HistoryTurn[] = [
    ...history.slice(-10).map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, 1500),
    })),
    { role: "user", content: latest.slice(0, 4000) },
  ];
  const contents: GeminiContent[] = [];
  for (const turn of turns) {
    const role = turn.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      const part = last.parts[0];
      if (part && "text" in part) part.text = `${part.text}\n${turn.content}`;
    } else {
      contents.push({ role, parts: [{ text: turn.content }] });
    }
  }
  if (contents[0]?.role === "model") {
    contents.unshift({ role: "user", parts: [{ text: "Hola." }] });
  }
  return contents;
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
}): Promise<PuroTurnResult> {
  const message = input.message.trim();
  const phase = input.phase;
  const code = phase === "cotizacion" ? null : findServiceCode(message, input.serviceNumber);
  let progress: PuroTurnResult["progress"] = null;
  let editLocked = Boolean(input.editsLocked);

  if (code && phase !== "cotizacion") {
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

  if (phase === "progreso" && !progress) {
    return {
      ...base,
      available: true,
      grounded: true,
      reply: "Indica el código del servicio, por ejemplo #3000.",
    };
  }

  const factual = progress ? factualReply(progress) : null;
  if (progress?.status === "sin_servicio_activo") {
    return { ...base, available: true, grounded: true, reply: progress.message };
  }

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

  const latest = [
    `FASE: ${phase}`,
    `EDICION_BLOQUEADA: ${editLocked ? "si" : "no"}`,
    `BORRADOR: ${JSON.stringify(draftContext(input.draft))}`,
    `HECHOS: ${facts ? JSON.stringify(facts) : "ninguno"}`,
    `ULTIMO_MENSAJE: ${message}`,
  ].join("\n");

  const model = await generateGeminiJson<ModelJson>({
    system: SYSTEM,
    contents: contentsFrom(input.history ?? [], latest),
  });

  const allowedCodes = [input.draft?.serviceNumber, progress?.serviceNumber].filter(
    (value): value is string => Boolean(value?.startsWith("#")),
  );

  if (!model.ok) {
    const extracted = phase === "cotizacion" && !editLocked ? heuristicSlots(message) : {};
    return {
      ...base,
      extracted,
      reply: factual,
      grounded: Boolean(factual),
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
