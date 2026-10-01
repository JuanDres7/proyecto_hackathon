import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const COOKIE = "campo.api";

function secret() {
  return process.env.CAMPO_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only-campo";
}

export type ApiActor = { id: string; role: UserRole; demo: boolean; email?: string };

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function encodeDemoSession(actor: ApiActor) {
  const body = Buffer.from(JSON.stringify({ ...actor, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString(
    "base64url",
  );
  return `${body}.${sign(body)}`;
}

export function decodeDemoSession(token: string | undefined): ApiActor | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as ApiActor & { exp?: number };
    if (parsed.exp && parsed.exp < Date.now()) return null;
    if (!parsed.role || !parsed.id) return null;
    return {
      id: parsed.id,
      role: parsed.role,
      demo: true,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
    };
  } catch {
    return null;
  }
}

export function sessionCookie(actor: ApiActor) {
  return {
    name: COOKIE,
    value: encodeDemoSession(actor),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 12,
    },
  };
}

export async function requireRole(req: Request, roles: UserRole[]) {
  const supabase = await createServerSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .maybeSingle();
      const role = (profile?.role as UserRole) ?? "supervisor";
      if (!roles.includes(role)) {
        return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
      }
      return {
        actor: { id: data.user.id, role, demo: false, email: data.user.email ?? undefined } as ApiActor,
      };
    }
  }

  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  const token = match?.slice(COOKIE.length + 1);
  const demo = decodeDemoSession(token);
  if (demo && roles.includes(demo.role)) {
    return { actor: demo };
  }

  return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}
