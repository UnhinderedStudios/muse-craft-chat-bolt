// Supabase Edge Function: suno
// Suno via API Box - start generation and poll status
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.api.box/api/v1"; // API Box Suno endpoint
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


function sanitizeStyleServer(style: string): string {
  try {
    let s = String(style || "");
    const MAP: Record<string, string> = {
      "ed sheeran": "acoustic pop, warm intimate male vocals, fingerpicked acoustic guitar, minimal production, 70-90 BPM",
    };
    for (const [name, desc] of Object.entries(MAP)) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "gi");
      s = s.replace(re, desc);
    }
    s = s.replace(/\b(in the style of|like|sounds like|similar to|inspired by)\b[^,;.]+/gi, "");
    s = s.replace(/\bby\s+[A-Za-z0-9 .,'-]+\b/gi, "");
    s = s.replace(/\s{2,}/g, " ")
         .replace(/\s*,\s*/g, ", ")
         .replace(/,\s*,/g, ", ")
         .replace(/^,|,$/g, "")
         .trim();
    return s;
  } catch {
    return String(style || "");
  }
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
          const savedUrls: string[] = [];
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const audioUrl: string | null =
              it.audio_url || it.audioUrl || it.source_audio_url || it.sourceAudioUrl || it.stream_audio_url || it.streamAudioUrl || it.source_stream_audio_url || it.sourceStreamAudioUrl || null;

            if (audioUrl) {
              // Keep first version backward-compatible at {taskId}.mp3, subsequent as {taskId}_2.mp3, etc.
              const indexSuffix = i === 0 ? "" : `_${i + 1}`;
              const path = `${taskId}${indexSuffix}.mp3`;
              try {
                const publicUrl = await saveToStorageFromUrl(path, audioUrl, "audio/mpeg");
                savedUrls.push(publicUrl);
              } catch (e) {
                console.error("[suno] Failed to store audio (callback item):", e);
              }
            }
          }

          if (savedUrls.length > 0) {
            console.log("[suno] Saved audio from callback:", { taskId, publicUrls: savedUrls, callbackType });
            return json({ ok: true, taskId, callbackType, publicUrls: savedUrls });
          }
        }
      } catch (e) {
        console.log("[suno] Callback received (non-JSON body)", e);
      }
      return json({ ok: true });
    }

    if (req.method === "POST" && !pathname.endsWith("/wav") && !pathname.endsWith("/callback")) {
      const details = await req.json().catch(() => ({} as any));

      // Expect unified fields: style (string) and lyrics (string). Title optional.
      const rawTitle: string | undefined = details.title?.toString();
      const title = rawTitle ? rawTitle.slice(0, 80) : undefined;

      const unifiedStyle: string = (details.style?.toString() || "").trim();
      const fallbackStyleParts = [
        details.genre?.toString(),
        details.mood?.toString(),
        details.tempo?.toString(),
        details.language?.toString(),
        details.vocals?.toString(),
      ].filter(Boolean) as string[];
      const styleRaw = (unifiedStyle || fallbackStyleParts.join(", "));
      const style = sanitizeStyleServer(styleRaw).slice(0, 200);

      const lyrics: string = (details.lyrics?.toString() || "").trim();

      if (!lyrics) {
        return json({ error: "Missing lyrics. Please provide lyrics for custom generation." }, { status: 400 });
      }

      const body: Record<string, unknown> = {
        prompt: lyrics,            // API expects lyrics in 'prompt' when customMode=true
        style,                     // Unified style string per docs
        title,                     // Optional
        customMode: true,
        instrumental: false,       // Since lyrics provided
        model: "V4_5PLUS",
        callBackUrl: `${SUPABASE_URL}/functions/v1/suno/callback`,
      };

      console.log("[suno] Starting generation (unified)", { hasLyrics: !!lyrics, styleLength: style.length, pathname });

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

    // Handle WAV conversion with retry logic and callback support
    if (req.method === "POST" && pathname.endsWith("/wav")) {
      const details = await req.json().catch(() => ({} as any));
      let audioId: string | undefined = details.audioId;
      const taskId: string | undefined = details.taskId;
      const musicIndex: number | undefined = typeof details.musicIndex === 'number' ? details.musicIndex : undefined;

      if (!audioId && !taskId) {
        return json({ error: "Missing audioId or taskId" }, { status: 400 });
      }

      // If audioId is missing but taskId is provided, resolve the provider track id from taskId
      if (!audioId && taskId) {
        try {
          console.log("[suno] Resolving audioId from taskId before WAV generate", { taskId, musicIndex });
          const statusResp = await fetch(`${API_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          });
          const statusJson = await statusResp.json().catch(() => ({}));

          if (statusResp.ok && typeof statusJson?.data !== "undefined") {
            const data = statusJson.data as any;
            // Normalize possible track arrays
            let tracks: any[] = [];
            if (Array.isArray(data.response?.data)) {
              tracks = data.response.data;
            } else if (Array.isArray(data.response?.sunoData)) {
              tracks = data.response.sunoData;
            } else if (Array.isArray(data.sunoData)) {
              tracks = data.sunoData;
            } else if (Array.isArray(data.data)) {
              tracks = data.data;
            } else if (Array.isArray(data)) {
              tracks = data;
            }

            const idx = typeof musicIndex === 'number' && musicIndex >= 0 && musicIndex < tracks.length ? musicIndex : 0;
            const candidate = tracks[idx] || tracks[0];
            const resolved = candidate?.id || candidate?.audio_id || candidate?.audioId;
            if (resolved) {
              audioId = String(resolved);
              console.log("[suno] Resolved audioId from taskId:", { taskId, resolved: audioId, idx, total: tracks.length });
            } else {
              console.warn("[suno] Could not resolve audioId from taskId; proceeding with taskId only");
            }
          } else {
            const msg = statusJson?.msg || (await statusResp.text().catch(() => "")) || statusResp.statusText;
            console.warn("[suno] record-info did not return data while resolving audioId:", msg);
          }
        } catch (e) {
          console.warn("[suno] Failed to resolve audioId from taskId:", e);
        }
      }

      // Try different parameter combinations until one works. Start with official fields per docs.
      const attempts = [
        // Attempt 1: Official params exactly as documented + callback
        () => {
          const body: Record<string, unknown> = {};
          if (audioId) body.audioId = audioId;
          if (taskId) body.taskId = taskId;
          if (typeof musicIndex === 'number') body.musicIndex = musicIndex;
          body.callBackUrl = `${SUPABASE_URL}/functions/v1/suno/wav/callback`;
          console.log(`[suno] WAV attempt 1 (official + callback) params:`, { audioId, taskId, musicIndex, callBackUrl: body.callBackUrl });
          return body;
        },
        // Attempt 2: Use 'id' instead of audioId + callback
        () => {
          const body: Record<string, unknown> = {};
          if (audioId) body.id = audioId;
          if (taskId) body.taskId = taskId;
          if (typeof musicIndex === 'number') body.musicIndex = musicIndex;
          body.callBackUrl = `${SUPABASE_URL}/functions/v1/suno/wav/callback`;
          console.log(`[suno] WAV attempt 2 (id + callback) params:`, { id: audioId, taskId, musicIndex, callBackUrl: body.callBackUrl });
          return body;
        },
        // Attempt 3: musicId alias + callback
        () => {
          const body: Record<string, unknown> = {};
          if (audioId) body.musicId = audioId;
          if (taskId) body.taskId = taskId;
          if (typeof musicIndex === 'number') body.musicIndex = musicIndex;
          body.callBackUrl = `${SUPABASE_URL}/functions/v1/suno/wav/callback`;
          console.log(`[suno] WAV attempt 3 (musicId + callback) params:`, { musicId: audioId, taskId, musicIndex, callBackUrl: body.callBackUrl });
          return body;
        },
        // Attempt 4: index instead of musicIndex + callback
        () => {
          const body: Record<string, unknown> = {};
          if (audioId) body.audioId = audioId;
          if (taskId) body.taskId = taskId;
          if (typeof musicIndex === 'number') body.index = musicIndex;
          body.callBackUrl = `${SUPABASE_URL}/functions/v1/suno/wav/callback`;
          console.log(`[suno] WAV attempt 4 (index + callback) params:`, { audioId, taskId, index: musicIndex, callBackUrl: body.callBackUrl });
          return body;
        },
        // Attempt 5: snake_case variants + callback
        () => {
          const body: Record<string, unknown> = {};
          if (audioId) body.music_id = audioId;
          if (taskId) body.task_id = taskId;
          if (typeof musicIndex === 'number') body.music_index = musicIndex;
          body.callBackUrl = `${SUPABASE_URL}/functions/v1/suno/wav/callback`;
          console.log(`[suno] WAV attempt 5 (snake_case + callback) params:`, { music_id: audioId, task_id: taskId, music_index: musicIndex, callBackUrl: body.callBackUrl });
          return body;
        }
      ];

      let lastError = "Unknown error";
      for (let i = 0; i < attempts.length; i++) {
        const body = attempts[i]();
        console.log(`[suno] WAV conversion attempt ${i + 1}:`, body);

        try {
          const wavResp = await fetch(`${API_BASE}/wav/generate`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          const wavJson = await wavResp.json().catch(() => ({}));
          console.log(`[suno] WAV attempt ${i + 1} response:`, {
            status: wavResp.status,
            ok: wavResp.ok,
            code: wavJson?.code,
            data: wavJson?.data,
            msg: wavJson?.msg,
          });

          if (wavResp.ok && wavJson?.code === 200) {
            const wavJobId = wavJson?.data?.taskId;
            if (!wavJobId) return json({ error: "No WAV taskId returned" }, { status: 500 });
            console.log(`[suno] WAV conversion started successfully on attempt ${i + 1}`);
            return json({ jobId: wavJobId });
          }

          const msg = wavJson?.msg || (await wavResp.text().catch(() => "")) || wavResp.statusText;
          lastError = msg;
          console.log(`[suno] WAV attempt ${i + 1} failed:`, msg);

          // If it's a missing record/id style error, try next permutation; otherwise fail fast
          if (msg.toLowerCase().includes("record does not exist") ||
              msg.toLowerCase().includes("music id") ||
              msg.toLowerCase().includes("not found")) {
            continue;
          } else {
            return json({ error: msg }, { status: 500 });
          }
        } catch (networkError) {
          lastError = `Network error: ${networkError}`;
          console.log(`[suno] WAV attempt ${i + 1} network error:`, networkError);
        }
      }

      console.error("[suno] All WAV conversion attempts failed");
      return json({ error: `WAV conversion failed after ${attempts.length} attempts. Last error: ${lastError}` }, { status: 500 });
    }

    // Handle WAV callback
    if (req.method === "POST" && pathname.endsWith("/wav/callback")) {
      try {
        const body = await req.json();
        console.log("[suno] WAV callback received:", JSON.stringify(body, null, 2));

        const wavJobId: string | undefined = body?.data?.taskId || body?.taskId || body?.data?.task_id || body?.task_id;
        const wavUrl: string | undefined = body?.data?.wav_url || body?.data?.wavUrl || body?.data?.file_url || body?.data?.fileUrl || 
                                          body?.data?.download_url || body?.data?.downloadUrl || body?.wav_url || body?.wavUrl || 
                                          body?.file_url || body?.fileUrl || body?.download_url || body?.downloadUrl;
        
        if (wavJobId && wavUrl) {
          try {
            // Save WAV to storage with callback identifier
            const wavPath = `wav/${wavJobId}.wav`;
            const publicUrl = await saveToStorageFromUrl(wavPath, wavUrl, "audio/wav");
            console.log("[suno] WAV saved from callback:", { wavJobId, publicUrl });
            return json({ ok: true, wavJobId, publicUrl });
          } catch (e) {
            console.error("[suno] Failed to save WAV from callback:", e);
            return json({ ok: false, error: "Failed to save WAV file" });
          }
        } else {
          console.log("[suno] WAV callback missing required fields:", { wavJobId, wavUrl });
        }
      } catch (e) {
        console.log("[suno] WAV callback received (non-JSON body):", e);
      }
      return json({ ok: true });
    }

    // Handle WAV status polling with enhanced storage check
    if (req.method === "GET" && pathname.endsWith("/wav")) {
      const wavJobId = url.searchParams.get("jobId") || url.searchParams.get("taskId");
      if (!wavJobId) return json({ error: "Missing WAV jobId or taskId" }, { status: 400 });

      console.log("[suno] WAV polling for jobId:", wavJobId);

      // First priority: Check if already stored in Supabase Storage (from callback)
      try {
        const wavPath = `wav/${wavJobId}.wav`;
        const { data: signed, error: signErr } = await supabase.storage
          .from("songs")
          .createSignedUrl(wavPath, 3600);
        if (!signErr && signed?.signedUrl) {
          const pub = supabase.storage.from("songs").getPublicUrl(wavPath);
          const publicUrl = pub.data.publicUrl || signed.signedUrl;
          console.log("[suno] Found stored WAV for", wavJobId, publicUrl);
          return json({ status: "ready", wavUrl: publicUrl });
        }
      } catch (e) {
        console.log("[suno] WAV storage check error:", e);
      }

      // Second priority: Poll WAV conversion status from provider
      const statusResp = await fetch(`${API_BASE}/wav/record-info?taskId=${encodeURIComponent(wavJobId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const statusJson = await statusResp.json().catch(() => ({}));
      
      console.log("[suno] WAV polling response:", {
        status: statusResp.status,
        ok: statusResp.ok,
        data: statusJson?.data,
        msg: statusJson?.msg
      });

      if (!statusResp.ok || typeof statusJson?.data === "undefined") {
        const msg = statusJson?.msg || (await statusResp.text().catch(() => "")) || statusResp.statusText;
        console.error("[suno] WAV status error:", msg);
        return json({ status: "error", error: msg });
      }

      const data = statusJson.data as any;
      const st: string = String(data.status || data.taskStatus || "PENDING").toUpperCase();
      console.log("[suno] WAV job status:", st);
      
      if (st.includes("SUCCESS") || st.includes("COMPLETE")) {
        // Extract WAV URL from various possible fields
        const wavUrl = data.wav_url || data.wavUrl || data.file_url || data.fileUrl || 
                      data.download_url || data.downloadUrl || data.audio_url || data.audioUrl ||
                      data.response?.wav_url || data.response?.wavUrl || 
                      data.response?.file_url || data.response?.fileUrl;
        
        console.log("[suno] WAV conversion complete, wavUrl:", wavUrl);
        
        if (wavUrl) {
          try {
            // Save WAV to storage
            const wavPath = `wav/${wavJobId}.wav`;
            const publicUrl = await saveToStorageFromUrl(wavPath, wavUrl, "audio/wav");
            return json({ status: "ready", wavUrl: publicUrl });
          } catch (e) {
            console.error("[suno] Failed to save WAV to storage:", e);
            return json({ status: "error", error: "Failed to save WAV file" });
          }
        } else {
          console.warn("[suno] WAV conversion complete but no WAV URL found");
          return json({ status: "error", error: "No WAV URL in response" });
        }
      }
      
      if (st.includes("FAIL") || st.includes("ERROR")) {
        const err = data.errorMessage || data.status || "WAV conversion failed";
        console.error("[suno] WAV conversion failed:", err);
        return json({ status: "error", error: err });
      }

      console.log("[suno] WAV conversion still pending");
      return json({ status: "pending" });
    }

      if (req.method === "GET") {
        const jobId = url.searchParams.get("jobId");
        const detailsParam = url.searchParams.get("details");
        if (!jobId) return json({ error: "Missing jobId" }, { status: 400 });

        // 1) Check if already stored in Supabase Storage (set by webhook)
        try {
          const candidates = [`${jobId}.mp3`, `${jobId}_2.mp3`];
          const found: string[] = [];
          for (const path of candidates) {
            const { data: signed, error: signErr } = await supabase.storage
              .from("songs")
              .createSignedUrl(path, 3600);
            if (!signErr && signed?.signedUrl) {
              const pub = supabase.storage.from("songs").getPublicUrl(path);
              const publicUrl = pub.data.publicUrl || signed.signedUrl;
              found.push(publicUrl);
            }
          }
          if (found.length > 0 && !detailsParam) {
            console.log("[suno] Found stored audio for", jobId, found);
            return json({ status: "ready", audioUrl: found[0], audioUrls: found });
          }
        } catch (e) {
          console.log("[suno] Storage check error:", e);
        }

        // 2) Poll provider for status
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
      const st: string = String(data.status || data.taskStatus || "PENDING").toUpperCase();
      
      // If details=true, return detailed response with statusRaw and tracks
      if (detailsParam) {
        console.log("[suno] Details requested, returning raw data");
        
        // Normalize possible track arrays
        let tracks: any[] = [];
        if (Array.isArray(data.response?.data)) {
          tracks = data.response.data;
        } else if (Array.isArray(data.response?.sunoData)) {
          tracks = data.response.sunoData;
        } else if (Array.isArray(data.sunoData)) {
          tracks = data.sunoData;
        } else if (Array.isArray(data.data)) {
          tracks = data.data;
        } else if (Array.isArray(data)) {
          tracks = data;
        }

        // Extract sunoData with real audioId and musicIndex for timestamps
        const sunoData = tracks.map((track, index) => {
          const realId = track.id || track.audio_id || track.audioId;
          console.log(`[suno] Track ${index}: Original ID = ${realId}, Full track data:`, JSON.stringify(track, null, 2));
          
          return {
            id: realId || `missing_${index}`,
            audioUrl: track.audio_url || track.audioUrl || track.source_audio_url || track.sourceAudioUrl || track.stream_audio_url || track.streamAudioUrl || track.source_stream_audio_url || track.sourceStreamAudioUrl || "",
            musicIndex: index,
          };
        });

        return json({
          response: {
            sunoData
          },
          statusRaw: st,
          taskId: jobId
        });
      }
      
      console.log("[suno] Poll response data:", JSON.stringify(data, null, 2));

      // Treat various provider success markers as success
      if (st.includes("SUCCESS") || st.includes("COMPLETE")) {
        // Normalize possible track arrays
        let tracks: any[] = [];
        if (Array.isArray(data.response?.data)) {
          tracks = data.response.data;
        } else if (Array.isArray(data.response?.sunoData)) {
          tracks = data.response.sunoData;
        } else if (Array.isArray(data.sunoData)) {
          tracks = data.sunoData;
        } else if (Array.isArray(data.data)) {
          tracks = data.data;
        } else if (Array.isArray(data)) {
          tracks = data;
        }

        console.log("[suno] Found tracks:", tracks.length);

        if (tracks.length > 0) {
          const saved: string[] = [];
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            // Try multiple audio URL fields with fallbacks
            const audioUrl =
              track.audio_url || track.audioUrl || track.source_audio_url || track.sourceAudioUrl || track.stream_audio_url || track.streamAudioUrl || track.source_stream_audio_url || track.sourceStreamAudioUrl || null;
            console.log("[suno] Extracted audio URL:", audioUrl);

            if (!audioUrl) {
              console.warn("[suno] Success state but missing audio URL for a track; skipping save.");
              continue;
            }

            // Save to storage so frontend streams from Supabase
            try {
              const path = i === 0 ? `${jobId}.mp3` : `${jobId}_${i + 1}.mp3`;
              const publicUrl = await saveToStorageFromUrl(path, audioUrl, "audio/mpeg");
              saved.push(publicUrl);
            } catch (e) {
              console.error("[suno] Failed to save audio to storage, will retry on next poll:", e);
            }
          }

          if (saved.length > 0) {
            return json({ status: "ready", audioUrl: saved[0], audioUrls: saved });
          }

          // If no URLs could be saved yet, keep polling
          return json({ status: "pending" });
        } else {
          console.warn("[suno] Success state but no tracks yet. Will keep polling.");
          return json({ status: "pending" });
        }
      }
      if (st.includes("FAIL") || st.includes("ERROR") || st === "SENSITIVE_WORD_ERROR" || st === "CREATE_TASK_FAILED") {
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
