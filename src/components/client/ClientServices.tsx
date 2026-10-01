"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ServiceCard = {
  serviceNumber: string;
  serviceLabel: string;
  location: string;
  scheduledAt: string | null;
  statusLabel: string;
  supervisorName: string | null;
};

export function ClientServices() {
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/my-services", { credentials: "include", signal: AbortSignal.timeout(8000) })
      .then(async (response) => {
        if (!response.ok) throw new Error("services");
        return response.json() as Promise<{ services?: ServiceCard[] }>;
      })
      .then((json) => {
        if (!cancelled) setServices(json.services ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar tus servicios.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-sm text-text-secondary">Cargando servicios…</p>;
  if (error) return <p className="text-sm text-status-warning">{error}</p>;
  if (services.length === 0) {
    return <p className="text-sm text-text-secondary">Todavía no tienes servicios confirmados.</p>;
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-text-primary">Mis servicios</h1>
      <ul className="grid gap-3 md:grid-cols-2">
        {services.map((service) => (
          <li key={service.serviceNumber}>
            <Link
              href={`/cliente/servicios/${service.serviceNumber.replace("#", "")}`}
              className="block rounded-xl border border-border-subtle bg-surface-container-low p-4"
            >
              <p className="font-mono text-lg font-semibold text-text-primary">{service.serviceNumber}</p>
              <p className="mt-1 text-sm text-text-primary">{service.serviceLabel}</p>
              <p className="mt-1 text-sm text-text-secondary">{service.location}</p>
              <p className="mt-2 text-xs text-text-muted">
                {service.statusLabel}
                {service.scheduledAt ? ` · ${formatWhen(service.scheduledAt)}` : ""}
              </p>
              {service.supervisorName ? (
                <p className="mt-1 text-xs text-text-secondary">Supervisor: {service.supervisorName}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}
