import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/api-auth";
import { authenticateSeed, findSeedById, publicSeedUser } from "@/lib/seed-users";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: string; password?: string; id?: string } | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });

  if (typeof body.email === "string" && typeof body.password === "string") {
    const user = authenticateSeed(body.email, body.password);
    if (!user) return NextResponse.json({ error: "invalid" }, { status: 401 });
    const actor = publicSeedUser(user);
    const cookie = sessionCookie({
      id: actor.id,
      role: actor.role,
      demo: true,
      email: actor.email,
      fullName: actor.fullName,
    });
    const res = NextResponse.json({ ok: true, user: actor });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  }

  if (typeof body.id === "string") {
    const user = findSeedById(body.id);
    if (!user) return NextResponse.json({ error: "invalid" }, { status: 401 });
    const actor = publicSeedUser(user);
    const cookie = sessionCookie({
      id: actor.id,
      role: actor.role,
      demo: true,
      email: actor.email,
      fullName: actor.fullName,
    });
    const res = NextResponse.json({ ok: true, user: actor });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  }

  return NextResponse.json({ error: "invalid" }, { status: 400 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("campo.api", "", { path: "/", maxAge: 0 });
  return res;
}
