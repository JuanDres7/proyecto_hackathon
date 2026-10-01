export type ProgressVisit = {
  checkInAt: string | null;
  checkOutAt: string | null;
  novedad: string | null;
  contractedActivity: string | null;
};

export type ProgressFacts = {
  orderStatus: string | null;
  enRouteAt: string | null;
  supervisorName: string | null;
  supervisorDocument: string | null;
  visit: ProgressVisit | null;
};

export type DerivedProgress =
  | { kind: "inactive" }
  | { kind: "pendiente_sincronizacion" }
  | { kind: "asignado"; supervisorName: string; supervisorDocument: string }
  | { kind: "en_camino" }
  | { kind: "pausa_novedad" }
  | { kind: "en_ejecucion" }
  | { kind: "finalizado" }
  | { kind: "sin_asignar" };

export function deriveClientProgress(facts: ProgressFacts): DerivedProgress {
  if (!facts.orderStatus || facts.orderStatus === "cancelled" || facts.orderStatus === "draft") {
    return { kind: "inactive" };
  }
  const visit = facts.visit;
  if (!visit && facts.enRouteAt) return { kind: "pendiente_sincronizacion" };
  if (facts.supervisorName && !facts.enRouteAt && !visit?.checkInAt) {
    return {
      kind: "asignado",
      supervisorName: facts.supervisorName,
      supervisorDocument: facts.supervisorDocument ?? "sin identificación registrada",
    };
  }
  if (facts.enRouteAt && !visit?.checkInAt) return { kind: "en_camino" };
  if (visit?.checkInAt && !visit.checkOutAt && visit.novedad) return { kind: "pausa_novedad" };
  if (visit?.checkInAt && !visit.checkOutAt) return { kind: "en_ejecucion" };
  if (visit?.checkOutAt) return { kind: "finalizado" };
  if (facts.orderStatus === "confirmed" || facts.orderStatus === "pending_confirmation") {
    return { kind: "sin_asignar" };
  }
  return { kind: "inactive" };
}
