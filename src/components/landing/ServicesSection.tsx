import { Leaf, Droplets, Sparkles, ArrowUpRight } from "lucide-react";

const SERVICES = [
  {
    icon: Sparkles,
    title: "Aseo General",
    accent: "text-primary",
    ring: "border-primary/25 bg-primary/10",
    body: "Supervisión de rutinas de limpieza con checklists digitalizados, evidencia fotográfica y cumplimiento de SLA por sede.",
    value: "Menos reclamos, más consistencia operativa.",
  },
  {
    icon: Leaf,
    title: "Jardinería",
    accent: "text-secondary",
    ring: "border-secondary/25 bg-secondary/10",
    body: "Seguimiento de mantenimiento de zonas verdes, podas y riegos con trazabilidad por cuadrilla y geolocalización de visitas.",
    value: "Territorio visible, resultados medibles.",
  },
  {
    icon: Droplets,
    title: "Mantenimiento de Piscinas",
    accent: "text-ai-accent",
    ring: "border-ai-accent/25 bg-ai-accent/10",
    body: "Control de parámetros, novedades técnicas y cierre de incidencias con fotos validadas y reporte inmediato al coordinador.",
    value: "Calidad del servicio sin puntos ciegos.",
  },
];

export function ServicesSection() {
  return (
    <section id="servicio" className="relative py-20 md:py-28 bg-surface-container-lowest/60">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-secondary uppercase">
            Servicio
          </p>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
            Servicios que supervisamos y vendemos con confianza
          </h2>
          <p className="mt-4 text-text-secondary text-base md:text-lg leading-relaxed">
            Cada servicio se opera con la misma capa de control: evidencias,
            sincronización offline y visibilidad para cliente y coordinación.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {SERVICES.map(({ icon: Icon, title, accent, ring, body, value }) => (
            <article
              key={title}
              className="group rounded-2xl border border-border-subtle bg-surface-container-low/80 p-6 hover:border-border-active hover:bg-surface-container transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
            >
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center ${ring} ${accent}`}
              >
                <Icon size={24} strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold text-text-primary group-hover:text-primary transition-colors">
                {title}
              </h3>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                {body}
              </p>
              <p className={`mt-5 text-sm font-medium ${accent} flex items-center gap-1.5`}>
                {value}
                <ArrowUpRight
                  size={14}
                  className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                />
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
