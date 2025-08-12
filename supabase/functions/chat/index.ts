// Supabase Edge Function: chat
// Uses OpenAI to continue a chat and return the assistant message
import { serve } from "std/server";

function cors(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  return new Response(res.body, { status: res.status, headers });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return cors(new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 }));
    }

    const { messages, system } = await req.json();
    if (!Array.isArray(messages)) {
      return cors(new Response(JSON.stringify({ error: "messages must be an array" }), { status: 400 }));
    }

    const openAiMessages = [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages,
    ];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: openAiMessages,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return cors(new Response(JSON.stringify({ error: errText }), { status: 500 }));
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return cors(new Response(JSON.stringify({ content }), { headers: { "Content-Type": "application/json" } }));
  } catch (e) {
    return cors(new Response(JSON.stringify({ error: String(e) }), { status: 500 }));
  }
});
