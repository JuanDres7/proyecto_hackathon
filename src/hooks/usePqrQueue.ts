"use client";

import { useEffect, useState } from "react";

export type PqrItem = {
  serviceNumber: string;
  priority: string;
  rating: number;
  comment: string;
  photoUrl: string | null;
  label: string;
  confidencePercent: number | null;
  vision: string;
  summary: string;
  openedAt: string;
};

export function usePqrQueue() {
  const [cases, setCases] = useState<PqrItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/pqr")
      .then(async (res) => {
        const data = (await res.json()) as { cases?: PqrItem[]; reply?: string };
        if (!active) return;
        if (!res.ok) setError(data.reply ?? "No se pudo leer la cola.");
        setCases(data.cases ?? []);
      })
      .catch(() => {
        if (active) setError("No se pudo leer la cola.");
      });
    return () => {
      active = false;
    };
  }, []);

  return { cases, error };
}
