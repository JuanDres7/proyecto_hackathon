export const SERVICE_CATALOG = [
  { id: "aseo_general", label: "Aseo general" },
  { id: "jardineria", label: "Jardinería" },
  { id: "limpieza_piscinas", label: "Limpieza de piscinas" },
] as const;

export type ServiceCatalogId = (typeof SERVICE_CATALOG)[number]["id"];

export const CANCELLATION_REASONS = [
  { id: "data_error", label: "Error de datos" },
  { id: "plans_changed", label: "Cambio de planes" },
  { id: "too_expensive", label: "Costoso" },
  { id: "other", label: "Otro" },
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number]["id"];

export const COMPLAINT_LABELS = [
  "inasistencia",
  "calidad",
  "conducta",
  "facturacion",
  "seguridad",
  "general",
  "pending",
] as const;

export function serviceLabels(ids: string[]): string {
  return ids
    .map((id) => SERVICE_CATALOG.find((s) => s.id === id)?.label ?? id)
    .join(", ");
}
