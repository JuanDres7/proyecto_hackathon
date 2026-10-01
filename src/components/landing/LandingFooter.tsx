import { BrandMark } from "./BrandMark";

export function LandingFooter() {
  return (
    <footer className="border-t border-border-subtle bg-surface-container-lowest">
      <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <BrandMark size="sm" />
          <p className="mt-3 text-sm text-text-muted max-w-sm">
            Supervisión inteligente de servicios en campo · Trazabilidad · Control operativo · IA
          </p>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
          <a href="#inicio" className="hover:text-primary transition-colors">
            Inicio
          </a>
          <a href="#nosotros" className="hover:text-primary transition-colors">
            Nosotros
          </a>
          <a href="#servicio" className="hover:text-primary transition-colors">
            Servicio
          </a>
          <a href="#contacto" className="hover:text-primary transition-colors">
            Contacto
          </a>
          <a href="/?login=1" className="hover:text-primary transition-colors">
            Acceso
          </a>
        </div>
      </div>
      <div className="border-t border-border-subtle px-5 py-4 text-center text-xs text-text-muted">
        © {new Date().getFullYear()} LimpiApp · Todos los derechos reservados
      </div>
    </footer>
  );
}
