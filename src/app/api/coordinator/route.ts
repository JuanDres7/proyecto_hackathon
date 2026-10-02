import { NextResponse } from "next/server";
import { createAdminClient, withAdminTimeout } from "@/lib/supabase/admin";
import { memory } from "@/lib/memory-store";
import { ensureDemoShowcase } from "@/lib/demo-data";
import { coordinatorAction } from "@/lib/orders";
import { requireRole } from "@/lib/api-auth";
import { coordinatorPostSchema } from "@/lib/schemas";
import { TEAM_SUPERVISORS } from "@/lib/seed-users";

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
      const result = await withAdminTimeout(
        admin.from("visits").select("*").order("updated_at", { ascending: false }).range(offset, offset + limit - 1),
      );
      if (result && !result.error) {
        const remote = result.data ?? [];
        if (remote.length) return NextResponse.json({ visits: remote });
      }
    }
    return NextResponse.json({ visits: memory.visits.all() });
  }

  if (kind === "alerts") {
    if (admin) {
      const result = await withAdminTimeout(
        admin.from("alerts").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1),
      );
      if (result && !result.error) {
        const remote = result.data ?? [];
        if (remote.length) return NextResponse.json({ alerts: remote });
      }
    }
    return NextResponse.json({ alerts: memory.alerts.all() });
  }

  if (kind === "kpis") {
    const fallback = coordinatorKpisFromMemory();
    if (admin) {
      const visitsRes = await withAdminTimeout(admin.from("visits").select("status, supervisor_id"));
      const ordersRes = await withAdminTimeout(
        admin.from("service_orders").select("supervisor_id, status").eq("status", "confirmed"),
      );
      const profilesRes = await withAdminTimeout(
        admin.from("profiles").select("id, full_name, role").eq("role", "supervisor"),
      );
      const visits = visitsRes && !visitsRes.error ? visitsRes.data ?? [] : [];
      if (visits.length) {
        const orders = ordersRes && !ordersRes.error ? ordersRes.data ?? [] : [];
        const profiles = profilesRes && !profilesRes.error ? profilesRes.data ?? [] : [];
        const total = visits.length;
        const completed = visits.filter((v) => v.status === "completada").length;
        return NextResponse.json({
          kpis: {
            total,
            completed,
            inProgress: visits.filter((v) => v.status === "en_curso").length,
            incidents: visits.filter((v) => v.status === "novedad").length,
            compliancePct: total ? Math.round((completed / total) * 100) : 0,
            assignedSupervisors: new Set(orders.map((o) => o.supervisor_id).filter(Boolean)).size,
            activeSupervisors: new Set(
              visits.filter((v) => v.status === "en_curso").map((v) => v.supervisor_id).filter(Boolean),
            ).size,
          },
          supervisors: profiles.length
            ? profiles.map((p) => ({ id: p.id, full_name: p.full_name }))
            : fallback.supervisors,
        });
      }
    }
    return NextResponse.json(fallback);
  }

  if (kind === "pqr") {
    const localItems = memory.pqr.all().map((c) => {
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
        photoUrl: null as string | null,
      };
    });
    if (admin) {
      const casesRes = await withAdminTimeout(admin.from("pqr_cases").select("*").order("opened_at", { ascending: false }));
      if (casesRes && !casesRes.error && (casesRes.data?.length ?? 0) > 0) {
        const complaintsRes = await withAdminTimeout(admin.from("complaints").select("*"));
        const complaints = complaintsRes && !complaintsRes.error ? complaintsRes.data ?? [] : [];
        const items = await Promise.all(
          (casesRes.data ?? []).map(async (c) => {
            const complaint = complaints.find((x) => x.service_number === c.service_number);
            let photoUrl: string | null = null;
            if (complaint?.photo_path) {
              const signed = await withAdminTimeout(admin.storage.from("evidencias").createSignedUrl(complaint.photo_path, 3600));
              photoUrl = signed?.data?.signedUrl ?? null;
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
    }
    return NextResponse.json({ items: localItems });
  }

  return NextResponse.json({ error: "kind" }, { status: 400 });
}

function coordinatorKpisFromMemory() {
  const visits = memory.visits.all();
  const orders = memory.orders.confirmed();
  const total = visits.length;
  const completed = visits.filter((v) => v.status === "completada").length;
  return {
    kpis: {
      total,
      completed,
      inProgress: visits.filter((v) => v.status === "en_curso").length,
      incidents: visits.filter((v) => v.status === "novedad").length,
      compliancePct: total ? Math.round((completed / total) * 100) : 0,
      assignedSupervisors: new Set(orders.map((o) => o.supervisorId).filter(Boolean)).size,
      activeSupervisors: new Set(
        visits.filter((v) => v.status === "en_curso").map((v) => v.supervisor_id).filter(Boolean),
      ).size,
    },
    supervisors: TEAM_SUPERVISORS.map((item) => ({ id: item.id, full_name: item.fullName })),
  };
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
