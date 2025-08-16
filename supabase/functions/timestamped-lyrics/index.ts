import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    ...init,
  });
}

// API Box (Suno) endpoint per docs:
// https://docs.api.box/suno-api/get-timestamped-lyrics
const API_BASE = "https://api.api.box/api/v1";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const apiKey = Deno.env.get('SUNO_API_KEY');
    if (!apiKey) {
      return json({ error: 'Missing SUNO_API_KEY' }, { status: 500 });
    }

    const requestBody = await req.json().catch(() => ({} as Record<string, unknown>));
    const { taskId, audioId, musicIndex } = requestBody as {
      taskId?: string;
      audioId?: string;
      musicIndex?: number;
    };

    if (!taskId) {
      return json({ error: 'taskId is required' }, { status: 400 });
    }

    // Log inputs for debugging (no secrets)
    console.log('[timestamped-lyrics] Incoming request', {
      hasTaskId: Boolean(taskId),
      hasAudioId: Boolean(audioId),
      musicIndex,
    });

    const body: Record<string, unknown> = { taskId };
    if (audioId) body.audioId = audioId;
    if (typeof musicIndex === 'number') body.musicIndex = musicIndex;

    const upstream = await fetch(`${API_BASE}/generate/get-timestamped-lyrics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    let payload: any = null;
    try {
      payload = await upstream.json();
    } catch (_e) {
      // no-op; keep payload null for error branch
    }

    console.log('[timestamped-lyrics] Upstream response', {
      status: upstream.status,
      ok: upstream.ok,
      code: payload?.code,
      hasData: Boolean(payload?.data),
      alignedCount: Array.isArray(payload?.data?.alignedWords) ? payload.data.alignedWords.length : undefined,
    });

    if (upstream.ok && payload?.code === 200 && payload?.data) {
      const data = payload.data;
      const out = {
        alignedWords: Array.isArray(data.alignedWords) ? data.alignedWords : [],
        waveformData: Array.isArray(data.waveformData) ? data.waveformData : undefined,
        hootCer: typeof data.hootCer === 'number' ? data.hootCer : undefined,
        isStreamed: Boolean(data.isStreamed),
      };
      return json(out, { status: 200 });
    }

    // No fallback: propagate clear error to client
    const status = upstream.status || 502;
    const message = payload?.msg || 'Failed to fetch timestamped lyrics';
    return json({ error: message, details: payload ?? null }, { status });
  } catch (error) {
    console.error('Error in timestamped-lyrics function:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});