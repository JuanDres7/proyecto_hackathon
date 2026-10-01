export type UserRole = "supervisor" | "coordinador" | "cliente";

export type VisitStatus = "pendiente" | "en_curso" | "completada" | "novedad";

export type ChatState = "cotizacion" | "seguimiento" | "cierre";

export type SyncStatus = "pending" | "syncing" | "synced" | "error";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  demo: boolean;
};

export type LocalVisit = {
  id: string;
  clientUuid: string;
  supervisorId: string;
  siteName: string;
  contractedActivity: string;
  status: VisitStatus;
  checkInAt?: string;
  checkOutAt?: string;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  notes?: string;
  novedad?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type LocalEvidence = {
  id: string;
  visitId: string;
  blob: Blob;
  mimeType: string;
  caption?: string;
  storagePath?: string;
  syncStatus: SyncStatus;
  createdAt: string;
};

export type OutboxItem = {
  id: string;
  entity: "visit" | "evidence" | "complaint";
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageDataUrl?: string;
  createdAt: string;
};
