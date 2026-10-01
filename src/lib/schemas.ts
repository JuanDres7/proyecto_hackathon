import { z } from "zod";

export const quoteDraftSchema = z.object({
  draftId: z.string().min(1),
  customerName: z.string().optional(),
  customerDocument: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  openingMessage: z.string().optional(),
  services: z.array(z.string()).default([]),
  scheduledAt: z.string().optional(),
  location: z.string().optional(),
  accessNotes: z.string().optional(),
  serviceNumber: z.string().optional(),
  status: z.enum(["draft", "pending_confirmation", "confirmed", "cancelled"]),
});

export const ordersBodySchema = z.object({
  action: z.enum(["save", "confirm", "cancel", "reject", "pay"]),
  draft: quoteDraftSchema,
  reason: z.string().optional(),
});

export const coordinatorPostSchema = z.object({
  action: z.enum(["authorize_close", "reassign", "close_alert", "assign_route"]),
  serviceNumber: z.string().optional(),
  supervisorId: z.string().optional(),
  alertId: z.string().optional(),
  comment: z.string().optional(),
  costCenterId: z.string().uuid().optional(),
  scheduledStart: z.string().optional(),
});

export const enRouteSchema = z.object({
  serviceNumber: z.string().min(2),
  supervisorId: z.string().min(1),
});

export const fieldVisitSchema = z.object({
  id: z.string().min(1),
  clientUuid: z.string().min(1),
  supervisorId: z.string().min(1),
  serviceNumber: z.string().optional(),
  siteName: z.string().min(1),
  contractedActivity: z.string().default(""),
  status: z.enum(["pendiente", "en_curso", "completada", "novedad"]),
  checkInAt: z.string().optional(),
  checkOutAt: z.string().optional(),
  checkInLat: z.number().min(-90).max(90).optional(),
  checkInLng: z.number().min(-180).max(180).optional(),
  checkOutLat: z.number().min(-90).max(90).optional(),
  checkOutLng: z.number().min(-180).max(180).optional(),
  checkInAccuracyM: z.number().optional(),
  gpsMocked: z.boolean().optional(),
  costCenterId: z.string().uuid().optional(),
  siteLat: z.number().optional(),
  siteLng: z.number().optional(),
  geofenceRadiusM: z.number().optional(),
  identityVerified: z.boolean().optional(),
  checklist: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        subtitle: z.string().optional(),
        status: z.enum(["pending", "progress", "completed", "blocked"]),
      }),
    )
    .optional(),
  novedad: z.string().optional(),
  notes: z.string().optional(),
  novedadPriority: z.enum(["alta", "media", "baja"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const evaluationSchema = z.object({
  serviceNumber: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  image: z.string().optional(),
});

export const sessionSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["supervisor", "coordinador", "cliente"]),
  fullName: z.string().optional(),
  email: z.string().optional(),
});
