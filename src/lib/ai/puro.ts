import { loadClientPicture, type ClientPicture, type ClientSituation } from "@/lib/ai/client-context";
import { generateGeminiJson, type GeminiContent } from "@/lib/ai/gemini";
import { heuristicSlots, sanitizeSlots, scrubReply, type QuoteSlots } from "@/lib/ai/slots";
import { requiredQuoteFields } from "@/lib/quote-fields";
import type { QuoteDraft } from "@/lib/types";

export type PuroPhase = ClientSituation;

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
La persona no elige una fase. Respondes solo con los HECHOS de los servicios de su correo.
Reglas:
- Extrae datos de la solicitud solo si SITUACION es cotizacion, EDICION_BLOQUEADA es no y CODIGO_AJENO es null. Solo datos que dijo en el último mensaje. Si dijo fecha y hora explícitas, scheduledAt va en ISO de America/Bogota (UTC-5).
- Servicios permitidos: aseo_general, jardineria, limpieza_piscinas.
- No inventes un código de servicio, un precio, coordenadas, una fecha u hora que no haya dicho, ni el estado de una visita.
- El código lo emite el sistema después de un sí explícito al resumen. Tú no lo emites ni confirmas que ya quedó creado.
- El estado de cada servicio es solo el texto de HECHOS. Si CODIGO_AJENO tiene un valor, di que ese código no está entre los servicios de esta cuenta y no describas ese servicio.
- No digas que guardaste una evaluación: eso lo hace el formulario.
- Si faltan datos de una solicitud nueva, pregunta por uno o dos, sin repetir el mismo párrafo de rechazo.
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

function progressFrom(picture: ClientPicture): PuroTurnResult["progress"] {
  if (!picture.focus || picture.situation === "cotizacion") return null;
  return {
    status: picture.focus.status,
    message: picture.focus.message,
    serviceNumber: picture.focus.serviceNumber,
    visit: picture.focus.visit,
  };
}

export async function puroTurn(input: {
  email: string;
  fullName?: string | null;
  message: string;
  history?: HistoryTurn[];
  draft?: Partial<QuoteDraft>;
}): Promise<PuroTurnResult & { situation: ClientSituation; unknownCode: string | null }> {
  const message = input.message.trim();
  const picture = await loadClientPicture({
    email: input.email,
    fullName: input.fullName,
    message,
  });
  const situation = picture.situation;
  const progress = progressFrom(picture);
  const editLocked = Boolean(picture.focus?.enRoute) && situation !== "cotizacion";
  const collectQuote = situation === "cotizacion" && !editLocked && !picture.unknownCode;

  const base = {
    available: false,
    reply: null as string | null,
    grounded: false,
    extracted: {} as QuoteSlots,
    editLocked,
    progress,
    situation,
    unknownCode: picture.unknownCode,
  };

  if (!message) return base;

  const factual = picture.unknownCode
    ? `El código ${picture.unknownCode} no está entre tus servicios.`
    : progress
      ? factualReply(progress)
      : null;

  const facts = {
    situacion: situation,
    codigoAjeno: picture.unknownCode,
    enfoque: picture.focus
      ? {
          codigo: picture.focus.serviceNumber,
          estado: picture.focus.message,
          actividad: picture.focus.visit?.contractedActivity ?? null,
          sitio: picture.focus.visit?.siteName ?? picture.focus.location,
          checkIn: picture.focus.visit?.checkInAt ?? null,
          checkOut: picture.focus.visit?.checkOutAt ?? null,
          novedad: picture.focus.visit?.novedad ?? null,
          evaluado: picture.focus.evaluated,
        }
      : null,
    servicios: picture.services.map((service) => ({
      codigo: service.serviceNumber,
      estado: service.message,
      evaluado: service.evaluated,
    })),
  };

  const latest = [
    `SITUACION: ${situation}`,
    `EDICION_BLOQUEADA: ${editLocked ? "si" : "no"}`,
    `CODIGO_AJENO: ${picture.unknownCode ?? "null"}`,
    `BORRADOR: ${JSON.stringify(draftContext({ ...input.draft, email: input.email, customerName: input.draft?.customerName || input.fullName || undefined }))}`,
    `HECHOS: ${JSON.stringify(facts)}`,
    `ULTIMO_MENSAJE: ${message}`,
  ].join("\n");

  const model = await generateGeminiJson<ModelJson>({
    system: SYSTEM,
    contents: contentsFrom(input.history ?? [], latest),
  });

  const allowedCodes = picture.services.map((service) => service.serviceNumber);

  if (!model.ok) {
    return {
      ...base,
      available: Boolean(factual),
      grounded: Boolean(factual),
      extracted: collectQuote ? heuristicSlots(message) : {},
      reply: factual,
    };
  }

  const reply = scrubReply(model.data.reply ?? "", allowedCodes);
  return {
    ...base,
    available: true,
    grounded: !reply && Boolean(factual),
    reply: reply || factual,
    extracted: collectQuote ? sanitizeSlots(model.data, message) : {},
  };
}

function factualReply(progress: NonNullable<PuroTurnResult["progress"]>) {
  if (progress.status !== "finalizado") return progress.message;
  const activity = progress.visit?.contractedActivity || "las registradas en la visita";
  return `${progress.message} Cierre del servicio ${progress.serviceNumber}. Actividades: ${activity}. Fotos de antes y después: las que existan en el depósito.`;
}
