import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { listServicesForEmail, serviceDetailForEmail, statusLabel } from "@/lib/client-services";
import { seedUserById } from "@/lib/seed-users";

function actorEmail(actor: { id: string; email?: string }) {
  return seedUserById(actor.id)?.email || actor.email?.trim() || "";
}

export async function GET(req: Request) {
  const gate = await requireRole(req, ["cliente"]);
  if (gate.error) return gate.error;
  const email = actorEmail(gate.actor);
  const code = new URL(req.url).searchParams.get("code");
  if (code) {
    const service = await serviceDetailForEmail(email, code);
    if (!service) return NextResponse.json({ error: "no_encontrado" }, { status: 404 });
    return NextResponse.json({ service: { ...service, statusLabel: statusLabel(service.status) } });
  }
  const services = await listServicesForEmail(email);
  return NextResponse.json({
    services: services.map((service) => ({ ...service, statusLabel: statusLabel(service.status) })),
  });
}
