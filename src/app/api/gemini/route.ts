import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      reply: "Esta ruta ya no atiende el chat. Usa la conversación del cliente.",
    },
    { status: 410 },
  );
}
