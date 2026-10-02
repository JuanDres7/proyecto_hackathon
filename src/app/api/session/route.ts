import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/api-auth";
import { ensureDemoShowcase } from "@/lib/demo-data";
import { sessionSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  ensureDemoShowcase();
  const parsed = sessionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const cookie = sessionCookie({
    id: parsed.data.id,
    role: parsed.data.role,
    demo: true,
    email: parsed.data.email,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("campo.api", "", { path: "/", maxAge: 0 });
  return res;
}
