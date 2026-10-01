"use client";

import { useEffect, useState } from "react";

type Group = {
  label: string;
  title: string;
  count: number;
  locations: { location: string; count: number }[];
};

type Conclusions = {
  total: number;
  summary: string;
  groups: Group[];
};

export function PqrInsights() {
  const [data, setData] = useState<Conclusions | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      void fetch("/api/evaluations")
        .then((res) => res.json())
        .then((json: Conclusions) => {
          if (!cancelled) setData(json);
        })
        .catch(() => {
          if (!cancelled) {
            setData({
              total: 0,
              summary: "No se pudieron leer las evaluaciones guardadas.",
              groups: [],
            });
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-6 bg-surface-container-low rounded-xl p-5 border border-border-subtle space-y-3">
      <h2 className="text-sm font-semibold">Conclusiones</h2>
      <p className="text-xs text-text-secondary">
        Clases guardadas en las evaluaciones, con la ubicación de la solicitud cuando existe.
      </p>
      <p className="text-xs">{data?.summary ?? "Cargando conclusiones…"}</p>
      {data?.groups.map((group) => (
        <div key={group.label} className="text-xs border border-border-subtle rounded-lg p-3 space-y-1">
          <p className="font-medium">
            {group.title}: {group.count}
          </p>
          {group.locations.map((place) => (
            <p key={place.location} className="text-text-secondary">
              {place.location}: {place.count}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}
