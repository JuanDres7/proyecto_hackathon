import { describe, expect, it } from "vitest";
import { buildSimplePdf } from "./pdf";

describe("pdf", () => {
  it("emits a native PDF-1.4 document", () => {
    const bytes = buildSimplePdf("Reporte", ["fila 1", "fila 2"]);
    const head = new TextDecoder().decode(bytes.slice(0, 8));
    expect(head).toBe("%PDF-1.4");
    expect(new TextDecoder().decode(bytes).includes("%%EOF")).toBe(true);
  });
});
