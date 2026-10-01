import { NextResponse } from "next/server";
import { classifyComment } from "@/lib/evaluations";

export async function POST(req: Request) {
  const body = (await req.json()) as { text: string; serviceNumber?: string };
  const result = await classifyComment(body.text ?? "", body.serviceNumber);
  return NextResponse.json(result);
}
