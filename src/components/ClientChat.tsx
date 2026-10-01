"use client";

import { useState } from "react";
import { useClientChat } from "@/hooks/useClientChat";
import {
  CANCEL_LABELS,
  SERVICE_CODES,
  SERVICE_LABELS,
  type CancellationReason,
  type QuoteSlots,
  type ServiceCode,
} from "@/lib/client-chat/types";

const PHASES = [
  { id: "cotizacion", label: "1. Cotización" },
  { id: "progreso", label: "2. Progreso" },
  { id: "finalizacion", label: "3. Finalización" },
] as const;

export function ClientChat() {
  const chat = useClientChat();
  const [slots, setSlots] = useState<QuoteSlots>({
    customerName: "",
    customerDocument: "",
    email: "",
    phone: "",
    openingMessage: "",
    services: [],
    scheduledAt: "",
    location: "",
    accessNotes: "",
  });
  const [lookup, setLookup] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [photo, setPhoto] = useState<string | null>(null);
  const [reason, setReason] = useState<CancellationReason>("data_error");

  function toggleService(code: ServiceCode) {
    setSlots((current) => {
      const has = current.services.includes(code);
      return {
        ...current,
        services: has ? current.services.filter((item) => item !== code) : [...current.services, code],
      };
    });
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-2">
        {PHASES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => chat.setPhase(item.id)}
            className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
              chat.phase === item.id ? "bg-teal-600 text-white" : "bg-white text-slate-700 shadow-sm"
            }`}
          >
            {item.label}
          </button>
        ))}
        {chat.serviceNumber ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
            Código de servicio: <strong>{chat.serviceNumber}</strong>
          </p>
        ) : null}
      </aside>

      <section className="flex min-h-[70vh] flex-col rounded-2xl bg-white shadow-sm">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {chat.messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user" ? "ml-auto bg-teal-600 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {msg.content}
            </div>
          ))}
          {chat.phase === "finalizacion" && chat.activities.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-slate-700">
              {chat.activities.map((activity) => (
                <li key={activity}>{activity}</li>
              ))}
            </ul>
          ) : null}
          {chat.phase === "finalizacion"
            ? chat.photos.map((item) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={item.url} src={item.url} alt={item.label} className="max-h-40 rounded-lg" />
              ))
            : null}
        </div>

        <div className="space-y-3 border-t p-3">
          {chat.phase === "cotizacion" ? (
            <form
              className="grid gap-2 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void chat.send({
                  slots,
                  display: "Envié los datos de la cotización.",
                });
              }}
            >
              <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Nombre" value={slots.customerName} onChange={(e) => setSlots({ ...slots, customerName: e.target.value })} />
              <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Identificación" value={slots.customerDocument} onChange={(e) => setSlots({ ...slots, customerDocument: e.target.value })} />
              <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Email" value={slots.email} onChange={(e) => setSlots({ ...slots, email: e.target.value })} />
              <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Teléfono" value={slots.phone} onChange={(e) => setSlots({ ...slots, phone: e.target.value })} />
              <input className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" placeholder="Mensaje" value={slots.openingMessage} onChange={(e) => setSlots({ ...slots, openingMessage: e.target.value })} />
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {SERVICE_CODES.map((code) => (
                  <label key={code} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={slots.services.includes(code)} onChange={() => toggleService(code)} />
                    {SERVICE_LABELS[code]}
                  </label>
                ))}
              </div>
              <input className="rounded-lg border px-3 py-2 text-sm" type="datetime-local" value={slots.scheduledAt} onChange={(e) => setSlots({ ...slots, scheduledAt: e.target.value })} />
              <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Ubicación" value={slots.location} onChange={(e) => setSlots({ ...slots, location: e.target.value })} />
              <input className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" placeholder="Observaciones de acceso" value={slots.accessNotes} onChange={(e) => setSlots({ ...slots, accessNotes: e.target.value })} />
              <button type="submit" disabled={chat.busy} className="rounded-lg bg-[#0b1f3a] px-4 py-2 text-sm text-white disabled:opacity-50 sm:col-span-2">
                {chat.busy ? "..." : "Continuar"}
              </button>
            </form>
          ) : null}

          {chat.phase === "cotizacion" && chat.awaitingConfirmation ? (
            <div className="flex gap-2">
              <button type="button" disabled={chat.busy} className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white" onClick={() => void chat.send({ confirmation: "yes", display: "Sí" })}>
                Sí
              </button>
              <button type="button" disabled={chat.busy} className="rounded-lg border px-4 py-2 text-sm" onClick={() => void chat.send({ confirmation: "no", display: "No" })}>
                No
              </button>
            </div>
          ) : null}

          {chat.phase === "cotizacion" && chat.canCancel ? (
            <div className="flex gap-2">
              <select className="rounded-lg border px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value as CancellationReason)}>
                {Object.entries(CANCEL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button type="button" disabled={chat.busy} className="rounded-lg border px-4 py-2 text-sm" onClick={() => void chat.send({ cancellationReason: reason, display: "Quiero cancelar" })}>
                Cancelar servicio
              </button>
            </div>
          ) : null}

          {chat.phase === "progreso" ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                chat.setServiceNumber(lookup.trim());
                void chat.send({ serviceNumber: lookup.trim(), message: lookup.trim(), display: lookup.trim() });
              }}
            >
              <input className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Código #3089" value={lookup} onChange={(e) => setLookup(e.target.value)} />
              <button type="submit" disabled={chat.busy} className="rounded-lg bg-[#0b1f3a] px-4 py-2 text-sm text-white disabled:opacity-50">
                Consultar
              </button>
            </form>
          ) : null}

          {chat.phase === "finalizacion" ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void chat.send({
                  rating,
                  message: comment,
                  photoDataUrl: photo,
                  display: `Calificación: ${rating} estrellas`,
                });
              }}
            >
              <div className="flex gap-2">
              <input className="flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="Código #3089" value={lookup} onChange={(e) => setLookup(e.target.value)} />
              <button
                type="button"
                disabled={chat.busy}
                className="rounded-lg border px-4 py-2 text-sm"
                onClick={() => {
                  chat.setServiceNumber(lookup.trim());
                  void chat.send({ serviceNumber: lookup.trim(), display: `Consultar cierre ${lookup.trim()}` });
                }}
              >
                Ver cierre
              </button>
            </div>
            <label className="block text-sm">
                Estrellas
                <input className="ml-2 w-16 rounded border px-2 py-1" type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
              </label>
              <textarea className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Comentario" value={comment} onChange={(e) => setComment(e.target.value)} />
              <input
                type="file"
                accept="image/*"
                className="text-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setPhoto(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
              <button type="submit" disabled={chat.busy} className="rounded-lg bg-[#0b1f3a] px-4 py-2 text-sm text-white disabled:opacity-50">
                Enviar evaluación
              </button>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}
