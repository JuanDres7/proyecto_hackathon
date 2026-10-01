import { SERVICE_CATALOG, type ServiceCatalogId } from "@/lib/catalog";

export const SERVICE_ACTIVITIES: Record<ServiceCatalogId, { id: string; label: string }[]> = {
  aseo_general: [
    { id: "banos", label: "Baños" },
    { id: "oficinas", label: "Oficinas" },
    { id: "alfombras", label: "Alfombras" },
    { id: "residuos", label: "Residuos" },
    { id: "vidrios", label: "Vidrios" },
    { id: "cocinas", label: "Cocinas" },
    { id: "pisos", label: "Pisos" },
  ],
  jardineria: [
    { id: "poda", label: "Poda" },
    { id: "fertilizacion", label: "Fertilización" },
    { id: "hojas_maleza", label: "Hojas y maleza" },
    { id: "patios_aceras", label: "Patios y aceras" },
  ],
  limpieza_piscinas: [
    { id: "fondo_paredes", label: "Fondo y paredes" },
    { id: "cloro_ph", label: "Cloro y pH" },
    { id: "duchas_vestidores", label: "Duchas y vestidores" },
    { id: "filtros_flotantes", label: "Filtros y residuos flotantes" },
  ],
};

const CATALOG_IDS = new Set<string>(SERVICE_CATALOG.map((service) => service.id));

export function isServiceId(value: string): value is ServiceCatalogId {
  return CATALOG_IDS.has(value);
}

export function resolveServiceIds(
  ids: string[] | undefined,
  activityText: string,
): ServiceCatalogId[] {
  const fromIds = (ids ?? []).filter(isServiceId);
  if (fromIds.length > 0) return fromIds;
  const lower = activityText.toLowerCase();
  return SERVICE_CATALOG.filter((service) => lower.includes(service.label.toLowerCase())).map(
    (service) => service.id,
  );
}
