import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { listConfirmedServices } from "@/lib/orders";

export async function GET(req: Request) {
  const gate = await requireRole(req, ["supervisor", "coordinador", "cliente"]);
  if (gate.error) return gate.error;
  if (gate.actor.role === "cliente" && !gate.actor.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await listConfirmedServices(
    gate.actor.role === "cliente"
      ? { email: gate.actor.email }
      : gate.actor.role === "supervisor"
        ? { supervisorId: gate.actor.id }
        : undefined,
  );
  return NextResponse.json({
    services: rows.map((r) => ({
      serviceNumber: r.service_number,
      location: r.location,
      services: r.services,
      customerName: r.customer_name,
      scheduledAt: r.scheduled_at,
      enRouteAt: r.en_route_at,
    })),
  });
}
