"use client";

import { useRouter } from "next/navigation";
import type { LocalEvidence, NovedadPriority } from "@/lib/types";
import { useOnlineStatus } from "./supervisor/useOnlineStatus";
import { useSupervisorVisit } from "./supervisor/useSupervisorVisit";
import { SUBJECT_COPY, serviceTypeLabel } from "./supervisor/visit-flow";

const PRIORITIES: { id: NovedadPriority; label: string }[] = [
  { id: "baja", label: "Baja" },
  { id: "media", label: "Media" },
  { id: "alta", label: "Alta" },
];

export function VisitDetail({ visitId }: { visitId: string }) {
  const router = useRouter();
  const online = useOnlineStatus();
  const visit = useSupervisorVisit(visitId);

  if (!visit.ready) return <p className="text-sm text-text-secondary">Cargando visita…</p>;
  if (!visit.visit || !visit.flow) return <p className="text-sm text-text-secondary">No está esta visita.</p>;

  if (visit.visit.checkOutAt) {
    return (
      <section className="mx-auto max-w-md space-y-3 rounded-xl border border-border-subtle bg-surface-container-low p-4">
        <p className="font-mono text-2xl font-semibold text-text-primary">{visit.visit.serviceNumber}</p>
        <p className="text-sm text-text-secondary">Servicio finalizado a las {formatWhen(visit.visit.checkOutAt)}.</p>
        <button type="button" className="min-h-11 text-sm font-medium text-primary" onClick={() => router.push("/supervisor")}>
          Volver
        </button>
      </section>
    );
  }

  const { flow } = visit;
  const beforePhoto = visit.photos.find((photo) => (photo.caption ?? "").startsWith("antes"));
  const afterPhoto = visit.photos.find((photo) => (photo.caption ?? "").startsWith("despues"));
  const noveltyPhoto = visit.photos.find((photo) => photo.caption === "novedad");

  return (
    <div className="mx-auto max-w-md space-y-4 pb-8">
      <button
        type="button"
        className="min-h-11 text-sm font-medium text-primary"
        onClick={() => {
          if (flow.phase <= 1) router.push("/supervisor");
          else void visit.goToPhase((flow.phase - 1) as 1 | 2 | 3 | 4);
        }}
      >
        Volver
      </button>
      <p className="flex items-center gap-2 text-sm text-text-secondary">
        <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-status-online" : "bg-status-warning"}`} />
        {online ? "En línea" : "Sin conexión. Lo registrado se envía al volver la señal."}
        <span className="ml-auto text-xs text-text-muted">Paso {flow.phase} de 4</span>
      </p>

      {flow.phase === 1 ? (
        <section className="space-y-3 rounded-xl border border-border-subtle bg-surface-container-low p-4">
          <p className="font-mono text-2xl font-semibold text-text-primary">{visit.visit.serviceNumber}</p>
          <Field label="Centro de costo" value={flow.costCenter} />
          <Field label="Dirección" value={flow.address} />
          <Field label="Tipo de servicio" value={serviceTypeLabel(flow)} />
          <ul className="space-y-1 text-sm text-text-secondary">
            {flow.activities.map((activity) => (
              <li key={activity.id}>{activity.label}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void visit.goToPhase(2)}
            className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
          >
            Continuar al check-in
          </button>
        </section>
      ) : null}

      {flow.phase === 2 ? (
        <section className="space-y-3 rounded-xl border border-border-subtle bg-surface-container-low p-4">
          <p className="font-mono text-2xl font-semibold text-text-primary">{visit.visit.serviceNumber}</p>
          {!visit.visit.checkInAt ? (
            <>
              <p className="text-sm text-text-secondary">
                Al iniciar, el sistema guarda la hora y la ubicación. No las escribas a mano.
              </p>
              <button
                type="button"
                disabled={visit.busy}
                onClick={() => void visit.startVisit()}
                className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-60"
              >
                Iniciar visita
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-text-secondary">Llegada {formatWhen(visit.visit.checkInAt)}</p>
              <p className="text-sm text-text-primary">Foto del antes: {SUBJECT_COPY[flow.beforeSubject]}.</p>
              <PhotoButton label={beforePhoto ? "Cambiar foto" : "Adjuntar foto"} onFile={(file) => void visit.addPhoto(file, "antes")} />
              {beforePhoto ? <PhotoThumb photo={beforePhoto} /> : null}
              <button
                type="button"
                onClick={() => void visit.goToPhase(3)}
                className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
              >
                Continuar
              </button>
            </>
          )}
        </section>
      ) : null}

      {flow.phase === 3 ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-surface-container-low p-4">
          {groupsOf(flow.activities).map((group) => (
            <div key={group} className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary">{group}</h3>
              {flow.activities
                .filter((activity) => activity.group === group)
                .map((activity) => (
                  <label key={activity.id} className="flex min-h-11 items-center gap-2 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={activity.done}
                      onChange={(event) => {
                        visit.updateActivity(activity.id, { done: event.target.checked });
                        void visit.persistFlow();
                      }}
                    />
                    {activity.label}
                  </label>
                ))}
            </div>
          ))}
          <label className="block text-sm text-text-secondary">
            Observaciones del cliente
            <textarea
              value={flow.clientNotes}
              onChange={(event) => visit.updateClientNotes(event.target.value)}
              onBlur={() => void visit.persistFlow()}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="block text-sm text-text-secondary">
            Novedad, si aplica
            <textarea
              value={visit.novedad}
              onChange={(event) => visit.setNovedad(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <div className="flex gap-2">
            {PRIORITIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => visit.setPriority(item.id)}
                className={`min-h-11 flex-1 rounded-lg border px-2 text-sm ${
                  visit.priority === item.id ? "border-primary text-primary" : "border-border-subtle text-text-secondary"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <PhotoButton label={noveltyPhoto ? "Cambiar foto de la novedad" : "Foto de la novedad"} onFile={(file) => void visit.addPhoto(file, "novedad")} />
          <button
            type="button"
            onClick={() => {
              void visit.saveNovedad(visit.novedad, visit.priority);
              void visit.goToPhase(4);
            }}
            className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
          >
            Continuar al cierre
          </button>
        </section>
      ) : null}

      {flow.phase === 4 ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-surface-container-low p-4">
          <p className="text-sm text-text-secondary">
            Si quedó alguna tarea pendiente, márcala y escribe por qué. La hora de salida la registra el sistema.
          </p>
          {flow.activities.map((activity) => (
            <div key={activity.id} className="space-y-1">
              <label className="flex min-h-11 items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={activity.done}
                  onChange={(event) => {
                    visit.updateActivity(activity.id, { done: event.target.checked });
                    void visit.persistFlow();
                  }}
                />
                {activity.label}
              </label>
              {!activity.done ? (
                <input
                  value={activity.justification}
                  onChange={(event) => visit.updateActivity(activity.id, { justification: event.target.value })}
                  onBlur={() => void visit.persistFlow()}
                  placeholder="Justificación"
                  className="w-full rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-2 text-sm text-text-primary"
                />
              ) : null}
            </div>
          ))}
          <p className="text-sm text-text-primary">Foto del después.</p>
          <PhotoButton label={afterPhoto ? "Cambiar foto" : "Adjuntar foto"} onFile={(file) => void visit.addPhoto(file, "despues")} />
          {afterPhoto ? <PhotoThumb photo={afterPhoto} /> : null}
          <button
            type="button"
            disabled={visit.busy}
            onClick={() => void visit.finishVisit()}
            className="min-h-12 w-full rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-on-secondary disabled:opacity-60"
          >
            Finalizar servicio
          </button>
        </section>
      ) : null}

      {visit.error ? (
        <p className="text-sm text-status-warning" role="alert">
          {visit.error}
        </p>
      ) : null}
    </div>
  );
}

function groupsOf(activities: { group: string }[]) {
  return [...new Set(activities.map((activity) => activity.group))];
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="block text-xs text-text-muted">{label}</span>
      <span className="text-text-primary">{value}</span>
    </p>
  );
}

function PhotoButton({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-primary">
      {label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

function PhotoThumb({ photo }: { photo: LocalEvidence }) {
  const url = URL.createObjectURL(photo.blob);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-32 w-full rounded-lg object-cover" />
  );
}

function formatWhen(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}
