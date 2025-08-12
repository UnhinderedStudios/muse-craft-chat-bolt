// Supabase Edge Function: suno
// Starts a Suno generation job and polls for status
import { serve } from "std/server";

function cors(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  return new Response(res.body, { status: res.status, headers });
}

const SUNO_BASE = "https://api.suno.ai"; // NOTE: adjust to official Suno API base if different

serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  const apiKey = Deno.env.get("SUNO_API_KEY");
  if (!apiKey) return cors(new Response(JSON.stringify({ error: "Missing SUNO_API_KEY" }), { status: 500 }));

  try {
    const url = new URL(req.url);
    if (req.method === "POST") {
      const details = await req.json();
      // Compose a prompt according to details
      const prompt = `Title: ${details.title || "Untitled"}\nGenre: ${details.genre || ""}\nMood: ${details.mood || ""}\nTempo: ${details.tempo || ""}\nLanguage: ${details.language || ""}\nVocals: ${details.vocals || ""}\nLyrics: ${details.lyrics || ""}`.trim();

      // Placeholder endpoint - replace with official Suno create endpoint
      const start = await fetch(`${SUNO_BASE}/v1/generate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!start.ok) {
        const txt = await start.text();
        return cors(new Response(JSON.stringify({ error: txt }), { status: 500 }));
      }

      const data = await start.json();
      const jobId = data.jobId || data.id || data.task_id || crypto.randomUUID();
      return cors(new Response(JSON.stringify({ jobId }), { headers: { "Content-Type": "application/json" } }));
    }

    if (req.method === "GET") {
      const jobId = url.searchParams.get("jobId");
      if (!jobId) return cors(new Response(JSON.stringify({ error: "Missing jobId" }), { status: 400 }));

      // Placeholder status endpoint - replace with official Suno status endpoint
      const status = await fetch(`${SUNO_BASE}/v1/status?jobId=${encodeURIComponent(jobId)}`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      if (!status.ok) {
        const txt = await status.text();
        return cors(new Response(JSON.stringify({ status: "error", error: txt }), { status: 500 }));
      }
      const data = await status.json();
      if (data.status === "ready" && (data.audioUrl || data.url || data.result?.audio)) {
        const audioUrl = data.audioUrl || data.url || data.result?.audio;
        return cors(new Response(JSON.stringify({ status: "ready", audioUrl }), { headers: { "Content-Type": "application/json" } }));
      }
      if (data.status === "error") {
        return cors(new Response(JSON.stringify({ status: "error", error: data.error || "Unknown" }), { status: 200 }));
      }
      return cors(new Response(JSON.stringify({ status: data.status || "pending" }), { headers: { "Content-Type": "application/json" } }));
    }

    return cors(new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 }));
  } catch (e) {
    return cors(new Response(JSON.stringify({ status: "error", error: String(e) }), { status: 500 }));
  }
});
