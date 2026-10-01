import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  return NextResponse.json({ publicKey: key });
}

export async function POST(req: Request) {
  const gate = await requireRole(req, ["supervisor", "coordinador", "cliente"]);
  if (gate.error) return gate.error;
  const parsed = subSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const admin = createAdminClient();
  if (!admin || gate.actor.demo) {
    return NextResponse.json({ ok: true, stored: false });
  }
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: gate.actor.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, stored: true });
}
