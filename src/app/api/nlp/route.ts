import { NextResponse } from "next/server";
import { classifyComment } from "@/lib/evaluations";
import { requireRole } from "@/lib/api-auth";
import { z } from "zod";

const schema = z.object({ text: z.string(), serviceNumber: z.string().optional() });

export async function POST(req: Request) {
  const gate = await requireRole(req, ["coordinador", "cliente"]);
  if (gate.error) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const result = await classifyComment(parsed.data.text, parsed.data.serviceNumber);
  return NextResponse.json(result);
}
