import { memory } from "@/lib/memory-store";
import { buildSimplePdf } from "@/lib/pdf";

export type ReportGroup = "supervisor" | "cost_center" | "period";

export type ReportVisit = {
  supervisorId: string | null;
  status: string;
  siteName: string;
  serviceNumber: string | null;
  costCenter: string | null;
  createdAt: string;
};

export type ReportRow = {
  key: string;
  label: string;
  total: number;
  completed: number;
  novedad: number;
  compliancePct: number;
};

const GROUPS = new Set<ReportGroup>(["supervisor", "cost_center", "period"]);

export function parseReportGroup(value: string | null): ReportGroup {
  return GROUPS.has(value as ReportGroup) ? (value as ReportGroup) : "supervisor";
}

export function inReportRange(iso: string, from?: string | null, to?: string | null) {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function visitsFromMemory(): ReportVisit[] {
  return memory.visits.all().map((visit) => {
    const order = visit.service_number ? memory.orders.byNumber(visit.service_number) : undefined;
    return {
      supervisorId: visit.supervisor_id ?? order?.supervisorId ?? null,
      status: visit.status,
      siteName: visit.site_name,
      serviceNumber: visit.service_number ?? null,
      costCenter: order?.customerName?.trim() || visit.site_name,
      createdAt: visit.created_at,
    };
  });
}

export function buildReportRows(
  visits: ReportVisit[],
  group: ReportGroup,
  names: Record<string, string> = {},
): ReportRow[] {
  const buckets = new Map<string, ReportRow>();
  for (const visit of visits) {
    const key =
      group === "cost_center"
        ? visit.costCenter?.trim() || "sin_centro"
        : group === "period"
          ? visit.createdAt.slice(0, 7) || "sin_periodo"
          : visit.supervisorId || "sin_supervisor";
    const current = buckets.get(key) ?? {
      key,
      label: labelFor(group, key, names),
      total: 0,
      completed: 0,
      novedad: 0,
      compliancePct: 0,
    };
    current.total += 1;
    if (visit.status === "completada") current.completed += 1;
    if (visit.status === "novedad") current.novedad += 1;
    current.compliancePct = current.total ? Math.round((current.completed / current.total) * 100) : 0;
    buckets.set(key, current);
  }
  return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

function labelFor(group: ReportGroup, key: string, names: Record<string, string>) {
  if (group === "supervisor") {
    if (key === "sin_supervisor") return "Sin supervisor";
    return names[key] || "Supervisor";
  }
  if (group === "cost_center") return key === "sin_centro" ? "Sin centro de costo" : key;
  return key === "sin_periodo" ? "Sin período" : key;
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function reportToCsv(group: ReportGroup, rows: ReportRow[], visits: ReportVisit[], names: Record<string, string>) {
  const summary = [
    "grupo,total,completadas,novedades,cumplimiento_pct",
    ...rows.map((row) =>
      [row.label, row.total, row.completed, row.novedad, row.compliancePct].map(csvEscape).join(","),
    ),
  ];
  const detail = [
    "",
    "codigo,supervisor,centro_de_costo,sitio,estado,fecha",
    ...visits.map((visit) =>
      [
        visit.serviceNumber ?? "",
        visit.supervisorId ? names[visit.supervisorId] || "Supervisor" : "Sin supervisor",
        visit.costCenter ?? "",
        visit.siteName,
        visit.status,
        visit.createdAt.slice(0, 10),
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  return `\uFEFF${[...summary, ...detail].join("\n")}\n`;
}

export function reportToPdf(group: ReportGroup, rows: ReportRow[], from?: string | null, to?: string | null) {
  const title =
    group === "cost_center" ? "Por centro de costo" : group === "period" ? "Por mes" : "Por supervisor";
  const lines = [
    `Período: ${from || "inicio"} a ${to || "hoy"}`,
    `Generado: ${new Date().toLocaleString("es-CO")}`,
    "",
    ...rows.map(
      (row) =>
        `${row.label}: ${row.total} visitas, ${row.completed} completadas, ${row.novedad} novedades, ${row.compliancePct}%`,
    ),
  ];
  if (rows.length === 0) lines.push("No hay visitas en este período.");
  return buildSimplePdf(`Reporte LimpiApp · ${title}`, lines);
}
