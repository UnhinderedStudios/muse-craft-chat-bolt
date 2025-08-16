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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 });
    }

    const { taskId, audioId, musicIndex = 0 } = await req.json();

    if (!taskId || !audioId) {
      return json({ error: 'taskId and audioId are required' }, { status: 400 });
    }

    // For now, return mock timestamped lyrics data
    // In a real implementation, you'd call the actual API Box endpoint
    const mockTimestampedLyrics = {
      alignedWords: [
        {
          word: "[Verse]\nIn the quiet of the night",
          success: true,
          start_s: 0.5,
          end_s: 2.8,
          p_align: 0
        },
        {
          word: "Stars are shining bright",
          success: true,
          start_s: 3.0,
          end_s: 5.2,
          p_align: 0
        },
        {
          word: "Dreams take flight",
          success: true,
          start_s: 5.5,
          end_s: 7.1,
          p_align: 0
        },
        {
          word: "[Chorus]\nSing with me tonight",
          success: true,
          start_s: 8.0,
          end_s: 10.5,
          p_align: 0
        },
        {
          word: "Everything's alright",
          success: true,
          start_s: 11.0,
          end_s: 13.2,
          p_align: 0
        },
        {
          word: "In this moment of light",
          success: true,
          start_s: 13.8,
          end_s: 16.0,
          p_align: 0
        }
      ],
      waveformData: [0, 0.2, 0.5, 0.8, 1.0, 0.7, 0.4, 0.1],
      hootCer: 0.85,
      isStreamed: false
    };

    return json(mockTimestampedLyrics);
    
  } catch (error) {
    console.error('Error in timestamped-lyrics function:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});