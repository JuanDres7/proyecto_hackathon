import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { evaluationSchema } from "@/lib/schemas";
import { submitEvaluation } from "@/lib/evaluations";
import { lookupProgress } from "@/lib/orders";

export async function POST(req: Request) {
  const gate = await requireRole(req, ["cliente", "coordinador"]);
  if (gate.error) return gate.error;
  const parsed = evaluationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const code = parsed.data.serviceNumber.startsWith("#")
    ? parsed.data.serviceNumber
    : `#${parsed.data.serviceNumber}`;
  const progress = await lookupProgress(code);
  if (progress.status === "sin_servicio_activo") {
    return NextResponse.json({ ok: false, error: "sin_servicio" }, { status: 400 });
  }
  const result = await submitEvaluation({
    serviceNumber: code,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? "",
    image: parsed.data.image,
  });
  return NextResponse.json(result);
}
