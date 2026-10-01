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
  scheduledAt?: string | null;
  statusLabel?: string;
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
      const response = await fetch("/api/my-services", { credentials: "include" });
      if (!response.ok) throw new Error("services");
      const json = (await response.json()) as { services?: ConfirmedRow[] };
      const list = (json.services ?? []).filter((item) => item.serviceNumber);
      const snapshot = readServiceSnapshot();
      const preferred =
        list.find((item) => item.statusLabel === "En ejecución") ??
        list.find((item) => item.statusLabel === "Asignado") ??
        list.find((item) => item.serviceNumber === snapshot?.code) ??
        list[0];
      if (!preferred?.serviceNumber) {
        setService(null);
        return;
      }
      const names = serviceLabels(preferred.services ?? []);
      setService({
        code: preferred.serviceNumber,
        status: preferred.statusLabel || "Confirmado",
        services: names || "Sin servicios",
        when: formatWhen(preferred.scheduledAt) || "Sin fecha",
        location: preferred.location?.trim() || "Sin ubicación",
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
