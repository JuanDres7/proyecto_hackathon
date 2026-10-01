import { findServiceCode } from "@/lib/ai/slots";
import { listOrdersByEmail, lookupProgress, serviceHasEvaluation } from "@/lib/orders";

export type ClientSituation = "cotizacion" | "progreso" | "finalizacion";

export type SituationInput = {
  serviceNumber: string;
  status: string;
  evaluated: boolean;
};

export type ClientServiceFact = {
  serviceNumber: string;
  status: string;
  message: string;
  evaluated: boolean;
  enRoute: boolean;
  customerName: string | null;
  location: string | null;
  services: string[];
  scheduledAt: string | null;
  visit: {
    contractedActivity?: string | null;
    checkInAt?: string | null;
    checkOutAt?: string | null;
    novedad?: string | null;
    siteName?: string | null;
  } | null;
};

export type ClientPicture = {
  email: string;
  customerName: string | null;
  situation: ClientSituation;
  focus: ClientServiceFact | null;
  services: ClientServiceFact[];
  unknownCode: string | null;
  opening: string;
};

function situationOf(service: SituationInput): ClientSituation {
  if (service.status === "finalizado" && !service.evaluated) return "finalizacion";
  if (service.status === "finalizado" || service.status === "sin_servicio_activo") return "cotizacion";
  return "progreso";
}

function pickDefault(services: SituationInput[]) {
  const needsEval = services.find((service) => service.status === "finalizado" && !service.evaluated);
  if (needsEval) return { situation: "finalizacion" as const, focusNumber: needsEval.serviceNumber };
  const active = services.find(
    (service) => service.status !== "finalizado" && service.status !== "sin_servicio_activo",
  );
  if (active) return { situation: "progreso" as const, focusNumber: active.serviceNumber };
  return { situation: "cotizacion" as const, focusNumber: null as string | null };
}

export function resolveClientFocus(services: SituationInput[], namedCode: string | null) {
  if (namedCode) {
    const owned = services.find((service) => service.serviceNumber === namedCode);
    if (!owned) {
      return { ...pickDefault(services), unknownCode: namedCode };
    }
    return {
      situation: situationOf(owned),
      focusNumber: owned.serviceNumber,
      unknownCode: null as string | null,
    };
  }
  return { ...pickDefault(services), unknownCode: null as string | null };
}

export function openingLine(input: {
  customerName: string | null;
  services: Array<{ serviceNumber: string; message: string; status: string; evaluated: boolean }>;
  situation: ClientSituation;
  focusNumber: string | null;
}) {
  const hello = input.customerName?.trim()
    ? `Hola, ${input.customerName.trim()}. Soy Puro.`
    : "Hola, soy Puro.";
  if (!input.services.length) {
    return `${hello} Con tu correo no hay servicios confirmados. Dime qué necesitas y tomo los datos de la solicitud.`;
  }
  const focus = input.services.find((service) => service.serviceNumber === input.focusNumber) ?? input.services[0];
  const summary = input.services
    .map((service) => {
      const evalNote =
        service.status === "finalizado"
          ? service.evaluated
            ? "Evaluación ya registrada."
            : "Sin evaluación."
          : "";
      return `${service.serviceNumber}: ${service.message}${evalNote ? ` ${evalNote}` : ""}`;
    })
    .join(" ");
  if (input.situation === "finalizacion" && focus) {
    return `${hello} Tu servicio ${focus.serviceNumber} ya terminó y todavía no tiene evaluación. ${summary}`;
  }
  if (input.situation === "progreso" && focus) {
    return `${hello} Tomo como referencia ${focus.serviceNumber}. ${focus.message}`;
  }
  return `${hello} Estos son tus servicios. ${summary} Si quieres otro, dime los datos.`;
}

function isPublicCode(value: string | null | undefined): value is string {
  return Boolean(value && /^#\d{3,8}$/.test(value));
}

export async function loadClientPicture(input: {
  email: string;
  fullName?: string | null;
  message?: string;
}): Promise<ClientPicture> {
  const orders = await listOrdersByEmail(input.email);
  const confirmed = orders.filter((order) => order.status === "confirmed" && isPublicCode(order.serviceNumber));
  const facts: ClientServiceFact[] = [];
  for (const order of confirmed) {
    const code = order.serviceNumber;
    if (!isPublicCode(code)) continue;
    const progress = await lookupProgress(code);
    const evaluated = await serviceHasEvaluation(code);
    const visit = "visit" in progress ? progress.visit ?? null : null;
    const catalog = "services" in progress ? progress.services ?? order.services : order.services;
    facts.push({
      serviceNumber: code,
      status: progress.status,
      message: progress.message,
      evaluated,
      enRoute: Boolean(order.enRouteAt),
      customerName: order.customerName,
      location: order.location,
      services: catalog,
      scheduledAt: order.scheduledAt,
      visit,
    });
  }

  const named = input.message?.trim() ? findServiceCode(input.message, null) : null;
  const resolved = resolveClientFocus(
    facts.map((fact) => ({
      serviceNumber: fact.serviceNumber,
      status: fact.status,
      evaluated: fact.evaluated,
    })),
    named,
  );
  const focus = facts.find((fact) => fact.serviceNumber === resolved.focusNumber) ?? null;
  const customerName =
    input.fullName?.trim() ||
    facts.find((fact) => fact.customerName)?.customerName ||
    orders.find((order) => order.customerName)?.customerName ||
    null;
  const greetingSituation = named ? pickDefault(facts).situation : resolved.situation;
  const greetingFocus = named ? pickDefault(facts).focusNumber : resolved.focusNumber;

  return {
    email: input.email,
    customerName,
    situation: resolved.situation,
    focus,
    services: facts,
    unknownCode: resolved.unknownCode,
    opening: openingLine({
      customerName,
      services: facts,
      situation: greetingSituation,
      focusNumber: greetingFocus,
    }),
  };
}
