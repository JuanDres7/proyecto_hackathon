import { NextResponse } from "next/server";
import { markEnRoute } from "@/lib/orders";
import { requireRole } from "@/lib/api-auth";
import { enRouteSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const gate = await requireRole(req, ["supervisor", "coordinador"]);
  if (gate.error) return gate.error;
  const parsed = enRouteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const at = await markEnRoute(parsed.data.serviceNumber, parsed.data.supervisorId);
  return NextResponse.json({ ok: true, enRouteAt: at });
}
