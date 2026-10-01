export type DerivedStatus =
  | "sin_servicio_activo"
  | "pendiente_sincronizacion"
  | "asignado"
  | "en_camino"
  | "pausa_novedad"
  | "en_ejecucion"
  | "finalizado"
  | "confirmado_sin_supervisor";

export type OrderFacts = {
  status: string;
  supervisorName?: string | null;
  supervisorId?: string | null;
  enRouteAt?: string | null;
  services?: string[];
};

export type VisitFacts = {
  checkInAt?: string | null;
  checkOutAt?: string | null;
  novedad?: string | null;
  contractedActivity?: string | null;
  siteName?: string | null;
} | null;

export function deriveProgress(order: OrderFacts | null, visit: VisitFacts): DerivedStatus {
  if (!order || order.status === "cancelled" || order.status === "draft") {
    return "sin_servicio_activo";
  }
  if (order.status !== "confirmed" && order.status !== "pending_confirmation") {
    if (order.status === "pending_confirmation") return "sin_servicio_activo";
  }
  if (order.status !== "confirmed") return "sin_servicio_activo";

  if (visit?.checkOutAt) return "finalizado";
  if (visit?.checkInAt && !visit.checkOutAt && visit.novedad) return "pausa_novedad";
  if (visit?.checkInAt && !visit.checkOutAt) return "en_ejecucion";
  if (order.enRouteAt && !visit) return "pendiente_sincronizacion";
  if (order.enRouteAt && visit && !visit.checkInAt) return "pendiente_sincronizacion";
  if (order.supervisorId && !order.enRouteAt) return "asignado";
  if (!order.supervisorId) return "confirmado_sin_supervisor";
  return "asignado";
}

export function progressMessage(status: DerivedStatus, order: OrderFacts | null): string {
  switch (status) {
    case "sin_servicio_activo":
      return "No hay un servicio activo con ese código.";
    case "pendiente_sincronizacion":
      return "El supervisor ya va en ruta. La ejecución está pendiente de sincronización. Todavía no hay tareas registradas en el servidor.";
    case "asignado": {
      const name = order?.supervisorName?.trim();
      const idNote = "No hay un documento de identificación distinto guardado.";
      return name
        ? `Estado asignado. Supervisor: ${name}. ${idNote}`
        : `Estado asignado. Aún no hay nombre de supervisor registrado. ${idNote}`;
    }
    case "en_camino":
      return "El supervisor está en camino al sitio.";
    case "pausa_novedad":
      return "El servicio está en pausa por una novedad de campo. El coordinador está gestionando la solución.";
    case "en_ejecucion":
      return "El servicio está en ejecución. Ya hay check-in sincronizado.";
    case "finalizado":
      return "El servicio está finalizado.";
    case "confirmado_sin_supervisor":
      return "Solicitud confirmada. Todavía no hay supervisor asignado.";
    default:
      return "No hay un servicio activo con ese código.";
  }
}
