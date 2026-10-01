"use client";

import { usePqrQueue } from "@/hooks/usePqrQueue";

const VISION_LABEL: Record<string, string> = {
  corresponde: "La foto corresponde al comentario",
  no_corresponde: "La foto no corresponde al comentario",
  sin_foto: "Sin foto",
  sin_texto: "Sin texto que contrastar",
};

export function PqrQueue() {
  const { cases, error } = usePqrQueue();

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Peticiones, quejas y reclamos</h2>
      {error ? <p className="text-sm text-amber-700">{error}</p> : null}
      {cases.length === 0 ? (
        <p className="text-sm text-slate-500">No hay casos de prioridad alta.</p>
      ) : (
        <ul className="space-y-3">
          {cases.map((item) => (
            <li key={item.serviceNumber} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{item.serviceNumber}</p>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  Prioridad alta · {item.rating} estrellas
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
              {item.comment ? <p className="mt-1 text-sm text-slate-500">{item.comment}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                Clase: {item.label === "pending" ? "clasificación pendiente" : item.label}
                {item.confidencePercent != null ? ` · certeza ${item.confidencePercent}%` : ""}
                {" · "}
                {VISION_LABEL[item.vision] ?? item.vision}
              </p>
              {item.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photoUrl} alt="Foto de inconformidad" className="mt-3 max-h-40 rounded-lg" />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
