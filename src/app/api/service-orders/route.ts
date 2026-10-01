import { NextResponse } from "next/server";
import { listConfirmed, requireAdmin } from "@/lib/client-chat/orders";

export async function GET() {
  try {
    const db = requireAdmin();
    const orders = await listConfirmed(db);
    return NextResponse.json({ orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron leer los servicios.";
    return NextResponse.json({ orders: [], reply: message }, { status: 500 });
  }
}
