import { describe, expect, it } from "vitest";
import { DEMO_ASSIGNMENT, DEMO_SERVICE_NUMBER, ensureDemoAssignment } from "./demo-assignment";
import { listConfirmedServices } from "./orders";

describe("asignación de prueba", () => {
  it("publica el código #3089 para el supervisor de prueba", async () => {
    await ensureDemoAssignment();
    const rows = await listConfirmedServices({ supervisorId: DEMO_ASSIGNMENT.supervisorId });
    expect(rows.map((row) => row.service_number)).toContain(DEMO_SERVICE_NUMBER);
  });
});