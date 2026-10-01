import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureDemoShowcase } from "@/lib/demo-data";
import { puroTurn } from "./puro";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe("Puro llama a Gemini", () => {
  it("envía el mensaje y los servicios del cliente al modelo", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    ensureDemoShowcase();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ reply: "Tu servicio #3089 sigue asignado." }) }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await puroTurn({
      phase: "cotizacion",
      message: "hola, cómo van mis servicios",
      email: "cliente@limpiapp.co",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [url, init] = call;
    expect(url).toContain("models/gemini-3.8-flash:generateContent");
    const body = JSON.parse(String(init.body));
    const sent = JSON.stringify(body);
    expect(sent).toContain("hola, cómo van mis servicios");
    expect(sent).toContain("#3089");
    expect(result.available).toBe(true);
    expect(result.reply).toContain("#3089");
  });
});
