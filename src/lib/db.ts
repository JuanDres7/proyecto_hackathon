import Dexie, { type EntityTable } from "dexie";
import type { LocalEvidence, LocalVisit, OutboxItem } from "./types";

class CampoDB extends Dexie {
  visits!: EntityTable<LocalVisit, "id">;
  evidence!: EntityTable<LocalEvidence, "id">;
  outbox!: EntityTable<OutboxItem, "id">;

  constructor() {
    super("campo_supervision_db");
    this.version(1).stores({
      visits: "id, clientUuid, supervisorId, status, syncStatus, updatedAt",
      evidence: "id, visitId, syncStatus, createdAt",
      outbox: "id, entity, createdAt",
    });
    this.version(2).stores({
      visits: "id, clientUuid, supervisorId, serviceNumber, status, syncStatus, updatedAt",
      evidence: "id, visitId, syncStatus, createdAt",
      outbox: "id, entity, createdAt",
    });
  }
}

export const db = new CampoDB();

export async function enqueueOutbox(
  entity: OutboxItem["entity"],
  payload: Record<string, unknown>,
) {
  await db.outbox.add({
    id: crypto.randomUUID(),
    entity,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
}
