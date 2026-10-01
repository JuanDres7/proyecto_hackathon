"use client";

import { useMemo, useState } from "react";
import type { ChatMessage, ChatState } from "@/lib/types";

const STATES: { id: ChatState; label: string; hint: string }[] = [
  {
    id: "cotizacion",
    label: "1. Cotización",
    hint: "Describe el servicio. Al confirmar, se simula el pago y se emite un número de servicio.",
  },
  {
    id: "seguimiento",
    label: "2. Seguimiento",
    hint: "Consulta el estado con tu número de servicio (ej. SRV-...).",
  },
  {
    id: "cierre",
    label: "3. Cierre y quejas",
    hint: "Envía retroalimentación o una queja. Puedes adjuntar una foto; Gemini Vision + NLP la validan.",
  },
];

export function ClientChat() {
  const [state, setState] = useState<ChatState>("cotizacion");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "Hola. Puedo cotizar un servicio, dar seguimiento o recibir una queja con evidencia.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [serviceNumber, setServiceNumber] = useState("");

  const hint = useMemo(
    () => STATES.find((s) => s.id === state)?.hint ?? "",
    [state],
  );

  async function send() {
    if (!input.trim() && !image) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      imageDataUrl: image,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const geminiRes = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          image,
          serviceNumber: serviceNumber || undefined,
        }),
      });
      const gemini = (await geminiRes.json()) as {
        reply: string;
        serviceNumber?: string;
      };
      if (gemini.serviceNumber) setServiceNumber(gemini.serviceNumber);

      let extra = "";
      if (state === "cierre" && userMsg.content) {
        const nlpRes = await fetch("/api/nlp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: userMsg.content,
            serviceNumber: gemini.serviceNumber ?? serviceNumber,
          }),
        });
        const nlp = (await nlpRes.json()) as { label?: string; confidence?: number };
        extra = nlp.label
          ? `\n\nClasificación NLP: ${nlp.label} (${Math.round((nlp.confidence ?? 0) * 100)}%).`
          : "";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `${gemini.reply}${extra}`,
          createdAt: new Date().toISOString(),
        },
      ]);
      setImage(undefined);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "No pude contactar el proxy. Revisa Gemini / NLP o usa el modo demo del servidor.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-2">
        {STATES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setState(item.id)}
            className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
              state === item.id
                ? "bg-teal-600 text-white"
                : "bg-white text-slate-700 shadow-sm"
            }`}
          >
            {item.label}
          </button>
        ))}
        {serviceNumber ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
            Número de servicio: <strong>{serviceNumber}</strong>
          </p>
        ) : null}
      </aside>

      <section className="flex min-h-[70vh] flex-col rounded-2xl bg-white shadow-sm">
        <div className="border-b px-4 py-3 text-sm text-slate-500">{hint}</div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "ml-auto bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-800"
              }`}
            >
              {msg.imageDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={msg.imageDataUrl} alt="" className="mb-2 max-h-40 rounded-lg" />
              ) : null}
              {msg.content}
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t p-3">
          {state === "cierre" ? (
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setImage(String(reader.result));
                reader.readAsDataURL(file);
              }}
            />
          ) : null}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              placeholder={
                state === "seguimiento"
                  ? "¿Cuál es el estado de SRV-...?"
                  : "Escribe tu mensaje"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void send()}
              className="rounded-lg bg-[#0b1f3a] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? "..." : "Enviar"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
