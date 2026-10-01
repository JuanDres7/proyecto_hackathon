"use client";

import { useCallback, useEffect, useState } from "react";
import { serviceLabels } from "@/lib/catalog";
import { installServiceSnapshot, readServiceSnapshot } from "./service-snapshot";

export type CurrentServiceView = {
  code: string;
  status: string;
  services: string;
  when: string;
  location: string;
};

type ConfirmedRow = {
  serviceNumber?: string;
  location?: string;
  services?: string[];
  enRouteAt?: string;
  scheduledAt?: string;
  scheduled_at?: string;
};

const STATUS_LABEL: Record<string, string> = {
  sin_servicio_activo: "Sin servicio activo",
  pendiente_sincronizacion: "Pendiente de sincronización",
  asignado: "Asignado",
  en_camino: "En camino",
  pausa_novedad: "En pausa",
  en_ejecucion: "En ejecución",
  finalizado: "Finalizado",
  confirmado_sin_supervisor: "Confirmado",
};

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function useCurrentService() {
  const [service, setService] = useState<CurrentServiceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/confirmed-services");
      if (!response.ok) throw new Error("services");
      const json = (await response.json()) as { services?: ConfirmedRow[] };
      const list = (json.services ?? []).filter((item) => item.serviceNumber);
      const snapshot = readServiceSnapshot();
      const row = list.find((item) => item.serviceNumber === snapshot?.code) ?? list[0];
      if (!row?.serviceNumber) {
        setService(null);
        return;
      }

      let status = row.enRouteAt ? "En camino" : "Confirmado";
      const storedWhen = row.scheduledAt || row.scheduled_at;
      let when = formatWhen(storedWhen);

      try {
        const progressResponse = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceNumber: row.serviceNumber }),
        });
        if (progressResponse.ok) {
          const progress = (await progressResponse.json()) as {
            status?: string;
            scheduledAt?: string;
          };
          if (progress.status && STATUS_LABEL[progress.status]) {
            status = STATUS_LABEL[progress.status];
          }
          if (!when && progress.scheduledAt) when = formatWhen(progress.scheduledAt);
        }
      } catch {
        // El listado confirmado sigue siendo suficiente para el código y el lugar.
      }

      const sameSnapshot = snapshot?.code === row.serviceNumber ? snapshot : null;
      const names = serviceLabels(
        row.services && row.services.length > 0 ? row.services : (sameSnapshot?.services ?? []),
      );
      if (!when) when = formatWhen(sameSnapshot?.when);
      setService({
        code: row.serviceNumber,
        status,
        services: names || "Sin servicios",
        when: when || "Sin fecha",
        location: row.location?.trim() || sameSnapshot?.location?.trim() || "Sin ubicación",
      });
    } catch {
      setError("No se pudo cargar el servicio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    installServiceSnapshot();
    const onUpdate = () => {
      void refresh();
    };
    window.addEventListener("limpiapp-service", onUpdate);
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      window.removeEventListener("limpiapp-service", onUpdate);
      window.clearTimeout(timer);
    };
  }, [refresh]);

  return { service, loading, error, refresh };
}
