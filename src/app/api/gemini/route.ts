import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    reply:
      "El modelo no emite códigos, precios, horas, ubicaciones ni el estado de la visita. Usa el formulario de cotización y las consultas de progreso del sistema.",
  });
}
