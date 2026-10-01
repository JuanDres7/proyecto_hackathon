import { describe, expect, it } from "vitest";
import { openingLine, resolveClientFocus } from "./client-context";

describe("resolveClientFocus", () => {
  const services = [
    { serviceNumber: "#3001", status: "en_ejecucion", evaluated: false },
    { serviceNumber: "#3000", status: "finalizado", evaluated: false },
  ];

  it("prioriza el servicio finalizado que aún no tiene evaluación", () => {
    expect(resolveClientFocus(services, null)).toEqual({
      situation: "finalizacion",
      focusNumber: "#3000",
      unknownCode: null,
    });
  });

  it("sigue el código que la persona escribió si es suyo", () => {
    expect(resolveClientFocus(services, "#3001")).toEqual({
      situation: "progreso",
      focusNumber: "#3001",
      unknownCode: null,
    });
  });

  it("no adopta un código que no está en sus servicios", () => {
    expect(resolveClientFocus(services, "#3999").unknownCode).toBe("#3999");
    expect(resolveClientFocus(services, "#3999").focusNumber).toBe("#3000");
  });

  it("abre cotización cuando no hay servicios confirmados", () => {
    expect(resolveClientFocus([], null).situation).toBe("cotizacion");
  });

  it("arma el saludo con el estado leído, no con un menú de fases", () => {
    const line = openingLine({
      customerName: "Laura Méndez",
      services: [
        {
          serviceNumber: "#3001",
          status: "en_ejecucion",
          evaluated: false,
          message: "El servicio está en ejecución. Ya hay check-in sincronizado.",
        },
      ],
      situation: "progreso",
      focusNumber: "#3001",
    });
    expect(line).toContain("Laura Méndez");
    expect(line).toContain("#3001");
    expect(line).toContain("en ejecución");
    expect(line).not.toContain("Cotización");
  });
});
