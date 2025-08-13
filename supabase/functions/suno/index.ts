// Supabase Edge Function: suno
// Suno via API Box - start generation and poll status
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.api.box/api/v1";
const SUPABASE_URL = "https://afsyxzxwxszujnsmukff.supabase.co"; // Project URL for callback

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}), ...corsHeaders },
  });
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("SUNO_API_KEY");
  if (!apiKey) return json({ error: "Missing SUNO_API_KEY" }, { status: 500 });

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Handle webhook callbacks (optional)
    if (req.method === "POST" && pathname.endsWith("/callback")) {
      try {
        const body = await req.json();
        console.log("[suno] Callback received:", body?.status || body);
      } catch (_) {
        console.log("[suno] Callback received (non-JSON body)");
      }
      return json({ ok: true });
    }

    if (req.method === "POST") {
      const details = await req.json().catch(() => ({} as any));

      // Map incoming details to API Box parameters
      const title: string = details.title?.toString()?.slice(0, 80) || "Untitled";
      const genre: string = details.genre?.toString() || "";
      const mood: string = details.mood?.toString() || "";
      const tempo: string = details.tempo?.toString() || "";
      const language: string = details.language?.toString() || "";
      const vocals: string = details.vocals?.toString() || "";
      const lyrics: string = details.lyrics?.toString() || "";

      const instrumental = vocals.toLowerCase() === "none";
      const hasLyrics = !!lyrics.trim();

      // In customMode=true: if instrumental=false, prompt must be lyrics
      // In customMode=false: only prompt is required (<= 400 chars)
      let customMode = false;
      let prompt = "";
      let style: string | undefined = undefined;
      let apiTitle: string | undefined = undefined;

      if (hasLyrics) {
        customMode = true;
        prompt = lyrics; // Use lyrics directly per API requirement
        style = genre || "Pop";
        apiTitle = title;
      } else {
        customMode = false;
        const parts = [
          genre && `Genre: ${genre}`,
          mood && `Mood: ${mood}`,
          tempo && `Tempo: ${tempo}`,
          language && `Language: ${language}`,
          vocals && `Vocals: ${vocals}`,
        ].filter(Boolean);
        prompt = parts.join(", ") || "A catchy modern pop track";
        if (prompt.length > 380) prompt = prompt.slice(0, 380); // stay below 400 chars
      }

      const body: Record<string, unknown> = {
        prompt,
        customMode,
        instrumental,
        model: "V3_5",
        callBackUrl: `${SUPABASE_URL}/functions/v1/suno/callback`,
      };
      if (customMode) {
        body.style = style;
        body.title = apiTitle;
      }

      console.log("[suno] Starting generation", { customMode, instrumental, hasLyrics });

      const start = await fetch(`${API_BASE}/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const startJson = await start.json().catch(() => ({}));
      if (!start.ok || startJson?.code !== 200) {
        const msg = startJson?.msg || (await start.text().catch(() => "")) || start.statusText;
        console.error("[suno] Generate error:", msg);
        return json({ error: msg }, { status: 500 });
      }

      const taskId = startJson?.data?.taskId;
      if (!taskId) return json({ error: "No taskId returned" }, { status: 500 });

      return json({ jobId: taskId });
    }

    if (req.method === "GET") {
      const jobId = url.searchParams.get("jobId");
      if (!jobId) return json({ error: "Missing jobId" }, { status: 400 });

      const statusResp = await fetch(`${API_BASE}/generate/record-info?taskId=${encodeURIComponent(jobId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const statusJson = await statusResp.json().catch(() => ({}));

      if (!statusResp.ok || typeof statusJson?.data === "undefined") {
        const msg = statusJson?.msg || (await statusResp.text().catch(() => "")) || statusResp.statusText;
        console.error("[suno] Status error:", msg);
        return json({ status: "error", error: msg });
      }

      const data = statusJson.data as any;
      const st: string = data.status || "PENDING";

      if (st === "SUCCESS") {
        const tracks = data.response?.data || [];
        const audioUrl = tracks?.[0]?.audio_url || tracks?.[0]?.audioUrl || null;
        if (!audioUrl) return json({ status: "error", error: "No audio URL in response" });
        return json({ status: "ready", audioUrl });
      }

      if (st.includes("FAILED") || st === "SENSITIVE_WORD_ERROR" || st === "CREATE_TASK_FAILED") {
        const err = data.errorMessage || data.status || "Generation failed";
        return json({ status: "error", error: err });
      }

      return json({ status: "pending" });
    }

    return json({ error: "Method not allowed" }, { status: 405 });
  } catch (e) {
    console.error("[suno] Unhandled error:", e);
    return json({ status: "error", error: String(e) }, { status: 500 });
  }
});
