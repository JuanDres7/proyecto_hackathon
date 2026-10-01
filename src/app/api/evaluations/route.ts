import { NextResponse } from "next/server";
import { submitEvaluation } from "@/lib/evaluations";
import { lookupProgress } from "@/lib/orders";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    serviceNumber: string;
    rating: number;
    comment?: string;
    image?: string;
  };
  const code = body.serviceNumber?.startsWith("#")
    ? body.serviceNumber
    : `#${body.serviceNumber ?? ""}`;
  const progress = await lookupProgress(code);
  if (progress.status === "sin_servicio_activo") {
    return NextResponse.json({ ok: false, error: "sin_servicio" }, { status: 400 });
  }
  const result = await submitEvaluation({
    serviceNumber: code,
    rating: body.rating,
    comment: body.comment ?? "",
    image: body.image,
  });
  return NextResponse.json(result);
}
