import { withSupabase } from "npm:@supabase/server@1";

export default {
  fetch: withSupabase({ auth: "secret" }, async (req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok");
    }

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) {
      return Response.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
    }

    const body = await req.json();
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
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
    return Response.json(json, { status: res.status });
  }),
};
