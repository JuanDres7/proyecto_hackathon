import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { listConfirmedServices } from "@/lib/orders";

function normalizeCode(raw: string) {
  const digits = raw.trim().replace(/^#/, "");
  if (!/^\d{3,8}$/.test(digits)) return "";
  return `#${digits}`;
}

export async function GET(req: Request) {
  const gate = await requireRole(req, ["supervisor", "coordinador"]);
  if (gate.error) return gate.error;
  const rows = await listConfirmedServices();
  const code = normalizeCode(new URL(req.url).searchParams.get("code") ?? "");
  if (code) {
    const row = rows.find((item) => item.service_number === code);
    if (!row) return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
    return NextResponse.json({
      service: {
        serviceNumber: row.service_number,
        location: row.location,
        services: row.services,
        customerName: row.customer_name,
      },
    });
  }
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
