import { UserMinus, WifiOff, Bot } from "lucide-react";

const METRICS = [
  {
    icon: UserMinus,
    value: "−35%",
    label: "Reducción de ausentismo",
    detail: "Presencia validada en sitio reduce falsos reportes y mejora la disciplina operativa de cuadrillas.",
    tone: "text-primary",
    glow: "bg-primary/15",
  },
  {
    icon: WifiOff,
    value: "100%",
    label: "Trazabilidad offline-first",
    detail: "Las visitas se registran sin señal y se sincronizan al recuperar red, sin pérdida de evidencia.",
    tone: "text-secondary",
    glow: "bg-secondary/15",
  },
  {
    icon: Bot,
    value: "24/7",
    label: "Automatización con IA",
    detail: "Cotización, seguimiento por código único y validación visual de novedades con asistente multimodal.",
    tone: "text-ai-accent",
    glow: "bg-ai-accent/15",
  },
];

export function ImpactSection() {
  return (
    <section id="impacto" className="relative py-20 md:py-28 overflow-hidden">
      <div className="absolute -right-24 top-10 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-20 bottom-0 w-64 h-64 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-ai-accent uppercase">
            Impacto y beneficios
          </p>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
            Valor medible para la operación
          </h2>
          <p className="mt-4 text-text-secondary text-base md:text-lg leading-relaxed">
            FieldOps convierte la supervisión en campo en indicadores claros de
            cumplimiento, continuidad y atención al cliente.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {METRICS.map(({ icon: Icon, value, label, detail, tone, glow }) => (
            <div key={label} className="relative">
              <div className={`absolute -inset-px rounded-2xl ${glow} blur-xl opacity-40`} />
              <div className="relative rounded-2xl border border-border-subtle bg-surface/70 backdrop-blur-sm p-6 h-full">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${glow} ${tone}`}>
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <p className={`mt-5 font-display text-4xl font-semibold tracking-tight ${tone}`}>
                  {value}
                </p>
                <h3 className="mt-2 text-base font-semibold text-text-primary">
                  {label}
                </h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                  {detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
