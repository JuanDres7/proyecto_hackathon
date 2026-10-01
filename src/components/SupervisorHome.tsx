"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import type { LocalVisit } from "@/lib/types";
import { openAssignedVisit, type AssignedOrder } from "./supervisor/openAssignment";
import { useOnlineStatus } from "./supervisor/useOnlineStatus";

export function SupervisorHome() {
  const { user } = useAuth();
  const router = useRouter();
  const online = useOnlineStatus();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visits, setVisits] = useState<LocalVisit[]>([]);
  const [assigned, setAssigned] = useState<AssignedOrder[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void db.visits.orderBy("updatedAt").reverse().toArray().then((rows) => {
      if (!cancelled) setVisits(rows.filter((visit) => visit.serviceNumber));
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetch("/api/confirmed-services", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return [];
        const json = (await response.json()) as { services?: AssignedOrder[] };
        return json.services ?? [];
      })
      .then((rows) => {
        if (!cancelled) setAssigned(rows.filter((row) => row.serviceNumber));
      })
      .catch(() => {
        if (!cancelled) setAssigned([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function openService(raw: string) {
    if (!user || busy) return;
    const digits = raw.trim().replace(/^#/, "");
    if (!/^\d{3,8}$/.test(digits)) {
      setError("Ingresa el código que te entregó el coordinador.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/confirmed-services?code=${encodeURIComponent(`#${digits}`)}`, {
        credentials: "include",
      });
      if (response.status === 401 || response.status === 403) {
        setError("Vuelve a entrar con supervisor@limpiapp.co para abrir el código.");
        return;
      }
      if (!response.ok) {
        setError("Ese código no está asignado. Usa #3089, #3090, #3091, #3066 o #3050.");
        return;
      }
      const json = (await response.json()) as { service?: AssignedOrder };
      if (!json.service?.serviceNumber) {
        setError("Ese código no está asignado. Confírmalo con el coordinador.");
        return;
      }
      const id = await openAssignedVisit(user.id, json.service);
      router.push(`/supervisor/visita/${id}`);
    } catch {
      setError("No se pudo abrir el servicio. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="rounded-xl border border-border-subtle bg-surface-container-low p-4">
        <p className="text-sm font-semibold text-text-primary">{user?.fullName || "Supervisor"}</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-text-secondary">
          <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-status-online" : "bg-status-warning"}`} />
          {online ? "En línea" : "Sin conexión. El servicio se guarda en este teléfono."}
        </p>
      </section>

      {assigned.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">Códigos asignados</h2>
          <ul className="space-y-2">
            {assigned.map((service) => (
              <li key={service.serviceNumber}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void openService(service.serviceNumber)}
                  className="w-full rounded-xl border border-border-subtle bg-surface-container-low p-4 text-left"
                >
                  <p className="font-mono text-lg font-semibold text-text-primary">{service.serviceNumber}</p>
                  <p className="mt-1 text-sm text-text-secondary">{service.location || "Sin dirección"}</p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void openService(code);
        }}
        className="space-y-3 rounded-xl border border-border-subtle bg-surface-container-low p-4"
      >
        <h2 className="text-sm font-semibold text-text-primary">Código del servicio</h2>
        <p className="text-sm text-text-secondary">
          Escríbelo tal como te lo entregó el coordinador. Las tareas salen de ese servicio.
        </p>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="#3089"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="w-full rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-3 font-mono text-lg text-text-primary"
        />
        {error ? (
          <p className="text-sm text-status-warning" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          {busy ? "Abriendo…" : "Abrir servicio"}
        </button>
      </form>

      {visits.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">Servicios en este teléfono</h2>
          <ul className="space-y-2">
            {visits.map((visit) => (
              <li key={visit.id}>
                <Link
                  href={`/supervisor/visita/${visit.id}`}
                  className="block rounded-xl border border-border-subtle bg-surface-container-low p-4"
                >
                  <p className="font-mono text-lg font-semibold text-text-primary">{visit.serviceNumber}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {visit.contractedActivity || "Servicio"} · {visit.siteName}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
