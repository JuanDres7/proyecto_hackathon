import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function csvEscape(value: unknown) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const gate = await requireRole(req, ["coordinador"]);
  if (gate.error) return gate.error;

  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group") ?? "supervisor";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format") ?? "json";

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ rows: [], warning: "sin_supabase" });
  }

  let q = admin.from("visits").select("supervisor_id, status, site_name, service_number, cost_center_id, created_at");
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = Object.values(
    (data ?? []).reduce<Record<string, { key: string; total: number; completed: number; novedad: number }>>(
      (acc, v) => {
        const key =
          group === "cost_center"
            ? (v.cost_center_id ?? "sin_cc")
            : group === "period"
              ? String(v.created_at).slice(0, 7)
              : (v.supervisor_id ?? "sin_supervisor");
        acc[key] ??= { key, total: 0, completed: 0, novedad: 0 };
        acc[key].total += 1;
        if (v.status === "completada") acc[key].completed += 1;
        if (v.status === "novedad") acc[key].novedad += 1;
        return acc;
      },
      {},
    ),
  );

  if (format === "csv") {
    const header = "grupo,total,completadas,novedades,cumplimiento_pct";
    const lines = rows.map((r) =>
      [r.key, r.total, r.completed, r.novedad, r.total ? Math.round((r.completed / r.total) * 100) : 0]
        .map(csvEscape)
        .join(","),
    );
    return new NextResponse([header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reporte-${group}.csv"`,
      },
    });
  }

  return NextResponse.json({ rows, formatHint: "csv|json — PDF/Excel vía CSV" });
}
