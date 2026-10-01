export type UserRole = "supervisor" | "coordinador" | "cliente";

export type VisitStatus = "pendiente" | "en_curso" | "completada" | "novedad";

export type ChatState = "cotizacion" | "progreso" | "finalizacion";

export type SyncStatus = "pending" | "syncing" | "synced" | "error" | "dead";

export type NovedadPriority = "alta" | "media" | "baja";

export type ChecklistItem = {
  id: string;
  title: string;
  subtitle?: string;
  status: "pending" | "progress" | "completed" | "blocked";
};

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
  serviceNumber?: string;
  siteName: string;
  contractedActivity: string;
  status: VisitStatus;
  checkInAt?: string;
  checkOutAt?: string;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  checkInAccuracyM?: number;
  gpsMocked?: boolean;
  costCenterId?: string;
  siteLat?: number;
  siteLng?: number;
  geofenceRadiusM?: number;
  identityVerified?: boolean;
  checklist?: ChecklistItem[];
  notes?: string;
  novedad?: string;
  novedadPriority?: NovedadPriority;
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
  contentHash?: string;
  syncStatus: SyncStatus;
  createdAt: string;
};

export type OutboxItem = {
  id: string;
  entity: "visit" | "evidence" | "complaint";
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  nextAttemptAt?: string;
  lastError?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageDataUrl?: string;
  createdAt: string;
};

export type QuoteDraft = {
  draftId: string;
  customerName?: string;
  customerDocument?: string;
  email?: string;
  phone?: string;
  openingMessage?: string;
  services: string[];
  scheduledAt?: string;
  location?: string;
  accessNotes?: string;
  serviceNumber?: string;
  status: "draft" | "pending_confirmation" | "confirmed" | "cancelled";
};
