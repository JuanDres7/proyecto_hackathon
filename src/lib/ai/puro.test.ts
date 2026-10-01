import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureDemoShowcase } from "@/lib/demo-data";
import { keyFromEnvText } from "./gemini";
import { puroTurn } from "./puro";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe("Puro llama a Gemini", () => {
  it("lee GEMINI_API_KEY desde el texto de .env", () => {
    expect(keyFromEnvText('GEMINI_API_KEY="abc123"\n')).toBe("abc123");
    expect(keyFromEnvText("GOOGLE_API_KEY=xyz\n")).toBe("xyz");
  });

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
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: expect.any(String) }] }]);
  });

  it("sigue llamando a Gemini en el segundo mensaje sin reenviar turnos del modelo", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    ensureDemoShowcase();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "¿En qué dirección?" }) }] } }],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await puroTurn({
      phase: "cotizacion",
      message: "Quiero cotizar un aseo",
      email: "cliente@limpiapp.co",
      history: [
        { role: "assistant", content: "Hola, soy Puro." },
        { role: "user", content: "HOLAASDAKJSDBASKJDAS" },
        { role: "assistant", content: "¿En qué te puedo colaborar?" },
      ],
    });

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].role).toBe("user");
    expect(body.contents[0].parts[0].text).toContain("Quiero cotizar un aseo");
    expect(body.contents[0].parts[0].text).toContain("¿En qué te puedo colaborar?");
  });

  it("reintenta el segundo mensaje sin historial si Gemini rechaza la conversación", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    ensureDemoShowcase();
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: { message: "thought signature is not valid" } }), {
          status: 400,
        });
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "¿En qué dirección queda?" }) }] } }],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await puroTurn({
      phase: "cotizacion",
      message: "Quiero cotizar un aseo",
      email: "cliente@limpiapp.co",
      history: [
        { role: "user", content: "hola" },
        { role: "assistant", content: "¿Qué servicio necesitas?" },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const body = JSON.parse(String(second[1].body));
    expect(body.contents[0].parts[0].text).not.toContain("Conversación previa");
    expect(result.reply).toContain("dirección");
  });

  it("muestra el error de Gemini en lugar de ocultarlo", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: 400 })),
    );
    const result = await puroTurn({
      phase: "cotizacion",
      message: "hola",
      email: "cliente@limpiapp.co",
    });
    expect(result.reply).toContain("API key not valid");
  });
});
