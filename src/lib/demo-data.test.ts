import { describe, expect, it } from "vitest";
import { listServicesForEmail, serviceDetailForEmail } from "./client-services";
import { ensureDemoShowcase } from "./demo-data";
import { getOrderByNumber, listConfirmedServices } from "./orders";
import { buildReportRows, visitsFromMemory } from "./reports";
import { authenticateSeed, DEMO_PASSWORD } from "./seed-users";

describe("datos de presentación", () => {
  it("acepta las tres cuentas y rechaza una clave distinta", () => {
    expect(authenticateSeed("cliente@limpiapp.co", DEMO_PASSWORD)?.fullName).toBe("Laura Méndez");
    expect(authenticateSeed("supervisor@limpiapp.co", DEMO_PASSWORD)?.role).toBe("supervisor");
    expect(authenticateSeed("coordinador@limpiapp.co", DEMO_PASSWORD)?.role).toBe("coordinador");
    expect(authenticateSeed("cliente@limpiapp.co", "otra")).toBeNull();
  });

  it("llena los servicios de Laura y los reportes del coordinador", async () => {
    ensureDemoShowcase();
    const services = await listServicesForEmail("cliente@limpiapp.co");
    expect(services.map((service) => service.serviceNumber).sort()).toEqual(["#3050", "#3066", "#3089", "#3090", "#3091"]);
    expect(services.find((service) => service.serviceNumber === "#3089")?.status).toBe("asignado");
    const order = await getOrderByNumber("#3089");
    expect(JSON.stringify(order)).toContain("#3089");
    const listed = await listConfirmedServices();
    expect(listed.some((row) => row.service_number === "#3089")).toBe(true);
    const closed = await serviceDetailForEmail("cliente@limpiapp.co", "3066");
    expect(closed?.novedad).toContain("jabón");
    expect(closed?.activities.some((activity) => activity.justification.includes("jabón"))).toBe(true);
    expect(await serviceDetailForEmail("otro@limpiapp.co", "3089")).toBeNull();

    const rows = buildReportRows(visitsFromMemory(), "supervisor", {
      "demo-supervisor": "Andrés Ríos",
      "demo-supervisor-2": "Camila Torres",
    });
    expect(rows.map((row) => row.label).sort()).toEqual(["Andrés Ríos", "Camila Torres"]);
    expect(rows.find((row) => row.label === "Andrés Ríos")?.completed).toBeGreaterThan(0);
    expect(rows.find((row) => row.label === "Andrés Ríos")?.novedad).toBeGreaterThan(0);
    expect(listed.some((row) => row.service_number === "#3092")).toBe(true);
  });
});
