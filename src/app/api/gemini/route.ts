import { NextResponse } from "next/server";

type Body = {
  state: "cotizacion" | "seguimiento" | "cierre";
  messages: { role: string; content: string }[];
  image?: string;
  serviceNumber?: string;
};

function demoReply(body: Body) {
  const last = body.messages.at(-1)?.content ?? "";
  if (body.state === "cotizacion") {
    const serviceNumber = `SRV-${Math.floor(100000 + Math.random() * 900000)}`;
    return {
      reply: `Cotización demo para: "${last}". Total estimado $1.250.000 COP. Pago simulado OK. Número de servicio: ${serviceNumber}.`,
      serviceNumber,
    };
  }
  if (body.state === "seguimiento") {
    const num = body.serviceNumber ?? last.match(/SRV-\d+/)?.[0] ?? "SRV-pendiente";
    return {
      reply: `El servicio ${num} está en progreso. Cuadrilla asignada, última visita de supervisión en campo pendiente de cierre.`,
      serviceNumber: num.startsWith("SRV-") ? num : body.serviceNumber,
    };
  }
  const vision = body.image
    ? "Gemini Vision (demo): la foto es coherente con una queja de servicio en sitio."
    : "No se adjuntó foto; se registra solo el texto.";
  return {
    reply: `${vision}\nQueja recibida: "${last}". Queda radicada para el coordinador.`,
    serviceNumber: body.serviceNumber,
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return NextResponse.json(demoReply(body));
  }

  const last = body.messages.at(-1)?.content ?? "";
  const system =
    body.state === "cotizacion"
      ? "Eres un cotizador de servicios en campo. Genera una cotización breve y, si el usuario acepta o pide emitir, inventa un número SRV-xxxxxx tras simular pago."
      : body.state === "seguimiento"
        ? "Consultas estado de un servicio. Usa el número de servicio si existe."
        : "Recibes cierre o quejas. Si hay imagen, valida si corresponde al texto de la queja.";

  const parts: Array<Record<string, unknown>> = [
    { text: `${system}\n\nMensaje del cliente: ${last}\nNúmero de servicio: ${body.serviceNumber ?? "N/A"}` },
  ];

  if (body.image?.startsWith("data:")) {
    const [meta, data] = body.image.split(",");
    const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
    parts.push({ inline_data: { mime_type: mime, data } });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
      }),
    },
  );

  if (!res.ok) {
    return NextResponse.json(demoReply(body));
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ??
    "Sin respuesta de Gemini.";
  const found = text.match(/SRV-\d{4,}/)?.[0];
  return NextResponse.json({
    reply: text,
    serviceNumber: found ?? (body.state === "cotizacion" ? demoReply(body).serviceNumber : body.serviceNumber),
  });
}
