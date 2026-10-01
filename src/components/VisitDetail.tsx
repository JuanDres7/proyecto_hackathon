"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SERVICE_CATALOG } from "@/lib/catalog";
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

  if (!visit.ready) {
    return <p className="text-sm text-text-secondary">Cargando visita…</p>;
  }
  if (!visit.visit || !visit.flow) {
    return <p className="text-sm text-text-secondary">No está esta visita.</p>;
  }

  if (visit.visit.checkOutAt) {
    return (
      <Done
        code={visit.visit.serviceNumber}
        checkOutAt={visit.visit.checkOutAt}
        synced={visit.visit.syncStatus === "synced"}
        onBack={() => router.push("/supervisor")}
      />
    );
  }

  const { flow } = visit;
  const beforePhoto = visit.photos.find((photo) => (photo.caption ?? "").startsWith("antes"));
  const afterPhoto = visit.photos.find((photo) => (photo.caption ?? "").startsWith("despues"));
  const noveltyPhoto = visit.photos.find((photo) => photo.caption === "novedad");

  return (
    <div className="mx-auto max-w-md space-y-4 pb-4">
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
      <p className="text-xs text-text-muted">Paso {flow.phase} de 4</p>
      {flow.phase === 1 ? <Network online={online} /> : null}

      {flow.phase === 1 ? (
        <section className="space-y-3 rounded-xl border border-border-subtle bg-surface-container-low p-4">
          <p className="font-mono text-2xl font-semibold text-text-primary">
            {visit.visit.serviceNumber || "Sin código"}
          </p>
          <Field label="Centro de costo" value={flow.costCenter} />
          <Field label="Dirección" value={flow.address} />
          <Field label="Tipo de servicio" value={serviceTypeLabel(flow)} />
          {flow.serviceIds.length === 0 ? (
            <div className="space-y-2">
              {SERVICE_CATALOG.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => void visit.chooseService(service.id)}
                  className="min-h-11 w-full rounded-lg border border-border-subtle px-3 py-2 text-sm"
                >
                  {service.label}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void visit.goToPhase(2)}
            className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
          >
            Continuar
          </button>
        </section>
      ) : null}

      {flow.phase === 2 ? (
        <section className="space-y-3 rounded-xl border border-border-subtle bg-surface-container-low p-4">
          {!visit.visit.checkInAt ? (
            <button
              type="button"
              disabled={visit.busy}
              onClick={() => void visit.startVisit()}
              className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary disabled:opacity-60"
            >
              Iniciar visita
            </button>
          ) : (
            <p className="text-sm text-text-secondary">
              Llegada {formatWhen(visit.visit.checkInAt)}
            </p>
          )}
          {visit.visit.checkInAt ? (
            <>
              <p className="text-sm text-text-primary">
                Adjunta la foto de {SUBJECT_COPY[flow.beforeSubject]}.
              </p>
              <PhotoButton
                label={beforePhoto ? "Cambiar foto" : "Adjuntar foto"}
                onFile={(file) => void visit.addPhoto(file, "antes")}
              />
              {beforePhoto ? <PhotoThumb photo={beforePhoto} /> : null}
              <button
                type="button"
                onClick={() => void visit.goToPhase(3)}
                className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
              >
                Continuar
              </button>
            </>
          ) : null}
        </section>
      ) : null}

      {flow.phase === 3 ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-surface-container-low p-4">
          <ActivityList
            activities={flow.activities}
            onToggle={(id, done) => {
              visit.updateActivity(id, { done });
              void visit.persistFlow();
            }}
          />
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
          <NovedadFields
            text={visit.novedad}
            priority={visit.priority}
            photo={noveltyPhoto}
            onText={visit.setNovedad}
            onSave={(text, nextPriority) => void visit.saveNovedad(text, nextPriority)}
            onPhoto={(file) => void visit.addPhoto(file, "novedad")}
          />
          <button
            type="button"
            onClick={() => void visit.goToPhase(4)}
            className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
          >
            Continuar
          </button>
        </section>
      ) : null}

      {flow.phase === 4 ? (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-surface-container-low p-4">
          <ActivityList
            activities={flow.activities}
            showJustification
            onToggle={(id, done) => {
              visit.updateActivity(id, { done });
              void visit.persistFlow();
            }}
            onJustification={(id, justification) => visit.updateActivity(id, { justification })}
            onJustificationBlur={() => void visit.persistFlow()}
          />
          <p className="text-sm text-text-primary">Adjunta la foto de después.</p>
          <PhotoButton
            label={afterPhoto ? "Cambiar foto" : "Adjuntar foto"}
            onFile={(file) => void visit.addPhoto(file, "despues")}
          />
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

function Network({ online }: { online: boolean }) {
  return (
    <p className="flex items-center gap-2 text-sm text-text-secondary">
      <span
        className={`h-2.5 w-2.5 rounded-full ${online ? "bg-status-online" : "bg-status-warning"}`}
      />
      {online ? "En línea" : "Modo offline"}
    </p>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="block text-xs text-text-muted">{label}</span>
      <span className="text-text-primary">{value}</span>
    </p>
  );
}

function ActivityList({
  activities,
  showJustification = false,
  onToggle,
  onJustification,
  onJustificationBlur,
}: {
  activities: {
    id: string;
    label: string;
    group: string;
    done: boolean;
    needsJustification: boolean;
    justification: string;
  }[];
  showJustification?: boolean;
  onToggle: (id: string, done: boolean) => void;
  onJustification?: (id: string, justification: string) => void;
  onJustificationBlur?: () => void;
}) {
  const groups = [...new Set(activities.map((activity) => activity.group))];
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group} className="space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">{group}</h3>
          {activities
            .filter((activity) => activity.group === group)
            .map((activity) => (
              <div key={activity.id} className="rounded-lg border border-border-subtle p-3">
                <label className="flex min-h-11 items-center gap-3 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={activity.done}
                    onChange={(event) => onToggle(activity.id, event.target.checked)}
                  />
                  {activity.label}
                </label>
                {showJustification && activity.needsJustification ? (
                  <textarea
                    value={activity.justification}
                    onChange={(event) => onJustification?.(activity.id, event.target.value)}
                    onBlur={onJustificationBlur}
                    rows={2}
                    placeholder="Justificación"
                    className="mt-2 w-full rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-2 text-sm"
                  />
                ) : null}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

function NovedadFields({
  text,
  priority,
  photo,
  onText,
  onSave,
  onPhoto,
}: {
  text: string;
  priority: NovedadPriority;
  photo?: LocalEvidence;
  onText: (value: string) => void;
  onSave: (text: string, priority: NovedadPriority) => void;
  onPhoto: (file: File) => void;
}) {
  const [open, setOpen] = useState(Boolean(text || photo));
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 text-sm font-medium text-primary"
      >
        Registrar novedad
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <label className="block text-sm text-text-secondary">
        Novedad
        <textarea
          value={text}
          onChange={(event) => onText(event.target.value)}
          onBlur={(event) => onSave(event.target.value, priority)}
          rows={3}
          placeholder="Descripción"
          className="mt-1 w-full rounded-lg border border-border-subtle bg-surface-container-lowest px-3 py-2 text-sm text-text-primary"
        />
      </label>
      <div className="flex gap-2">
        {PRIORITIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSave(text, item.id)}
            className={`min-h-11 flex-1 rounded-lg border px-2 py-2 text-sm ${
              priority === item.id
                ? "border-primary text-primary"
                : "border-border-subtle text-text-secondary"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <PhotoButton label={photo ? "Cambiar foto" : "Adjuntar foto"} onFile={onPhoto} />
      {photo ? <PhotoThumb photo={photo} /> : null}
    </div>
  );
}

function PhotoButton({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border-subtle bg-surface-container px-4 py-3 text-sm font-semibold text-text-primary">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      {label}
    </label>
  );
}

function PhotoThumb({ photo }: { photo: LocalEvidence }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo.blob);
    const timer = window.setTimeout(() => setUrl(objectUrl), 0);
    return () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
    };
  }, [photo.blob]);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="Foto adjunta" className="h-28 w-full rounded-lg object-cover" />
  );
}

function Done({
  code,
  checkOutAt,
  synced,
  onBack,
}: {
  code?: string;
  checkOutAt: string;
  synced: boolean;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-md space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">Servicio finalizado</h2>
      {code ? <p className="font-mono text-text-primary">{code}</p> : null}
      <p className="text-sm text-text-secondary">Salida {formatWhen(checkOutAt)}</p>
      <p className="text-sm text-text-secondary">
        {synced ? "Sincronizado." : "Guardado en este dispositivo. Se sincronizará cuando haya red."}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary"
      >
        Volver
      </button>
    </div>
  );
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
