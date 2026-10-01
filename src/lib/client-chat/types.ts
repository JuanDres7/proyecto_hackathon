export const SERVICE_CODES = ["aseo_general", "jardineria", "limpieza_piscinas"] as const;

export type ServiceCode = (typeof SERVICE_CODES)[number];

export type OrderStatus = "draft" | "pending_confirmation" | "confirmed" | "cancelled";

export type CancellationReason = "data_error" | "plans_changed" | "too_expensive" | "other";

export type ChatPhase = "cotizacion" | "progreso" | "finalizacion";

export type ComplaintLabel =
  | "inasistencia"
  | "calidad"
  | "conducta"
  | "facturacion"
  | "seguridad"
  | "general"
  | "pending";

export type ProgressState =
  | "asignado"
  | "en_camino"
  | "check_in"
  | "en_ejecucion"
  | "pausa_novedad"
  | "finalizado"
  | "pendiente_sincronizacion";

export type QuoteSlots = {
  customerName: string;
  customerDocument: string;
  email: string;
  phone: string;
  openingMessage: string;
  services: ServiceCode[];
  scheduledAt: string;
  location: string;
  accessNotes: string;
};

export type ChatRequest = {
  draftId?: string | null;
  serviceNumber?: string | null;
  phase: ChatPhase;
  message?: string;
  confirmation?: "yes" | "no" | null;
  cancellationReason?: CancellationReason | null;
  rating?: number | null;
  photoDataUrl?: string | null;
  slots?: Partial<QuoteSlots> | null;
};

export type ChatResponse = {
  draftId: string | null;
  serviceNumber: string | null;
  phase: ChatPhase;
  reply: string;
  canEdit: boolean;
  canCancel: boolean;
  progress: ProgressState | null;
  evaluationSaved: boolean;
  pqrOpened: boolean;
  awaitingConfirmation?: boolean;
  activities?: string[];
  photos?: { label: string; url: string }[];
};

export const SERVICE_LABELS: Record<ServiceCode, string> = {
  aseo_general: "Aseo General",
  jardineria: "Jardinería",
  limpieza_piscinas: "Limpieza de Piscinas",
};

export const CANCEL_LABELS: Record<CancellationReason, string> = {
  data_error: "Error de datos",
  plans_changed: "Cambio de planes",
  too_expensive: "Costoso",
  other: "Otro",
};

export function emptySlots(): QuoteSlots {
  return {
    customerName: "",
    customerDocument: "",
    email: "",
    phone: "",
    openingMessage: "",
    services: [],
    scheduledAt: "",
    location: "",
    accessNotes: "",
  };
}
