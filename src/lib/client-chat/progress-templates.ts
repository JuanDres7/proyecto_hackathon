import type { DerivedProgress } from "./progress";

export function progressReply(progress: DerivedProgress): string {
  switch (progress.kind) {
    case "inactive":
      return "No hay un servicio activo con ese código.";
    case "pendiente_sincronizacion":
      return "En ejecución - Pendiente de sincronización de datos.";
    case "asignado":
      return `Asignado. Supervisor: ${progress.supervisorName}. Identificación: ${progress.supervisorDocument}.`;
    case "en_camino":
      return "En camino. El supervisor va hacia el centro de costo. Ya no puedes editar ni cancelar.";
    case "pausa_novedad":
      return "Servicio en pausa. El coordinador está gestionando la solución.";
    case "en_ejecucion":
      return "En ejecución. Las tareas se están marcando en campo.";
    case "finalizado":
      return "Tu servicio ha finalizado.";
    case "sin_asignar":
      return "Tu servicio está confirmado. Aún no hay un supervisor asignado.";
    default:
      return "No hay un servicio activo con ese código.";
  }
}
