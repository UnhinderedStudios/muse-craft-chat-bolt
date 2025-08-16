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

    const { taskId, audioId, musicIndex = 0 } = await req.json();

    if (!taskId || !audioId) {
      return json({ error: 'taskId and audioId are required' }, { status: 400 });
    }

    // Proxy to API Box - Get Timestamped Lyrics for a specific version (musicIndex)
    const upstream = await fetch(`${API_BASE}/generate/get-timestamped-lyrics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId, audioId, musicIndex }),
    });

    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok || payload?.code !== 200) {
      const msg = payload?.msg || upstream.statusText || 'Bad upstream response';
      console.error('[timestamped-lyrics] Upstream error:', msg, payload);
      return json({ error: msg }, { status: 502 });
    }

    const data = payload.data || {};
    // Normalize the response to our frontend shape
    const out = {
      alignedWords: Array.isArray(data.alignedWords) ? data.alignedWords : [],
      waveformData: Array.isArray(data.waveformData) ? data.waveformData : [],
      hootCer: typeof data.hootCer === 'number' ? data.hootCer : undefined,
      isStreamed: Boolean(data.isStreamed),
    };

    return json(out);
  } catch (error) {
    console.error('Error in timestamped-lyrics function:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});