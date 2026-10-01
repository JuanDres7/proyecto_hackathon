import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { listConfirmedServices } from "@/lib/orders";

export async function GET(req: Request) {
  const gate = await requireRole(req, ["supervisor", "coordinador"]);
  if (gate.error) return gate.error;
  const rows = await listConfirmedServices();
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
