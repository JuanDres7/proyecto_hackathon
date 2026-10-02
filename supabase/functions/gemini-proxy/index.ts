/// <reference path="../deno.d.ts" />
import { withSupabase } from "npm:@supabase/server@1";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

export default {
  fetch: withSupabase({ auth: "secret" }, async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok");
    }
    if (req.method !== "POST") {
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    }

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) {
      return Response.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
    }

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }

    const body = "contents" in payload ? payload : { contents: [{ role: "user", parts: [{ text: JSON.stringify(payload) }] }] };

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json().catch(() => ({ error: "gemini_invalid_response" }));
    return Response.json(json, { status: res.status });
  }),
};
