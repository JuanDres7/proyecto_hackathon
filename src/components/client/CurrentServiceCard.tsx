"use client";

import { useCurrentService } from "./useCurrentService";

export function CurrentServiceCard() {
  const { service, loading, error, refresh } = useCurrentService();

  return (
    <aside className="rounded-xl border border-border-subtle bg-surface-card p-4 lg:sticky lg:top-20">
      <h2 className="text-sm font-semibold text-text-primary">Servicio actual</h2>
      {loading ? <p className="mt-3 text-sm text-text-secondary">Cargando…</p> : null}
      {!loading && error ? (
        <p className="mt-3 text-sm text-status-warning" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && !error && !service ? (
        <p className="mt-3 text-sm text-text-secondary">Aún no tienes un servicio.</p>
      ) : null}
      {service ? (
        <dl className="mt-3 space-y-3 text-sm">
          <Row label="Código" value={service.code} />
          <Row label="Estado" value={service.status} />
          <Row label="Servicios" value={service.services} />
          <Row label="Fecha" value={service.when} />
          <Row label="Ubicación" value={service.location} />
        </dl>
      ) : null}
      <button
        type="button"
        onClick={() => void refresh()}
        className="mt-4 min-h-11 w-full rounded-lg border border-border-subtle px-3 py-2 text-sm font-medium text-text-primary"
      >
        Actualizar
      </button>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}
