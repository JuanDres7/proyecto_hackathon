"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Detail = {
  serviceNumber: string;
  serviceLabel: string;
  location: string;
  scheduledAt: string | null;
  statusLabel: string;
  supervisorName: string | null;
  accessNotes: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  novedad: string | null;
  novedadPriority: string | null;
  clientNotes: string;
  activities: { label: string; group: string; done: boolean; justification: string }[];
};

export function ClientServiceDetail({ code }: { code: string }) {
  const [service, setService] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/my-services?code=${encodeURIComponent(code)}`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 404) throw new Error("missing");
        if (!response.ok) throw new Error("services");
        return response.json() as Promise<{ service?: Detail }>;
      })
      .then((json) => {
        if (!cancelled) setService(json.service ?? null);
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(reason.message === "missing" ? "No encontramos ese servicio en tu cuenta." : "No se pudo abrir el servicio.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-status-warning">{error}</p>
        <Link href="/cliente/servicios" className="text-sm text-primary">
          Volver a mis servicios
        </Link>
      </div>
    );
  }
  if (!service) return <p className="text-sm text-text-secondary">Cargando servicio…</p>;

  const groups = [...new Set(service.activities.map((activity) => activity.group))];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/cliente/servicios" className="text-sm font-medium text-primary">
        Volver a mis servicios
      </Link>
      <section className="rounded-xl border border-border-subtle bg-surface-container-low p-4 space-y-3">
        <p className="font-mono text-2xl font-semibold text-text-primary">{service.serviceNumber}</p>
        <p className="text-sm text-text-primary">{service.serviceLabel}</p>
        <p className="text-sm text-primary">{service.statusLabel}</p>
        <Field label="Dirección" value={service.location} />
        <Field label="Fecha" value={service.scheduledAt ? formatWhen(service.scheduledAt) : "Sin fecha"} />
        <Field label="Supervisor" value={service.supervisorName || "Aún no asignado"} />
        <Field label="Acceso" value={service.accessNotes || "Sin observaciones"} />
        {service.checkInAt ? <Field label="Llegada" value={formatWhen(service.checkInAt)} /> : null}
        {service.checkOutAt ? <Field label="Salida" value={formatWhen(service.checkOutAt)} /> : null}
        {service.novedad ? (
          <Field label={`Novedad${service.novedadPriority ? ` (${service.novedadPriority})` : ""}`} value={service.novedad} />
        ) : null}
        {service.clientNotes ? <Field label="Observaciones" value={service.clientNotes} /> : null}
      </section>
      {groups.length > 0 ? (
        <section className="rounded-xl border border-border-subtle bg-surface-container-low p-4 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Tareas</h2>
          {groups.map((group) => (
            <div key={group}>
              <p className="text-xs text-text-muted">{group}</p>
              <ul className="mt-1 space-y-1 text-sm text-text-primary">
                {service.activities
                  .filter((activity) => activity.group === group)
                  .map((activity) => (
                    <li key={`${group}-${activity.label}`}>
                      {activity.done ? "Hecha" : "Pendiente"} · {activity.label}
                      {activity.justification ? ` — ${activity.justification}` : ""}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="block text-xs text-text-muted">{label}</span>
      <span className="text-text-primary">{value}</span>
    </p>
  );
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}
