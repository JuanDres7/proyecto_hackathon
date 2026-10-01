"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { serviceLabels } from "@/lib/catalog";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import type { LocalVisit } from "@/lib/types";
import { openAssignedVisit, type AssignedOrder } from "./supervisor/openAssignment";
import { useOnlineStatus } from "./supervisor/useOnlineStatus";
import { stepLabel } from "./supervisor/visit-flow";

export function SupervisorHome() {
  const { user } = useAuth();
  const router = useRouter();
  const online = useOnlineStatus();
  const [visits, setVisits] = useState<LocalVisit[]>([]);
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const rows = await db.visits.orderBy("updatedAt").reverse().toArray();
      if (cancelled) return;
      setVisits(rows);
      try {
        const response = await fetch("/api/confirmed-services");
        if (!response.ok) return;
        const json = (await response.json()) as { services?: AssignedOrder[] };
        if (!cancelled) setOrders(json.services ?? []);
      } catch {
        if (!cancelled) setOrders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function openOrder(order: AssignedOrder) {
    if (!user || opening) return;
    setOpening(order.serviceNumber);
    try {
      const id = await openAssignedVisit(user.id, order);
      router.push(`/supervisor/visita/${id}`);
    } finally {
      setOpening(null);
    }
  }

  const assignedNumbers = new Set(orders.map((order) => order.serviceNumber));
  const localOnly = visits.filter(
    (visit) => !visit.serviceNumber || !assignedNumbers.has(visit.serviceNumber),
  );

  return (
    <div className="mx-auto max-w-md space-y-4">
      <NetworkPill online={online} />
      {orders.length === 0 && localOnly.length === 0 ? (
        <p className="text-sm text-text-secondary">No tienes servicios asignados.</p>
      ) : null}

      <ul className="space-y-3">
        {orders.map((order) => {
          const local = visits.find((visit) => visit.serviceNumber === order.serviceNumber);
          const services = serviceLabels(order.services ?? []);
          return (
            <li key={order.serviceNumber}>
              <button
                type="button"
                disabled={opening === order.serviceNumber}
                onClick={() => void openOrder(order)}
                className="w-full rounded-xl border border-border-subtle bg-surface-container-low p-4 text-left"
              >
                <p className="font-mono text-lg font-semibold text-text-primary">
                  {order.serviceNumber}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {services || "Sin tipo"} · {order.location?.trim() || "Sin dirección"}
                </p>
                <p className="mt-2 text-xs text-text-muted">
                  {order.customerName?.trim() || "Sin centro de costo"}
                </p>
                <span className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary">
                  {local?.checkInAt ? stepLabel(local) : "Iniciar visita"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {localOnly.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">En este dispositivo</h2>
          <ul className="space-y-2">
            {localOnly.map((visit) => (
              <li key={visit.id}>
                <Link
                  href={`/supervisor/visita/${visit.id}`}
                  className="block rounded-xl border border-border-subtle bg-surface-container-low p-4"
                >
                  <p className="font-mono text-base font-semibold text-text-primary">
                    {visit.serviceNumber || "Sin código"}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">
                    {visit.contractedActivity || "Sin tipo"} · {visit.siteName}
                  </p>
                  <p className="mt-2 text-xs text-text-muted">{stepLabel(visit)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function NetworkPill({ online }: { online: boolean }) {
  return (
    <p className="flex items-center gap-2 text-sm text-text-secondary">
      <span
        className={`h-2.5 w-2.5 rounded-full ${online ? "bg-status-online" : "bg-status-warning"}`}
      />
      {online ? "En línea" : "Modo offline"}
    </p>
  );
}
