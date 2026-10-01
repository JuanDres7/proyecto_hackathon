import {
  SERVICE_CODES,
  SERVICE_LABELS,
  type QuoteSlots,
  type ServiceCode,
  emptySlots,
} from "./types";

export function mergeSlots(base: QuoteSlots, patch?: Partial<QuoteSlots> | null): QuoteSlots {
  if (!patch) return base;
  const services = Array.isArray(patch.services)
    ? patch.services.filter((item): item is ServiceCode =>
        SERVICE_CODES.includes(item as ServiceCode),
      )
    : base.services;
  return {
    customerName: patch.customerName?.trim() || base.customerName,
    customerDocument: patch.customerDocument?.trim() || base.customerDocument,
    email: patch.email?.trim() || base.email,
    phone: patch.phone?.trim() || base.phone,
    openingMessage: patch.openingMessage?.trim() || base.openingMessage,
    services: services.length > 0 ? services : base.services,
    scheduledAt: patch.scheduledAt?.trim() || base.scheduledAt,
    location: patch.location?.trim() || base.location,
    accessNotes: patch.accessNotes?.trim() || base.accessNotes,
  };
}

export function missingSlotFields(slots: QuoteSlots): string[] {
  const missing: string[] = [];
  if (!slots.customerName) missing.push("nombre");
  if (!slots.customerDocument) missing.push("identificación");
  if (!slots.email || !slots.email.includes("@")) missing.push("email");
  if (!slots.phone) missing.push("teléfono");
  if (!slots.openingMessage) missing.push("mensaje");
  if (slots.services.length < 1) missing.push("servicio");
  if (!slots.scheduledAt) missing.push("fecha y hora");
  if (!slots.location) missing.push("ubicación");
  return missing;
}

export function confirmationReply(slots: QuoteSlots): string {
  const services = slots.services.map((code) => SERVICE_LABELS[code]).join(", ");
  const when = slots.scheduledAt.replace("T", " ");
  const access = slots.accessNotes ? ` Observaciones de acceso: ${slots.accessNotes}.` : "";
  return `¿Confirmas que deseas agendar ${services} el día ${when} en la ubicación ${slots.location}? Sí/No.${access}`;
}

export function slotsFromUnknown(value: unknown, base: QuoteSlots = emptySlots()): QuoteSlots {
  if (!value || typeof value !== "object") return base;
  const raw = value as Record<string, unknown>;
  const services = Array.isArray(raw.services)
    ? raw.services.filter((item): item is ServiceCode =>
        SERVICE_CODES.includes(item as ServiceCode),
      )
    : undefined;
  return mergeSlots(base, {
    customerName: typeof raw.customerName === "string" ? raw.customerName : undefined,
    customerDocument: typeof raw.customerDocument === "string" ? raw.customerDocument : undefined,
    email: typeof raw.email === "string" ? raw.email : undefined,
    phone: typeof raw.phone === "string" ? raw.phone : undefined,
    openingMessage: typeof raw.openingMessage === "string" ? raw.openingMessage : undefined,
    services,
    scheduledAt: typeof raw.scheduledAt === "string" ? raw.scheduledAt : undefined,
    location: typeof raw.location === "string" ? raw.location : undefined,
    accessNotes: typeof raw.accessNotes === "string" ? raw.accessNotes : undefined,
  });
}
