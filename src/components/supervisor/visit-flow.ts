import { SERVICE_CATALOG, serviceLabels, type ServiceCatalogId } from "@/lib/catalog";
import type { LocalVisit } from "@/lib/types";
import { SERVICE_ACTIVITIES, resolveServiceIds } from "./activities";

export type PhotoSubject = "fachada" | "extintor" | "implemento";

export type ActivityCheck = {
  id: string;
  label: string;
  group: string;
  done: boolean;
  needsJustification: boolean;
  justification: string;
};

export type VisitFlow = {
  serviceIds: ServiceCatalogId[];
  costCenter: string;
  address: string;
  beforeSubject: PhotoSubject;
  activities: ActivityCheck[];
  clientNotes: string;
  phase: 1 | 2 | 3 | 4;
};

const SUBJECTS: PhotoSubject[] = ["fachada", "extintor", "implemento"];
const MARKER = "limpiapp-visit-flow";

export const SUBJECT_COPY: Record<PhotoSubject, string> = {
  fachada: "la fachada",
  extintor: "el extintor",
  implemento: "un implemento",
};

export function photoSubjectFor(code: string): PhotoSubject {
  let sum = 0;
  for (let index = 0; index < code.length; index += 1) {
    sum += code.charCodeAt(index);
  }
  return SUBJECTS[sum % SUBJECTS.length] ?? "fachada";
}

export function activitiesFor(serviceIds: ServiceCatalogId[]): ActivityCheck[] {
  return serviceIds.flatMap((serviceId) => {
    const group = SERVICE_CATALOG.find((service) => service.id === serviceId)?.label ?? serviceId;
    return SERVICE_ACTIVITIES[serviceId].map((item) => ({
      id: `${serviceId}:${item.id}`,
      label: item.label,
      group,
      done: false,
      needsJustification: false,
      justification: "",
    }));
  });
}

export function createFlow(input: {
  serviceIds: ServiceCatalogId[];
  costCenter: string;
  address: string;
  code: string;
}): VisitFlow {
  return {
    serviceIds: input.serviceIds,
    costCenter: input.costCenter,
    address: input.address,
    beforeSubject: photoSubjectFor(input.code),
    activities: activitiesFor(input.serviceIds),
    clientNotes: "",
    phase: 1,
  };
}

export function encodeVisitFlow(flow: VisitFlow): string {
  return JSON.stringify({ marker: MARKER, ...flow });
}

function isPhase(value: unknown): value is VisitFlow["phase"] {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isActivity(value: unknown): value is ActivityCheck {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ActivityCheck>;
  return (
    typeof row.id === "string" &&
    typeof row.label === "string" &&
    typeof row.group === "string" &&
    typeof row.done === "boolean" &&
    typeof row.needsJustification === "boolean" &&
    typeof row.justification === "string"
  );
}

export function decodeVisitFlow(notes: string | undefined, visit: LocalVisit): VisitFlow {
  if (notes) {
    try {
      const parsed = JSON.parse(notes) as Partial<VisitFlow> & { marker?: string };
      if (
        parsed.marker === MARKER &&
        Array.isArray(parsed.serviceIds) &&
        parsed.serviceIds.every((id) => typeof id === "string") &&
        Array.isArray(parsed.activities) &&
        parsed.activities.every(isActivity) &&
        isPhase(parsed.phase) &&
        (parsed.beforeSubject === "fachada" ||
          parsed.beforeSubject === "extintor" ||
          parsed.beforeSubject === "implemento") &&
        typeof parsed.costCenter === "string" &&
        typeof parsed.address === "string" &&
        typeof parsed.clientNotes === "string"
      ) {
        return {
          serviceIds: parsed.serviceIds.filter((id): id is ServiceCatalogId =>
            SERVICE_CATALOG.some((service) => service.id === id),
          ),
          costCenter: parsed.costCenter,
          address: parsed.address,
          beforeSubject: parsed.beforeSubject,
          activities: parsed.activities,
          clientNotes: parsed.clientNotes,
          phase: visit.checkOutAt ? 4 : parsed.phase,
        };
      }
    } catch {
      // Las visitas anteriores guardan texto libre en notes.
    }
  }

  const serviceIds = resolveServiceIds(undefined, visit.contractedActivity);
  let phase: VisitFlow["phase"] = 1;
  if (visit.checkOutAt) phase = 4;
  else if (visit.checkInAt) phase = 3;

  return {
    serviceIds,
    costCenter: visit.siteName,
    address: visit.siteName,
    beforeSubject: photoSubjectFor(visit.serviceNumber || visit.siteName),
    activities: activitiesFor(serviceIds),
    clientNotes: notes?.trim() ? notes : "",
    phase,
  };
}

export function serviceTypeLabel(flow: VisitFlow): string {
  if (flow.serviceIds.length === 0) return "Sin tipo";
  return serviceLabels(flow.serviceIds);
}

export function stepLabel(visit: LocalVisit): string {
  if (visit.checkOutAt) return "Finalizada";
  return `Paso ${decodeVisitFlow(visit.notes, visit).phase}`;
}

export function hasCaption(captions: string[], prefix: string): boolean {
  return captions.some((caption) => caption.startsWith(prefix));
}

export function finishBlockers(flow: VisitFlow, hasAfterPhoto: boolean): string | null {
  if (flow.activities.length === 0) return "Elige el tipo de servicio.";
  if (flow.activities.some((activity) => !activity.done)) {
    return "Marca las actividades pendientes y escribe una justificación.";
  }
  if (flow.activities.some((activity) => activity.needsJustification && !activity.justification.trim())) {
    return "Escribe la justificación de las actividades que faltaban.";
  }
  if (!hasAfterPhoto) return "Adjunta la foto de después.";
  return null;
}

export function markPhaseFour(flow: VisitFlow): VisitFlow {
  return {
    ...flow,
    phase: 4,
    activities: flow.activities.map((activity) => ({
      ...activity,
      needsJustification: activity.needsJustification || !activity.done,
    })),
  };
}
