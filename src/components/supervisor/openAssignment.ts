import { serviceLabels } from "@/lib/catalog";
import { db } from "@/lib/db";
import { persistVisit } from "@/lib/sync";
import type { LocalVisit } from "@/lib/types";
import { resolveServiceIds } from "./activities";
import { createFlow, encodeVisitFlow } from "./visit-flow";

export type AssignedOrder = {
  serviceNumber: string;
  location?: string;
  services?: string[];
  customerName?: string;
};

const inflight = new Map<string, Promise<string>>();

async function createAssignedVisit(supervisorId: string, order: AssignedOrder): Promise<string> {
  const rows = await db.visits.toArray();
  const existing = rows.find((visit) => visit.serviceNumber === order.serviceNumber);
  if (existing) return existing.id;

  const serviceIds = resolveServiceIds(order.services, "");
  const flow = createFlow({
    serviceIds,
    costCenter: order.customerName?.trim() || "Sin centro de costo",
    address: order.location?.trim() || "Sin dirección",
    code: order.serviceNumber,
  });
  const now = new Date().toISOString();
  const visit: LocalVisit = {
    id: crypto.randomUUID(),
    clientUuid: crypto.randomUUID(),
    supervisorId,
    serviceNumber: order.serviceNumber,
    siteName: flow.address,
    contractedActivity: serviceIds.length > 0 ? serviceLabels(serviceIds) : "",
    status: "pendiente",
    syncStatus: "pending",
    notes: encodeVisitFlow(flow),
    createdAt: now,
    updatedAt: now,
  };
  await persistVisit(visit);
  return visit.id;
}

export function openAssignedVisit(supervisorId: string, order: AssignedOrder): Promise<string> {
  const pending = inflight.get(order.serviceNumber);
  if (pending) return pending;
  const job = createAssignedVisit(supervisorId, order).finally(() => {
    inflight.delete(order.serviceNumber);
  });
  inflight.set(order.serviceNumber, job);
  return job;
}
