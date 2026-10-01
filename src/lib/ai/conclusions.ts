const TITLES: Record<string, string> = {
  inasistencia: "Inasistencia",
  calidad: "Calidad",
  conducta: "Conducta",
  facturacion: "Facturación",
  seguridad: "Seguridad",
  general: "General",
  pending: "Clasificación pendiente",
};

export type ConclusionItem = {
  serviceNumber: string;
  label: string | null;
  location: string | null;
};

export type ConclusionGroup = {
  label: string;
  title: string;
  count: number;
  locations: { location: string; count: number }[];
};

export function buildConclusions(items: ConclusionItem[]) {
  const total = items.length;
  if (total === 0) {
    return {
      total: 0,
      groups: [] as ConclusionGroup[],
      summary: "Todavía no hay evaluaciones guardadas.",
    };
  }

  const byLabel = new Map<string, ConclusionItem[]>();
  for (const item of items) {
    const label = item.label && TITLES[item.label] ? item.label : "pending";
    const rows = byLabel.get(label) ?? [];
    rows.push(item);
    byLabel.set(label, rows);
  }

  const groups: ConclusionGroup[] = [...byLabel.entries()]
    .map(([label, rows]) => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const place = row.location?.trim() || "Sin ubicación registrada";
        counts.set(place, (counts.get(place) ?? 0) + 1);
      }
      const locations = [...counts.entries()]
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count || a.location.localeCompare(b.location, "es"));
      return {
        label,
        title: TITLES[label] ?? "Clasificación pendiente",
        count: rows.length,
        locations,
      };
    })
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "es"));

  const detail = groups
    .map((group) => {
      const noun = group.count === 1 ? "evaluación" : "evaluaciones";
      const places = group.locations.map((place) => `${place.location}: ${place.count}`).join(", ");
      return `${group.title}: ${group.count} ${noun} (${places})`;
    })
    .join(". ");

  const head = total === 1 ? "Hay 1 evaluación guardada" : `Hay ${total} evaluaciones guardadas`;
  return { total, groups, summary: `${head}. ${detail}.` };
}
