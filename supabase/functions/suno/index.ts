// Supabase Edge Function: suno
// Suno via API Box - start generation and poll status
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.api.box/api/v1";
const SUPABASE_URL = "https://afsyxzxwxszujnsmukff.supabase.co"; // Project URL for callback

const supaUrl = Deno.env.get("SUPABASE_URL") || SUPABASE_URL;
const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supaUrl, supaKey, { auth: { persistSession: false } });

async function saveToStorageFromUrl(path: string, fileUrl: string, contentType = "audio/mpeg") {
  console.log("[suno] Downloading file to store:", fileUrl);
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Failed to download file: ${resp.status} ${resp.statusText}`);
  const buf = await resp.arrayBuffer();
  const { error } = await supabase.storage.from("songs").upload(path, buf, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const pub = supabase.storage.from("songs").getPublicUrl(path);
  console.log("[suno] Stored at:", pub.data.publicUrl);
  return pub.data.publicUrl;
}


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
        console.log("[suno] Callback received:", JSON.stringify(body, null, 2));

        const taskId: string | undefined = body?.data?.task_id || body?.task_id || body?.data?.taskId || body?.taskId;
        const callbackType: string | undefined = body?.data?.callbackType || body?.callbackType;
        const items: any[] = Array.isArray(body?.data?.data)
          ? body.data.data
          : Array.isArray(body?.data)
          ? body.data
          : [];

        if (taskId && items.length > 0) {
          const first = items[0];
          const audioUrl: string | null =
            first.audio_url || first.audioUrl || first.source_audio_url || first.stream_audio_url || null;

          if (audioUrl) {
            const path = `${taskId}.mp3`;
            try {
              const publicUrl = await saveToStorageFromUrl(path, audioUrl, "audio/mpeg");
              console.log("[suno] Saved audio from callback:", { taskId, publicUrl, callbackType });
              return json({ ok: true, taskId, publicUrl });
            } catch (e) {
              console.error("[suno] Failed to store audio:", e);
              // Still return ok so the provider doesn't retry endlessly
              return json({ ok: true, taskId, error: String(e) });
            }
          }
        }
      } catch (e) {
        console.log("[suno] Callback received (non-JSON body)", e);
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
        model: "V4_5PLUS",
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

        // 1) Check if already stored in Supabase Storage (set by webhook)
        try {
          const path = `${jobId}.mp3`;
          const { data: signed, error: signErr } = await supabase.storage
            .from("songs")
            .createSignedUrl(path, 3600);
          if (!signErr && signed?.signedUrl) {
            console.log("[suno] Found stored audio for", jobId);
            return json({ status: "ready", audioUrl: signed.signedUrl });
          }
        } catch (e) {
          console.log("[suno] Storage check error:", e);
        }

        // 2) Fallback to provider polling
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
      console.log("[suno] Poll response data:", JSON.stringify(data, null, 2));
      
      const st: string = data.status || "PENDING";

      if (st === "SUCCESS") {
        // Try multiple possible response structures
        let tracks = [];
        
        // Check if data itself contains the tracks array
        if (Array.isArray(data.response?.data)) {
          tracks = data.response.data;
        } else if (Array.isArray(data.data)) {
          tracks = data.data;
        } else if (Array.isArray(data)) {
          tracks = data;
        }
        
        console.log("[suno] Found tracks:", tracks.length);
        
        if (tracks.length > 0) {
          const track = tracks[0];
          // Try multiple audio URL fields with fallbacks
          const audioUrl = track.audio_url || track.audioUrl || track.source_audio_url || track.stream_audio_url || null;
          console.log("[suno] Extracted audio URL:", audioUrl);
          
          if (!audioUrl) {
            console.error("[suno] No audio URL found in track:", JSON.stringify(track, null, 2));
            return json({ status: "error", error: "No audio URL in response" });
          }
          
          return json({ status: "ready", audioUrl });
        } else {
          console.error("[suno] No tracks found in response");
          return json({ status: "error", error: "No tracks in response" });
        }
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
