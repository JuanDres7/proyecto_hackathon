import { ShieldCheck, MapPinned, Radio } from "lucide-react";

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Misión",
    body: "Garantizar que cada servicio contratado se ejecute con evidencia verificable, independientemente de la cobertura de red en territorio.",
  },
  {
    icon: MapPinned,
    title: "Control territorial",
    body: "Validamos presencia real con geocercas, check-in GPS y captura fotográfica para cerrar la brecha entre lo planeado y lo ejecutado.",
  },
  {
    icon: Radio,
    title: "Operación continua",
    body: "Arquitectura offline-first que sincroniza automáticamente cuando vuelve la señal, sin perder trazabilidad ni duplicar registros.",
  },
];

export function AboutSection() {
  return (
    <section id="nosotros" className="relative py-20 md:py-28">
      <div className="absolute inset-0 landing-mesh opacity-60 pointer-events-none" />
      <div className="relative max-w-6xl mx-auto px-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            Nosotros
          </p>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold text-text-primary tracking-tight">
            Quiénes somos y por qué existimos
          </h2>
          <p className="mt-4 text-text-secondary text-base md:text-lg leading-relaxed">
            Somos la plataforma que conecta supervisores en campo, coordinadores
            de operación y clientes en un solo flujo de control. Nuestra propuesta
            institucional es clara: visibilidad total de aseo, jardinería y
            mantenimiento, con evidencia, tiempo real y respaldo de inteligencia
            artificial.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {POINTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="group">
              <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary group-hover:bg-primary/25 transition-colors">
                <Icon size={22} strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-text-primary">
                {title}
              </h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
