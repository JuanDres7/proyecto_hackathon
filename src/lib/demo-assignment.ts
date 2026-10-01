import { memory } from "@/lib/memory-store";
import { SEED_USERS } from "@/lib/seed-users";
import { createAdminClient } from "@/lib/supabase/admin";

const client = SEED_USERS.find((user) => user.role === "cliente");
const supervisor = SEED_USERS.find((user) => user.role === "supervisor");

export const DEMO_SERVICE_NUMBER = "#3089";

export const DEMO_ASSIGNMENT = {
  serviceNumber: DEMO_SERVICE_NUMBER,
  customerName: client?.fullName ?? "Laura Méndez",
  customerDocument: "1020304050",
  email: client?.email ?? "cliente@limpiapp.co",
  phone: "3005550199",
  openingMessage: "Aseo general de oficinas y baños",
  services: ["aseo_general"],
  location: "Cra 7 # 71-21, Bogotá",
  accessNotes: "Recepción, preguntar por administración",
  supervisorId: supervisor?.id ?? "demo-supervisor",
  supervisorName: supervisor?.fullName ?? "Andrés Ríos",
};

export async function ensureDemoAssignment() {
  const scheduledAt = new Date().toISOString();
  const quote = {
    draftId: "demo-3089",
    demoSupervisorId: DEMO_ASSIGNMENT.supervisorId,
    supervisorName: DEMO_ASSIGNMENT.supervisorName,
  };
  const admin = createAdminClient();
  if (admin) {
    const { data } = await admin
      .from("service_orders")
      .select("id")
      .eq("service_number", DEMO_SERVICE_NUMBER)
      .maybeSingle();
    if (!data) {
      await admin.from("service_orders").insert({
        service_number: DEMO_SERVICE_NUMBER,
        customer_name: DEMO_ASSIGNMENT.customerName,
        customer_document: DEMO_ASSIGNMENT.customerDocument,
        email: DEMO_ASSIGNMENT.email,
        phone: DEMO_ASSIGNMENT.phone,
        opening_message: DEMO_ASSIGNMENT.openingMessage,
        services: DEMO_ASSIGNMENT.services,
        scheduled_at: scheduledAt,
        location: DEMO_ASSIGNMENT.location,
        access_notes: DEMO_ASSIGNMENT.accessNotes,
        status: "confirmed",
        quote_json: quote,
      });
    }
    return;
  }

  memory.reserveAfter(3089);
  if (memory.orders.byNumber(DEMO_SERVICE_NUMBER)) return;
  memory.orders.upsert({
    id: "demo-3089",
    draftId: "demo-3089",
    serviceNumber: DEMO_SERVICE_NUMBER,
    customerName: DEMO_ASSIGNMENT.customerName,
    customerDocument: DEMO_ASSIGNMENT.customerDocument,
    email: DEMO_ASSIGNMENT.email,
    phone: DEMO_ASSIGNMENT.phone,
    openingMessage: DEMO_ASSIGNMENT.openingMessage,
    services: DEMO_ASSIGNMENT.services,
    scheduledAt,
    location: DEMO_ASSIGNMENT.location,
    accessNotes: DEMO_ASSIGNMENT.accessNotes,
    status: "confirmed",
    supervisorId: DEMO_ASSIGNMENT.supervisorId,
    supervisorName: DEMO_ASSIGNMENT.supervisorName,
    quoteJson: quote,
  });
}
