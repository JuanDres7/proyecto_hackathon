import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { ensureDemoShowcase } from "@/lib/demo-data";
import { SEED_USERS, TEAM_SUPERVISORS } from "@/lib/seed-users";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildReportRows,
  inReportRange,
  parseReportGroup,
  reportToCsv,
  reportToPdf,
  visitsFromMemory,
  type ReportVisit,
} from "@/lib/reports";

async function loadVisits(): Promise<{ visits: ReportVisit[]; names: Record<string, string> }> {
  ensureDemoShowcase();
  const names: Record<string, string> = {};
  for (const user of SEED_USERS) names[user.id] = user.fullName;
  for (const teammate of TEAM_SUPERVISORS) names[teammate.id] = teammate.fullName;
  const admin = createAdminClient();
  if (!admin) return { visits: visitsFromMemory(), names };

  const [{ data, error }, { data: profiles }, { data: orders }] = await Promise.all([
    admin.from("visits").select("supervisor_id, status, site_name, service_number, created_at"),
    admin.from("profiles").select("id, full_name"),
    admin.from("service_orders").select("service_number, customer_name"),
  ]);
  if (error || !data?.length) return { visits: visitsFromMemory(), names };

  for (const profile of profiles ?? []) {
    if (profile.id && profile.full_name) names[profile.id] = profile.full_name;
  }
  const centers = new Map<string, string>();
  for (const order of orders ?? []) {
    if (order.service_number && order.customer_name) centers.set(order.service_number, order.customer_name);
  }
  return {
    names,
    visits: data.map((visit) => ({
      supervisorId: visit.supervisor_id,
      status: visit.status,
      siteName: visit.site_name,
      serviceNumber: visit.service_number,
      costCenter: (visit.service_number && centers.get(visit.service_number)) || visit.site_name,
      createdAt: visit.created_at,
    })),
  };
}

export async function GET(req: Request) {
  const gate = await requireRole(req, ["coordinador"]);
  if (gate.error) return gate.error;

  const { searchParams } = new URL(req.url);
  const group = parseReportGroup(searchParams.get("group"));
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") ?? "json";
  const loaded = await loadVisits();
  const visits = loaded.visits.filter((visit) => inReportRange(visit.createdAt, from, to));
  const rows = buildReportRows(visits, group, loaded.names);

  if (format === "csv") {
    return new NextResponse(reportToCsv(group, rows, visits, loaded.names), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reporte-${group}.csv"`,
      },
    });
  }

  if (format === "pdf") {
    return new NextResponse(Buffer.from(reportToPdf(group, rows, from, to)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reporte-${group}.pdf"`,
      },
    });
  }

  return NextResponse.json({ group, from, to, rows, total: visits.length });
}
