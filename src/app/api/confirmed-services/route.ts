import { NextResponse } from "next/server";
import { listConfirmedServices } from "@/lib/orders";

export async function GET() {
  const rows = await listConfirmedServices();
  return NextResponse.json({
    services: rows.map((r) => ({
      serviceNumber: r.service_number,
      location: r.location,
      services: r.services,
      customerName: r.customer_name,
      enRouteAt: r.en_route_at,
    })),
  });
}
