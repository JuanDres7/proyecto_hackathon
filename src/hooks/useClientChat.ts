"use client";

import { useEffect, useState } from "react";
import type { ChatPhase, ChatRequest, ChatResponse, QuoteSlots } from "@/lib/client-chat/types";

export type ChatLine = { id: string; role: "user" | "assistant"; content: string };

const WELCOME =
  "Hola. Puedo ayudarte a cotizar un servicio, consultar su progreso o dejar tu evaluación.";

export function useClientChat() {
  const [phase, setPhase] = useState<ChatPhase>("cotizacion");
  const [draftId, setDraftId] = useState(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    const stored = sessionStorage.getItem("campo.draft");
    if (stored) return stored;
    const created = crypto.randomUUID();
    sessionStorage.setItem("campo.draft", created);
    return created;
  });
  const [serviceNumber, setServiceNumber] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatLine[]>([
    { id: "welcome", role: "assistant", content: WELCOME },
  ]);
  const [canEdit, setCanEdit] = useState(false);
  const [canCancel, setCanCancel] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [activities, setActivities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<{ label: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    sessionStorage.setItem("campo.draft", draftId);
  }, [draftId]);

  async function send(partial: Partial<ChatRequest> & { display?: string }) {
    const display = partial.display ?? partial.message ?? "";
    if (display) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: display }]);
    }
    setBusy(true);
    try {
      const res = await fetch("/api/client-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          serviceNumber,
          phase,
          ...partial,
          display: undefined,
        }),
      });
      const data = (await res.json()) as ChatResponse;
      if (data.draftId) setDraftId(data.draftId);
      if (data.serviceNumber) setServiceNumber(data.serviceNumber);
      if (data.serviceNumber === null && partial.cancellationReason) setServiceNumber(null);
      setCanEdit(Boolean(data.canEdit));
      setCanCancel(Boolean(data.canCancel));
      setAwaitingConfirmation(Boolean(data.awaitingConfirmation));
      setActivities(data.activities ?? []);
      setPhotos(data.photos ?? []);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "No pude completar la conversación.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return {
    phase,
    setPhase,
    draftId,
    serviceNumber,
    messages,
    canEdit,
    canCancel,
    awaitingConfirmation,
    activities,
    photos,
    busy,
    send,
    setServiceNumber,
  };
}

export type { QuoteSlots };
