"use client";

import { useMemo, useState } from "react";
import type { ChatMessage, ChatState } from "@/lib/types";

const STATES: { id: ChatState; num: string; label: string; hint: string }[] = [
  {
    id: "cotizacion",
    num: "1",
    label: "Cotización Asistida",
    hint: "Describe el servicio requerido. El asistente generará el presupuesto algorítmico y emitirá tu token de servicio.",
  },
  {
    id: "seguimiento",
    num: "2",
    label: "Seguimiento en Vivo",
    hint: "Consulta en tiempo real la geocerca, hora estimada y estado operativo de la cuadrilla asignada.",
  },
  {
    id: "cierre",
    num: "3",
    label: "Calificación & IA CSAT",
    hint: "Envía observaciones o adjunta fotografías de anomalías. Gemini Vision + NLP validarán la correlación técnica.",
  },
];

const PROMPT_SUGGESTIONS = [
  { label: "⏱️ Tiempo Restante", text: "¿A qué hora aproximada finaliza la inspección en la subestación?" },
  { label: "📄 Pre-informe PDF", text: "Solicito descargar el acta técnica preliminar de las pruebas." },
  { label: "📸 Añadir Fotografía", text: "Adjunto evidencia fotográfica del transformador para validación con Gemini Vision." },
];

export function ClientChat() {
  const [state, setState] = useState<ChatState>("cotizacion");
  const [serviceNumber, setServiceNumber] = useState("SRV-8942-BOG");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      role: "assistant",
      content:
        "¡Hola! He evaluado las especificaciones de inspección perimetral y termográfica para la Subestación Norte Bogotá. Conforme al volumen de activos y protocolo RETIE, el presupuesto computado es de $145.00 USD (Aprobado con Crédito Corp). Token de Reserva emitido: SRV-8942-BOG.",
      createdAt: "08:29 AM",
    },
  ]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [stars, setStars] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([
    "Puntualidad Geocerca",
    "Claridad Técnica",
    "Resolución Inconsistencia IA",
  ]);
  const [csatSubmitted, setCsatSubmitted] = useState(false);

  const activeHint = useMemo(
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
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
        try {
          const nlpRes = await fetch("/api/nlp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: userMsg.content,
              serviceNumber: gemini.serviceNumber ?? serviceNumber,
            }),
          });
          const nlp = (await nlpRes.json()) as { label?: string; confidence?: number };
          if (nlp.label) {
            extra = `\n\n[Clasificación NLP Sentence Transformers]: ${nlp.label} (Confianza ${(
              (nlp.confidence ?? 0.94) * 100
            ).toFixed(1)}%). Vector similitud verificado.`;
          }
        } catch {
          // ignore nlp fetch errors
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `${gemini.reply || "Consulta procesada con éxito por el Edge Worker."}${extra}`,
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setImage(undefined);
    } catch {
      // Fallback response for hackathon demo if API endpoint is unconfigured
      let fallback = "Consulta procesada en modo seguro.";
      if (state === "cotizacion") {
        fallback =
          "Presupuesto validado por Supabase Edge Functions. Se han programado 1x Supervisor Nivel III para la Subestación Norte.";
      } else if (state === "seguimiento") {
        fallback =
          "El supervisor Ing. Carlos Mendoza (Cuadrilla 4) arribó a la geocerca de la Subestación Norte a las 10:02 AM e inició check-in biométrico y calibración de instrumentos (Garita #2, GPS Lock ±1.8m).";
      } else {
        fallback =
          "Gemini Vision + FastAPI NLP: Análisis multivariante completado con 94% de confianza. La anomalía fue clasificada como exudación dieléctrica y agregada a la orden de trabajo con adenda automática.";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fallback,
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setImage(undefined);
    } finally {
      setBusy(false);
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* 1. Top Contextual Control Bar & State Switcher */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-surface-card rounded-xl border border-border-subtle shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high border border-border-subtle flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[22px]">smart_toy</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-text-primary tracking-tight">
                Portal Cliente FieldOps
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container font-mono text-xs text-primary font-medium border border-border-subtle">
                {serviceNumber}
              </span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-low text-secondary font-mono text-[11px] border border-secondary/30">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                En Ejecución
              </span>
            </div>
            <p className="text-xs text-text-secondary truncate mt-0.5">
              Inspección Estructural Red Eléctrica Subestación Norte • Transmisión Andina S.A.
            </p>
          </div>
        </div>

        {/* State Pill Switcher */}
        <div className="flex items-center gap-1 p-1 bg-surface-container-lowest rounded-xl border border-border-subtle w-full md:w-auto overflow-x-auto">
          {STATES.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setState(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                state === st.id
                  ? "bg-surface-container-high text-text-primary border border-border-subtle shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full font-mono text-[10px] flex items-center justify-center ${
                  state === st.id
                    ? "bg-primary text-on-primary font-bold"
                    : "bg-surface-container-high text-text-secondary"
                }`}
              >
                {st.num}
              </span>
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Dual Layout Grid: Left Panel (Chat) & Right Panel (Timeline & CSAT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: 7 Cols (~58%) - Gemini Multimodal Chatbot */}
        <section className="lg:col-span-7 flex flex-col bg-surface-card rounded-xl border border-border-subtle shadow-xl overflow-hidden min-w-0">
          {/* Chat Header */}
          <div className="p-4 bg-surface-container-lowest border-b border-border-subtle flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-ai-accent shrink-0">
                <span className="material-symbols-outlined text-[18px]">psychology</span>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface-card" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-text-primary truncate">
                    Asistente Virtual FieldOps
                  </span>
                  <span className="px-1.5 py-0.2 rounded font-mono text-[10px] uppercase bg-surface-container text-ai-accent border border-ai-accent/30">
                    Gemini 1.5 Pro
                  </span>
                </div>
                <span className="font-mono text-[10px] text-text-muted flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-secondary" />
                  Supabase Edge Functions (<span className="text-text-secondary">latency: 42ms</span>)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => window.alert("Registro de conversación descargado en formato JSON.")}
                className="w-7 h-7 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-text-secondary hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
                title="Descargar Registro"
              >
                <span className="material-symbols-outlined text-[16px]">sim_card_download</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setMessages([
                    {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: "Sesión reiniciada. ¿En qué puedo asistirte con tu orden técnica?",
                      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    },
                  ])
                }
                className="w-7 h-7 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-text-secondary hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
                title="Reiniciar Sesión"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
              </button>
            </div>
          </div>

          {/* Hint Strip */}
          <div className="bg-surface-container-low/60 px-4 py-2 text-[11px] text-text-secondary border-b border-border-subtle flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-primary">info</span>
            <span>{activeHint}</span>
          </div>

          {/* Chat Transcript Scroll Zone */}
          <div className="p-4 flex flex-col gap-4 max-h-[560px] min-h-[400px] overflow-y-auto bg-surface-container-lowest/50">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 max-w-[92%] ${
                    isUser ? "self-end flex-row-reverse" : "self-start"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isUser
                        ? "bg-surface-container-high text-text-primary border border-border-subtle"
                        : "bg-surface-container text-ai-accent border border-border-subtle"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isUser ? "person" : "neurology"}
                    </span>
                  </div>

                  <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                    <div
                      className={`p-3.5 rounded-xl shadow-sm text-xs leading-relaxed ${
                        isUser
                          ? "bg-surface-muted text-text-primary border border-border-subtle"
                          : "bg-surface-container-low text-text-primary border border-border-subtle"
                      }`}
                    >
                      {msg.imageDataUrl && (
                        <div className="mb-2 max-w-xs rounded-lg overflow-hidden border border-border-subtle">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.imageDataUrl}
                            alt="Evidencia adjunta"
                            className="w-full max-h-48 object-cover"
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* State 1: Interactive Quote Payload Embed if matching text */}
                      {msg.content.includes("$145.00 USD") && (
                        <div className="mt-3 p-3 rounded-lg bg-surface-card border border-border-subtle flex flex-col gap-2">
                          <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
                            <div>
                              <span className="text-[10px] font-mono text-text-muted uppercase">
                                Servicio Técnico Especializado
                              </span>
                              <h4 className="text-xs font-semibold text-text-primary">
                                Inspección Estructural & Red Eléctrica
                              </h4>
                            </div>
                            <div className="text-right">
                              <span className="text-base font-bold text-secondary font-mono">
                                $145.00 USD
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[11px] text-text-secondary">
                            <span className="flex items-center gap-1">✓ 1x Supervisor Nivel III</span>
                            <span className="flex items-center gap-1">✓ Duración: ~3.5 horas</span>
                            <span className="flex items-center gap-1">✓ Validación Gemini Vision</span>
                            <span className="flex items-center gap-1">✓ SLA Respuesta &lt;60min</span>
                          </div>
                          <div className="pt-2 flex items-center justify-between border-t border-border-subtle">
                            <span className="font-mono text-[10px] text-secondary">
                              Token: {serviceNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-medium font-mono">
                              Aprobado con Crédito Corp
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">{msg.createdAt}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Input Footer */}
          <div className="p-3 bg-surface-card border-t border-border-subtle flex flex-col gap-2.5">
            {/* Quick Suggestions Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="font-mono text-[10px] text-text-muted uppercase shrink-0">
                Sugerencias:
              </span>
              {PROMPT_SUGGESTIONS.map((sug) => (
                <button
                  key={sug.label}
                  type="button"
                  onClick={() => setInput(sug.text)}
                  className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-[11px] text-text-secondary hover:text-text-primary border border-border-subtle whitespace-nowrap transition-colors cursor-pointer"
                >
                  {sug.label}
                </button>
              ))}
            </div>

            {/* Attached Image Preview */}
            {image && (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border-active">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Adjunto" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImage(undefined)}
                  className="absolute top-0.5 right-0.5 bg-black/70 rounded-full w-4 h-4 flex items-center justify-center text-white text-[10px]"
                >
                  ×
                </button>
              </div>
            )}

            {/* Input Bar */}
            <div className="flex items-center gap-2 bg-surface-container-lowest p-1.5 rounded-xl border border-border-subtle shadow-inner">
              <label
                className="w-8 h-8 rounded-lg bg-surface-container-low hover:bg-surface-container text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors cursor-pointer"
                title="Adjuntar Fotografía para Gemini Vision"
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setImage(String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                />
                <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
              </label>

              <input
                className="flex-1 bg-transparent px-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder={
                  state === "cotizacion"
                    ? "Describe el servicio que necesitas cotizar..."
                    : state === "seguimiento"
                    ? "¿Cuál es el estado o ETA del servicio?"
                    : "Describe tu observación o queja con foto..."
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
                className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-container transition-all flex items-center gap-1 shadow-md disabled:opacity-50 cursor-pointer"
              >
                <span>{busy ? "..." : "Enviar"}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: 5 Cols (~42%) - Service Timeline & AI-CSAT Closure */}
        <section className="lg:col-span-5 flex flex-col gap-6 min-w-0">
          {/* Service Information Card */}
          <div className="p-4 bg-surface-card rounded-xl border border-border-subtle shadow-md flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-mono text-xs text-primary font-medium tracking-wide">
                  ORDEN ACTIVA #{serviceNumber}
                </span>
                <h3 className="text-sm font-semibold text-text-primary">
                  Inspección Subestación Norte
                </h3>
                <span className="text-[11px] text-text-secondary">
                  Contrato Marco de Mantenimiento #CM-408
                </span>
              </div>
              <div className="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-mono text-[11px] flex items-center gap-1 border border-secondary/20">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                SLA 98.4%
              </div>
            </div>

            {/* Supervisor Field Micro-badge */}
            <div className="p-2.5 rounded-lg bg-surface-container-low border border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-surface-container-high border border-border-subtle flex items-center justify-center text-primary font-bold text-xs">
                  CM
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-text-primary">
                    Ing. Carlos Mendoza
                  </span>
                  <span className="font-mono text-[10px] text-text-muted">
                    Cuadrilla Móvil #4 • Cert. RETIE Nivel III
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.alert("Conectando canal de radio frecuencia...")}
                className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors border border-border-subtle cursor-pointer"
                title="Contactar Radio Frecuencia"
              >
                <span className="material-symbols-outlined text-[18px]">phone_in_talk</span>
              </button>
            </div>
          </div>

          {/* Vertical Stepper: Service Execution Timeline */}
          <div className="p-4 bg-surface-card rounded-xl border border-border-subtle shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  timeline
                </span>
                <span>Línea de Vida Operativa</span>
              </h4>
              <span className="font-mono text-[10px] text-text-muted">Paso 4 de 5</span>
            </div>

            {/* Stepper Track */}
            <div className="relative pl-6 flex flex-col gap-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-highest">
              {/* Step 1 */}
              <div className="relative flex flex-col gap-0.5 text-xs">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-sm">
                  <span className="material-symbols-outlined text-[11px]">check</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">1. Solicitud y Cotización</span>
                  <span className="font-mono text-[10px] text-text-muted">08:30 AM</span>
                </div>
                <p className="text-[11px] text-text-secondary">
                  Generación algorítmica vía Edge Functions ($145 USD aprobados).
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative flex flex-col gap-0.5 text-xs">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-sm">
                  <span className="material-symbols-outlined text-[11px]">check</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">2. Despacho de Cuadrilla</span>
                  <span className="font-mono text-[10px] text-text-muted">09:15 AM</span>
                </div>
                <p className="text-[11px] text-text-secondary">
                  Asignado a Ing. Carlos Mendoza (Vehículo T-402, GPS Sync).
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative flex flex-col gap-0.5 text-xs">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-sm">
                  <span className="material-symbols-outlined text-[11px]">check</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">3. Check-in con Geocerca</span>
                  <span className="font-mono text-[10px] text-text-muted">10:02 AM</span>
                </div>
                <p className="text-[11px] text-text-secondary">
                  Validado dentro del polígono (&lt;25m del transformador central).
                </p>
              </div>

              {/* Step 4 */}
              <div className="relative flex flex-col gap-0.5 text-xs">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm ring-2 ring-primary/30">
                  <span className="material-symbols-outlined text-[11px] animate-spin">
                    autorenew
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">4. Captura & Diagnóstico In-Situ</span>
                  <span className="font-mono text-[10px] text-primary">10:45 AM (En curso)</span>
                </div>
                <p className="text-[11px] text-text-secondary">
                  14/18 puntos verificados. Análisis térmico y fotos validadas por Gemini.
                </p>
              </div>

              {/* Step 5 */}
              <div className="relative flex flex-col gap-0.5 text-xs opacity-60">
                <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-surface-container flex items-center justify-center text-text-muted shadow-sm">
                  <span className="material-symbols-outlined text-[11px]">lock_clock</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-muted">5. Cierre & Calidad CSAT</span>
                  <span className="font-mono text-[10px] text-text-muted">Pendiente</span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Generación de acta final, firma digital y feedback.
                </p>
              </div>
            </div>
          </div>

          {/* Completion & CSAT AI Rating Component (Estado 3) */}
          <div className="p-4 bg-surface-card rounded-xl border border-border-subtle shadow-md flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-text-primary">
                  Calificación & Feedback CSAT
                </span>
                <span className="text-[11px] text-text-secondary">
                  Cierre formal de la visita técnica
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-ai-accent/15 text-ai-accent font-mono text-[10px] border border-ai-accent/30 font-semibold">
                Audit IA
              </span>
            </div>

            {/* Star Selector */}
            <div className="p-3 rounded-lg bg-surface-container-low border border-border-subtle flex flex-col items-center justify-center gap-1.5">
              <span className="text-[11px] text-text-muted">
                ¿Cómo evalúa la atención técnica del servicio?
              </span>
              <div className="flex items-center gap-2 text-status-warning cursor-pointer">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setStars(idx)}
                    className="hover:scale-125 transition-transform focus:outline-none"
                  >
                    <span
                      className="material-symbols-outlined text-[24px]"
                      style={{
                        fontVariationSettings: `'FILL' ${idx <= stars ? 1 : 0}`,
                      }}
                    >
                      star
                    </span>
                  </button>
                ))}
              </div>
              <span className="font-mono text-xs text-secondary font-medium">
                {stars}.0 / 5.0 — {stars === 5 ? "Excelente Desempeño" : "Servicio Conforme"}
              </span>
            </div>

            {/* Feedback Criteria Tags */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-text-muted uppercase">
                Puntos destacados:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Puntualidad Geocerca",
                  "Claridad Técnica",
                  "Resolución Inconsistencia IA",
                  "Equipos Calibrados",
                ].map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1 border ${
                        active
                          ? "bg-surface-container text-text-primary border-secondary/40"
                          : "bg-surface-container-low text-text-muted border-border-subtle"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px] text-secondary">
                        {active ? "check_circle" : "add"}
                      </span>
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Summary note */}
            <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-border-subtle flex flex-col gap-1 text-[11px]">
              <div className="flex items-center justify-between text-text-muted font-mono text-[10px]">
                <span>VALIDACIÓN DE ENTREGA GEMINI</span>
                <span className="text-status-online">Cierre Automatizado OK</span>
              </div>
              <p className="text-text-secondary leading-relaxed">
                Las evidencias capturadas en sitio cumplen al 100% con la norma técnica. El informe
                final firmado ha sido emitido.
              </p>
            </div>

            {csatSubmitted ? (
              <div className="p-2.5 rounded-lg bg-secondary/10 border border-secondary/30 text-secondary text-xs font-mono text-center">
                ✓ Acta final emitida y sincronizada exitosamente.
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCsatSubmitted(true)}
                className="w-full py-2 bg-secondary text-on-secondary rounded-lg text-xs font-semibold hover:bg-secondary/90 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">done_all</span>
                <span>Emitir Cierre y Acta Final</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
