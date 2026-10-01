import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const key = Deno.env.get("GEMINI_API_KEY");
  const body = await req.json();

  if (!key) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(body) }],
          },
        ],
      }),
    },
  );

  const json = await res.json();
  return new Response(JSON.stringify(json), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
