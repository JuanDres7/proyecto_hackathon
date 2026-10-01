import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { confirmDraft } from "@/lib/orders";
import { SERVICE_CATALOG } from "@/lib/catalog";
import type { QuoteDraft } from "@/lib/types";

const ALLOWED = new Set(SERVICE_CATALOG.map((service) => service.id));

export async function POST(req: Request) {
  const gate = await requireRole(req, ["coordinador"]);
  if (gate.error) return gate.error;

  const body = (await req.json().catch(() => null)) as {
    costCenter?: string;
    location?: string;
    services?: string[];
  } | null;
  const costCenter = body?.costCenter?.trim() ?? "";
  const location = body?.location?.trim() ?? "";
  const services = (body?.services ?? []).filter((id) => ALLOWED.has(id as never));
  if (costCenter.length < 2 || location.length < 2 || services.length === 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const draft: QuoteDraft = {
    draftId: crypto.randomUUID(),
    customerName: costCenter,
    customerDocument: "coordinacion",
    email: "coordinacion@limpiapp.co",
    phone: "3000000000",
    openingMessage: "Asignado por coordinación",
    services,
    scheduledAt: new Date().toISOString(),
    location,
    status: "pending_confirmation",
  };
  const result = await confirmDraft(draft);
  if (!result.ok) return NextResponse.json({ error: "invalid", missing: result.missing }, { status: 400 });
  return NextResponse.json({
    ok: true,
    serviceNumber: result.serviceNumber,
    costCenter,
    location,
    services,
  });
}
