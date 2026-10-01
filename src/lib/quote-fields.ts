import type { QuoteDraft } from "./types";

export function requiredQuoteFields(d: Partial<QuoteDraft>) {
  const missing: string[] = [];
  if (!d.customerName?.trim()) missing.push("nombre");
  if (!d.customerDocument?.trim()) missing.push("identificación");
  if (!d.email?.trim()) missing.push("correo");
  if (!d.phone?.trim()) missing.push("teléfono");
  if (!d.openingMessage?.trim()) missing.push("mensaje inicial");
  if (!d.services?.length) missing.push("servicios");
  if (!d.scheduledAt?.trim()) missing.push("fecha y hora");
  if (!d.location?.trim()) missing.push("ubicación");
  return missing;
}
