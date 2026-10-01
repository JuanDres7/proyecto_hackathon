import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { memory } from "@/lib/memory-store";
import { ensureDemoShowcase } from "@/lib/demo-data";
import { coordinatorAction } from "@/lib/orders";
import { requireRole } from "@/lib/api-auth";
import { coordinatorPostSchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const gate = await requireRole(req, ["coordinador"]);
  if (gate.error) return gate.error;
  ensureDemoShowcase();

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "visits";
  const offset = Number(searchParams.get("offset") ?? "0");
  const limit = Math.min(100, Number(searchParams.get("limit") ?? "50"));
  const admin = createAdminClient();

  if (kind === "visits") {
    if (admin) {
      const { data, error } = await admin
        .from("visits")
        .select("*")
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ visits: data ?? [] });
    }
    return NextResponse.json({ visits: memory.visits.all() });
  }

  if (kind === "alerts") {
    if (admin) {
      const { data, error } = await admin
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ alerts: data ?? [] });
    }
    return NextResponse.json({ alerts: memory.alerts.all() });
  }

  if (kind === "kpis") {
    if (admin) {
      const { data: visits } = await admin.from("visits").select("status, supervisor_id, check_in_at, check_out_at");
      const { data: orders } = await admin
        .from("service_orders")
        .select("supervisor_id, status")
        .eq("status", "confirmed");
      const { data: profiles } = await admin.from("profiles").select("id, full_name, role").eq("role", "supervisor");
      const total = visits?.length ?? 0;
      const completed = visits?.filter((v) => v.status === "completada").length ?? 0;
      return NextResponse.json({
        kpis: {
          total,
          completed,
          inProgress: visits?.filter((v) => v.status === "en_curso").length ?? 0,
          incidents: visits?.filter((v) => v.status === "novedad").length ?? 0,
          compliancePct: total ? Math.round((completed / total) * 100) : 0,
          assignedSupervisors: new Set((orders ?? []).map((o) => o.supervisor_id).filter(Boolean)).size,
          activeSupervisors: new Set(
            (visits ?? []).filter((v) => v.status === "en_curso").map((v) => v.supervisor_id).filter(Boolean),
          ).size,
        },
        supervisors: profiles ?? [],
      });
    }
    const visits = memory.visits.all();
    return NextResponse.json({
      kpis: {
        total: visits.length,
        completed: visits.filter((v) => v.status === "completada").length,
        inProgress: visits.filter((v) => v.status === "en_curso").length,
        incidents: visits.filter((v) => v.status === "novedad").length,
        compliancePct: visits.length
          ? Math.round((visits.filter((v) => v.status === "completada").length / visits.length) * 100)
          : 0,
        assignedSupervisors: 0,
        activeSupervisors: 0,
      },
      supervisors: [],
    });
  }

  if (kind === "pqr") {
    if (admin) {
      const { data: cases, error } = await admin.from("pqr_cases").select("*").order("opened_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  const gate = await requireRole(req, ["coordinador"]);
  if (gate.error) return gate.error;
  const parsed = coordinatorPostSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const result = await coordinatorAction({ ...parsed.data, actorId: gate.actor.id });
  return NextResponse.json(result);
}
