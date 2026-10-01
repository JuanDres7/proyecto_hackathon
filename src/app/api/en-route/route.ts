import { NextResponse } from "next/server";
import { markEnRoute } from "@/lib/orders";

export async function POST(req: Request) {
  const body = (await req.json()) as { serviceNumber: string; supervisorId: string };
  if (!body.serviceNumber) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const at = await markEnRoute(body.serviceNumber, body.supervisorId);
  return NextResponse.json({ ok: true, enRouteAt: at });
}
