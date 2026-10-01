import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { memory } from "@/lib/memory-store";
import { coordinatorAction } from "@/lib/orders";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "visits";
  const admin = createAdminClient();

  if (kind === "visits") {
    if (admin) {
      const { data } = await admin.from("visits").select("*").order("updated_at", { ascending: false });
      return NextResponse.json({ visits: data ?? [] });
    }
    return NextResponse.json({ visits: memory.visits.all() });
  }

  if (kind === "alerts") {
    if (admin) {
      const { data } = await admin.from("alerts").select("*").order("created_at", { ascending: false }).limit(50);
      return NextResponse.json({ alerts: data ?? [] });
    }
    return NextResponse.json({ alerts: memory.alerts.all() });
  }

  if (kind === "pqr") {
    if (admin) {
      const { data: cases } = await admin.from("pqr_cases").select("*").order("opened_at", { ascending: false });
      const { data: complaints } = await admin.from("complaints").select("*");
      const items = await Promise.all(
        (cases ?? []).map(async (c) => {
          const complaint = (complaints ?? []).find((x) => x.service_number === c.service_number);
          let photoUrl: string | null = null;
          if (complaint?.photo_path) {
            const { data: signed } = await admin.storage
              .from("evidencias")
              .createSignedUrl(complaint.photo_path, 3600);
            photoUrl = signed?.signedUrl ?? null;
          }
          return {
            ...c,
            rating: complaint?.rating,
            body: complaint?.body,
            label: complaint?.label,
            confidence: complaint?.confidence,
            vision_valid: complaint?.vision_valid,
            vision_note: complaint?.vision_note,
            summary: complaint?.summary,
            photoUrl,
          };
        }),
      );
      return NextResponse.json({ items });
    }
    const items = memory.pqr.all().map((c) => {
      const complaint = memory.complaints.byNumber(c.service_number);
      return {
        ...c,
        rating: complaint?.rating,
        body: complaint?.body,
        label: complaint?.label,
        confidence: complaint?.confidence,
        vision_valid: complaint?.vision_valid,
        vision_note: complaint?.vision_note,
        summary: complaint?.summary,
        photoUrl: null,
      };
    });
    return NextResponse.json({ items });
  }

  return NextResponse.json({ error: "kind" }, { status: 400 });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action: "authorize_close" | "reassign";
    serviceNumber: string;
    supervisorId?: string;
  };
  const result = await coordinatorAction(body);
  return NextResponse.json(result);
}
