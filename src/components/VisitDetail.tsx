"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, enqueueOutbox } from "@/lib/db";
import { getCurrentPosition } from "@/lib/geo";
import { persistVisit } from "@/lib/sync";
import type { LocalEvidence, LocalVisit } from "@/lib/types";

export function VisitDetail({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [visit, setVisit] = useState<LocalVisit | null>(null);
  const [photos, setPhotos] = useState<LocalEvidence[]>([]);
  const [novedad, setNovedad] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const row = (await db.visits.get(visitId)) ?? null;
    setVisit(row);
    setNovedad(row?.novedad ?? "");
    setNotes(row?.notes ?? "");
    setPhotos(await db.evidence.where("visitId").equals(visitId).toArray());
  }

  useEffect(() => {
    let cancelled = false;
    void db.visits.get(visitId).then((row) => {
      if (cancelled) return;
      setVisit(row ?? null);
      setNovedad(row?.novedad ?? "");
      setNotes(row?.notes ?? "");
    });
    void db.evidence.where("visitId").equals(visitId).toArray().then((items) => {
      if (!cancelled) setPhotos(items);
    });
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  async function save(patch: Partial<LocalVisit>) {
    if (!visit) return;
    const next = {
      ...visit,
      ...patch,
      updatedAt: new Date().toISOString(),
      syncStatus: "pending" as const,
    };
    await persistVisit(next);
    setVisit(next);
  }

  async function check(kind: "in" | "out") {
    setError("");
    try {
      const geo = await getCurrentPosition();
      if (kind === "in") {
        await save({
          status: "en_curso",
          checkInAt: new Date().toISOString(),
          checkInLat: geo.lat,
          checkInLng: geo.lng,
        });
      } else {
        await save({
          status: visit?.novedad ? "novedad" : "completada",
          checkOutAt: new Date().toISOString(),
          checkOutLat: geo.lat,
          checkOutLng: geo.lng,
        });
      }
    } catch {
      setError("No se pudo leer GPS. Activa ubicación o reintenta.");
    }
  }

  async function onPhoto(file: File) {
    const evidence: LocalEvidence = {
      id: crypto.randomUUID(),
      visitId,
      blob: file,
      mimeType: file.type || "image/jpeg",
      caption: "Evidencia de campo",
      syncStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    await db.evidence.put(evidence);
    await enqueueOutbox("evidence", { id: evidence.id });
    await load();
  }

  if (!visit) {
    return <p className="text-sm text-slate-500">Cargando visita...</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <button
        type="button"
        className="text-sm text-teal-700"
        onClick={() => router.push("/supervisor")}
      >
        ← Visitas
      </button>
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">{visit.siteName}</h2>
        <p className="text-sm text-slate-500">{visit.contractedActivity}</p>
        <p className="mt-2 text-xs text-slate-400">
          Check-in: {visit.checkInAt ? new Date(visit.checkInAt).toLocaleString() : "—"}
          {visit.checkInLat != null
            ? ` (${visit.checkInLat.toFixed(5)}, ${visit.checkInLng?.toFixed(5)})`
            : ""}
        </p>
        <p className="text-xs text-slate-400">
          Check-out: {visit.checkOutAt ? new Date(visit.checkOutAt).toLocaleString() : "—"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void check("in")}
            className="rounded-lg bg-teal-600 py-2 text-sm font-medium text-white"
          >
            Check-in GPS
          </button>
          <button
            type="button"
            onClick={() => void check("out")}
            className="rounded-lg bg-[#0b1f3a] py-2 text-sm font-medium text-white"
          >
            Check-out GPS
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-amber-700">{error}</p> : null}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Evidencia fotográfica</h3>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-2 text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPhoto(file);
          }}
        />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <PhotoThumb key={photo.id} blob={photo.blob} />
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Notas y novedades</h3>
        <textarea
          className="w-full rounded-lg border p-2 text-sm"
          rows={3}
          placeholder="Observaciones de la actividad contratada"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border p-2 text-sm"
          rows={3}
          placeholder="Novedad / hallazgo"
          value={novedad}
          onChange={(e) => setNovedad(e.target.value)}
        />
        <button
          type="button"
          className="w-full rounded-lg bg-amber-500 py-2 text-sm font-medium text-white"
          onClick={() =>
            void save({
              notes,
              novedad,
              status: novedad.trim() ? "novedad" : visit.status,
            })
          }
        >
          Guardar (offline)
        </button>
      </section>
    </div>
  );
}

function PhotoThumb({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const next = URL.createObjectURL(blob);
    const timer = window.setTimeout(() => setUrl(next), 0);
    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(next);
    };
  }, [blob]);
  if (!url) return <div className="aspect-square rounded-lg bg-slate-200" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Evidencia" className="aspect-square rounded-lg object-cover" />
  );
}
