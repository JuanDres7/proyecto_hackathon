"use client";

import { useEffect, useState } from "react";
import { CANCELLATION_REASONS, SERVICE_CATALOG, serviceLabels } from "@/lib/catalog";
import { useAuth } from "@/lib/auth-context";
import { requiredQuoteFields } from "@/lib/quote-fields";
import type { ChatMessage, QuoteDraft } from "@/lib/types";

type Situation = "cotizacion" | "progreso" | "finalizacion";

type Picture = {
  situation: Situation;
  opening: string;
  focus: {
    serviceNumber: string;
    status: string;
    message: string;
    evaluated: boolean;
    enRoute: boolean;
    visit?: { contractedActivity?: string | null } | null;
  } | null;
};

function emptyDraft(): QuoteDraft {
  return {
    draftId: crypto.randomUUID(),
    services: [],
    status: "draft",
  };
}

function formatWhen(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-CO");
  } catch {
    return iso;
  }
}

export function ClientChat() {
  const { user } = useAuth();
  const [situation, setSituation] = useState<Situation>("cotizacion");
  const [draft, setDraft] = useState<QuoteDraft>(emptyDraft);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [evalDone, setEvalDone] = useState(false);
  const [closure, setClosure] = useState<{ activities: string; photosNote: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [draftLockedByRoute, setDraftLockedByRoute] = useState(false);
  const [assistantDownNoted, setAssistantDownNoted] = useState(false);

  function push(role: ChatMessage["role"], content: string) {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role, content, createdAt: nowStamp() },
    ]);
  }

  function applyPicture(picture: Picture) {
    setSituation(picture.situation);
    const focus = picture.focus;
    setDraftLockedByRoute(Boolean(focus?.enRoute));
    setEvalDone(Boolean(focus?.evaluated));
    if (focus?.serviceNumber) {
      setDraft((current) => ({
        ...current,
        serviceNumber: focus.serviceNumber,
        status: "confirmed",
      }));
    }
    if (focus?.status === "finalizado") {
      setClosure({
        activities: focus.visit?.contractedActivity || "Actividades registradas en la visita.",
        photosNote: "Fotos de antes y después: las que existan en evidencias de la visita sincronizada.",
      });
    }
  }

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => {
      setDraft((current) => ({
        ...current,
        email: user.email,
        customerName: current.customerName || user.fullName,
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await fetch("/api/gemini", { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setMessages([
            {
              id: "init",
              role: "assistant",
              content: "No pude leer tus servicios.",
              createdAt: nowStamp(),
            },
          ]);
          return;
        }
        const picture = (await res.json()) as Picture;
        if (cancelled) return;
        applyPicture(picture);
        setMessages([
          {
            id: "init",
            role: "assistant",
            content: picture.opening,
            createdAt: nowStamp(),
          },
        ]);
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  function patchDraft(p: Partial<QuoteDraft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function toggleService(id: string) {
    setDraft((d) => ({
      ...d,
      services: d.services.includes(id) ? d.services.filter((x) => x !== id) : [...d.services, id],
    }));
  }

  async function refreshPicture() {
    const res = await fetch("/api/gemini", { credentials: "include" });
    if (!res.ok) return;
    applyPicture((await res.json()) as Picture);
  }

  async function askSummary() {
    const missing = requiredQuoteFields(draft);
    if (missing.length) {
      push("assistant", `Faltan datos obligatorios: ${missing.join(", ")}. No se emite código hasta completarlos.`);
      setAwaitingConfirm(false);
      return;
    }
    setAwaitingConfirm(true);
    await fetch("/api/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", draft: { ...draft, status: "pending_confirmation" } }),
    });
    push(
      "assistant",
      `Resumen:\n• Nombre: ${draft.customerName}\n• Identificación: ${draft.customerDocument}\n• Correo: ${draft.email}\n• Teléfono: ${draft.phone}\n• Mensaje: ${draft.openingMessage}\n• Servicios: ${serviceLabels(draft.services)}\n• Fecha y hora: ${formatWhen(draft.scheduledAt)}\n• Ubicación: ${draft.location}\n• Acceso: ${draft.accessNotes || "sin observaciones"}\n\n¿Confirmas? Responde sí o no.`,
    );
  }

  async function confirmYes() {
    const res = await fetch("/api/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", draft }),
    });
    const json = (await res.json()) as { ok: boolean; serviceNumber?: string; missing?: string[] };
    if (!json.ok) {
      push("assistant", `No se puede confirmar. Faltan: ${(json.missing ?? []).join(", ")}.`);
      return;
    }
    setDraft((d) => ({ ...d, serviceNumber: json.serviceNumber, status: "confirmed" }));
    setAwaitingConfirm(false);
    push(
      "assistant",
      `Solicitud confirmada. Tu código es ${json.serviceNumber}. El supervisor verá Servicio ${json.serviceNumber}. Confirmar de nuevo no emite otro código.`,
    );
    await refreshPicture();
  }

  async function confirmNo() {
    setAwaitingConfirm(false);
    await fetch("/api/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", draft }),
    });
    push("assistant", "No se emitió código. Corrige los datos y vuelve a pedir el resumen.");
  }

  function noteAssistantDown(available: boolean) {
    if (available || assistantDownNoted) return;
    setAssistantDownNoted(true);
    push("assistant", "El asistente no está disponible. Puedes seguir con el formulario.");
  }

  function applyExtracted(extracted: Partial<QuoteDraft>) {
    if (draftLockedByRoute) return;
    setDraft((d) => ({
      ...d,
      customerName: extracted.customerName || d.customerName,
      customerDocument: extracted.customerDocument || d.customerDocument,
      email: user?.email || d.email,
      phone: extracted.phone || d.phone,
      openingMessage: d.openingMessage || extracted.openingMessage,
      services: extracted.services?.length ? [...new Set([...d.services, ...extracted.services])] : d.services,
      scheduledAt: extracted.scheduledAt || d.scheduledAt,
      location: extracted.location || d.location,
      accessNotes: extracted.accessNotes || d.accessNotes,
    }));
  }

  function capturedLabels(before: QuoteDraft, extracted: Partial<QuoteDraft>) {
    const labels: string[] = [];
    if (extracted.customerName && extracted.customerName !== before.customerName) labels.push("nombre");
    if (extracted.customerDocument && extracted.customerDocument !== before.customerDocument) {
      labels.push("identificación");
    }
    if (extracted.phone && extracted.phone !== before.phone) labels.push("teléfono");
    if (extracted.openingMessage && !before.openingMessage) labels.push("mensaje");
    if (extracted.services?.some((id) => !before.services.includes(id))) labels.push("servicios");
    if (extracted.scheduledAt && extracted.scheduledAt !== before.scheduledAt) labels.push("fecha y hora");
    if (extracted.location && extracted.location !== before.location) labels.push("ubicación");
    if (extracted.accessNotes && extracted.accessNotes !== before.accessNotes) labels.push("acceso");
    return labels;
  }

  async function converse(text: string) {
    const history = messages
      .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch("/api/gemini", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history, draft }),
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      available: boolean;
      reply: string | null;
      extracted?: Partial<QuoteDraft>;
      editLocked?: boolean;
      situation?: Situation;
      progress?: {
        status: string;
        message: string;
        serviceNumber: string;
        visit?: { contractedActivity?: string | null; checkOutAt?: string | null } | null;
      } | null;
    };
  }

  async function sendText() {
    if (!input.trim()) return;
    const text = input.trim();
    push("user", text);
    setInput("");
    const token = text.toLowerCase().replace(/[.!¡¿?]/g, "").trim();
    if (situation === "cotizacion" && awaitingConfirm) {
      if (token === "si" || token === "sí" || token === "yes") {
        await confirmYes();
        return;
      }
      if (token === "no") {
        await confirmNo();
        return;
      }
    }
    setBusy(true);
    try {
      const json = await converse(text);
      if (!json) {
        noteAssistantDown(false);
        return;
      }
      if (json.situation) setSituation(json.situation);
      if (json.editLocked) setDraftLockedByRoute(true);
      const labels = json.editLocked || json.situation !== "cotizacion" ? [] : capturedLabels(draft, json.extracted ?? {});
      if (!json.editLocked && json.situation === "cotizacion") applyExtracted(json.extracted ?? {});
      if (json.progress && json.progress.status !== "sin_servicio_activo") {
        patchDraft({ serviceNumber: json.progress.serviceNumber });
        if (json.progress.status === "finalizado") {
          setClosure({
            activities: json.progress.visit?.contractedActivity || "Actividades registradas en la visita.",
            photosNote: "Fotos de antes y después: las que existan en evidencias de la visita sincronizada.",
          });
        }
      }
      noteAssistantDown(json.available);
      if (json.reply) {
        push("assistant", json.reply);
        return;
      }
      if (labels.length) push("assistant", `Anoté en el formulario: ${labels.join(", ")}.`);
    } catch {
      noteAssistantDown(false);
    } finally {
      setBusy(false);
    }
  }

  async function sendEval() {
    if (!draft.serviceNumber) {
      push("assistant", "No hay un servicio finalizado para evaluar.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceNumber: draft.serviceNumber,
          rating: stars,
          comment,
          image,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; pqr?: boolean };
      if (json.error === "ya_enviada") {
        push("assistant", "La evaluación de este código ya fue enviada. Se conserva la primera.");
        setEvalDone(true);
        return;
      }
      if (!json.ok) {
        push("assistant", "No se pudo guardar la evaluación.");
        return;
      }
      setEvalDone(true);
      push(
        "assistant",
        json.pqr
          ? "Evaluación guardada. Se abrió un caso de prioridad alta en la cola de peticiones, quejas y reclamos."
          : "Evaluación guardada. No se abre caso PQR con 3, 4 o 5 estrellas.",
      );
      await refreshPicture();
    } finally {
      setBusy(false);
      setImage(undefined);
    }
  }

  async function doCancel() {
    if (!cancelReason) {
      push("assistant", "Cancelar sin motivo no deja la solicitud cancelada. Elige un motivo.");
      return;
    }
    const res = await fetch("/api/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", draft, reason: cancelReason }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (json.error === "en_ruta") {
      push("assistant", "El supervisor ya está en ruta. No se puede editar ni cancelar.");
      setDraftLockedByRoute(true);
      return;
    }
    if (json.ok) {
      setDraft((d) => ({ ...d, status: "cancelled", serviceNumber: undefined }));
      push("assistant", "Solicitud cancelada con el motivo indicado.");
      await refreshPicture();
    }
  }

  const canCancel =
    situation === "progreso" && Boolean(draft.serviceNumber) && !draftLockedByRoute && draft.status === "confirmed";

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border-subtle bg-surface-card p-3 shadow-md sm:flex-row sm:items-center sm:p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-border-subtle flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[22px]">smart_toy</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold tracking-tight text-text-primary">Puro</span>
            <p className="text-xs text-text-secondary mt-0.5">
              {draft.serviceNumber ? `Código ${draft.serviceNumber}` : "Sin servicio confirmado"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <section className="flex min-h-[280px] flex-col rounded-xl border border-border-subtle bg-surface-card sm:min-h-[420px]">
          <div className="max-h-[50vh] flex-1 space-y-3 overflow-y-auto p-3 sm:max-h-[520px] sm:p-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`text-xs leading-relaxed ${msg.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`inline-block p-3 rounded-xl whitespace-pre-wrap ${
                    msg.role === "user" ? "bg-surface-muted" : "bg-surface-container-low"
                  }`}
                >
                  {msg.content}
                </div>
                <div className="text-[10px] font-mono text-text-muted mt-1">{msg.createdAt}</div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border-subtle flex gap-2">
            <input
              className="flex-1 bg-transparent px-2 text-xs"
              placeholder="Escribe a Puro"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void sendText();
                }
              }}
            />
            <button
              type="button"
              disabled={busy}
              className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs"
              onClick={() => void sendText()}
            >
              Enviar
            </button>
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          {situation === "cotizacion" && (
            <div className="p-4 bg-surface-card rounded-xl border border-border-subtle space-y-2 text-xs">
              <h3 className="font-semibold text-sm">Datos de la solicitud</h3>
              <input
                className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-2 py-1.5"
                placeholder="Nombre"
                value={draft.customerName ?? ""}
                onChange={(e) => patchDraft({ customerName: e.target.value })}
              />
              <input
                className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-2 py-1.5"
                placeholder="Identificación"
                value={draft.customerDocument ?? ""}
                onChange={(e) => patchDraft({ customerDocument: e.target.value })}
              />
              <input
                className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-2 py-1.5"
                placeholder="Correo"
                value={draft.email ?? ""}
                readOnly
              />
              <input
                className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-2 py-1.5"
                placeholder="Teléfono"
                value={draft.phone ?? ""}
                onChange={(e) => patchDraft({ phone: e.target.value })}
              />
              <textarea
                className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-2 py-1.5"
                placeholder="Mensaje inicial"
                value={draft.openingMessage ?? ""}
                onChange={(e) => patchDraft({ openingMessage: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                {SERVICE_CATALOG.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    className={`px-2 py-1 rounded-lg border ${draft.services.includes(s.id) ? "border-primary text-primary" : "border-border-subtle"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <input
                type="datetime-local"
                className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-2 py-1.5"
                value={draft.scheduledAt ? draft.scheduledAt.slice(0, 16) : ""}
                onChange={(e) =>
                  patchDraft({ scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })
                }
              />
              <input
                className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-2 py-1.5"
                placeholder="Ubicación"
                value={draft.location ?? ""}
                onChange={(e) => patchDraft({ location: e.target.value })}
              />
              <input
                className="w-full rounded-lg bg-surface-container-lowest border border-border-subtle px-2 py-1.5"
                placeholder="Observaciones de acceso (opcional)"
                value={draft.accessNotes ?? ""}
                onChange={(e) => patchDraft({ accessNotes: e.target.value })}
              />
              <button type="button" className="w-full py-2 bg-primary text-on-primary rounded-lg" onClick={() => void askSummary()}>
                Ver resumen y pedir confirmación
              </button>
              {awaitingConfirm && (
                <div className="flex gap-2">
                  <button type="button" className="flex-1 py-2 bg-secondary text-on-secondary rounded-lg" onClick={() => void confirmYes()}>
                    Sí, confirmar
                  </button>
                  <button type="button" className="flex-1 py-2 border border-border-subtle rounded-lg" onClick={() => void confirmNo()}>
                    No
                  </button>
                </div>
              )}
            </div>
          )}

          {situation === "finalizacion" && (
            <div className="p-4 bg-surface-card rounded-xl border border-border-subtle space-y-3 text-xs">
              {closure ? (
                <p>
                  Cierre {draft.serviceNumber}. Actividades: {closure.activities}. {closure.photosNote}
                </p>
              ) : (
                <p>El servicio figura finalizado. La evaluación usa el código de tu cuenta.</p>
              )}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setStars(n)}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: `'FILL' ${n <= stars ? 1 : 0}` }}>
                      star
                    </span>
                  </button>
                ))}
              </div>
              <textarea
                className="w-full rounded-lg border px-2 py-1.5"
                placeholder="Comentario (puede ir vacío)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <label className="block">
                Foto opcional
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setImage(String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {evalDone ? (
                <p>Evaluación registrada.</p>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="w-full py-2 bg-secondary text-on-secondary rounded-lg"
                  onClick={() => void sendEval()}
                >
                  Enviar evaluación
                </button>
              )}
            </div>
          )}

          {canCancel && (
            <div className="p-4 bg-surface-card rounded-xl border border-border-subtle space-y-2 text-xs">
              <p>Puedes cancelar {draft.serviceNumber} mientras el supervisor no esté en ruta. El código se conserva si solo corriges datos antes de salir.</p>
              <button type="button" className="w-full py-2 border rounded-lg" onClick={() => setCancelOpen(true)}>
                Cancelar solicitud
              </button>
              {cancelOpen && (
                <div className="space-y-2">
                  {CANCELLATION_REASONS.map((r) => (
                    <label key={r.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="reason"
                        value={r.id}
                        checked={cancelReason === r.id}
                        onChange={() => setCancelReason(r.id)}
                      />
                      {r.label}
                    </label>
                  ))}
                  <button type="button" className="w-full py-2 bg-error-container rounded-lg" onClick={() => void doCancel()}>
                    Confirmar cancelación
                  </button>
                </div>
              )}
            </div>
          )}
          {draftLockedByRoute && <p className="text-xs">El supervisor ya está en ruta. Editar y cancelar no están disponibles.</p>}
        </section>
      </div>
    </div>
  );
}

function nowStamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
