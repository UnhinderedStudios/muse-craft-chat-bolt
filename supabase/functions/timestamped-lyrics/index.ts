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

    // Create realistic timestamped lyrics data based on the actual song lyrics
    const mockTimestampedLyrics = {
      alignedWords: [
        {
          word: "Woke",
          success: true,
          start_s: 8.5,
          end_s: 9.0,
          p_align: 0
        },
        {
          word: "up",
          success: true,
          start_s: 9.0,
          end_s: 9.2,
          p_align: 0
        },
        {
          word: "in",
          success: true,
          start_s: 9.2,
          end_s: 9.4,
          p_align: 0
        },
        {
          word: "a",
          success: true,
          start_s: 9.4,
          end_s: 9.6,
          p_align: 0
        },
        {
          word: "mirrored",
          success: true,
          start_s: 9.6,
          end_s: 10.2,
          p_align: 0
        },
        {
          word: "dream",
          success: true,
          start_s: 10.2,
          end_s: 11.0,
          p_align: 0
        },
        {
          word: "Reflections",
          success: true,
          start_s: 12.0,
          end_s: 12.8,
          p_align: 0
        },
        {
          word: "dancing",
          success: true,
          start_s: 12.8,
          end_s: 13.4,
          p_align: 0
        },
        {
          word: "on",
          success: true,
          start_s: 13.4,
          end_s: 13.6,
          p_align: 0
        },
        {
          word: "the",
          success: true,
          start_s: 13.6,
          end_s: 13.8,
          p_align: 0
        },
        {
          word: "wall",
          success: true,
          start_s: 13.8,
          end_s: 14.5,
          p_align: 0
        },
        {
          word: "Everything",
          success: true,
          start_s: 15.5,
          end_s: 16.2,
          p_align: 0
        },
        {
          word: "is",
          success: true,
          start_s: 16.2,
          end_s: 16.4,
          p_align: 0
        },
        {
          word: "not",
          success: true,
          start_s: 16.4,
          end_s: 16.6,
          p_align: 0
        },
        {
          word: "as",
          success: true,
          start_s: 16.6,
          end_s: 16.8,
          p_align: 0
        },
        {
          word: "it",
          success: true,
          start_s: 16.8,
          end_s: 17.0,
          p_align: 0
        },
        {
          word: "seems",
          success: true,
          start_s: 17.0,
          end_s: 17.8,
          p_align: 0
        },
        {
          word: "I",
          success: true,
          start_s: 19.0,
          end_s: 19.2,
          p_align: 0
        },
        {
          word: "hear",
          success: true,
          start_s: 19.2,
          end_s: 19.5,
          p_align: 0
        },
        {
          word: "your",
          success: true,
          start_s: 19.5,
          end_s: 19.8,
          p_align: 0
        },
        {
          word: "distant",
          success: true,
          start_s: 19.8,
          end_s: 20.4,
          p_align: 0
        },
        {
          word: "call",
          success: true,
          start_s: 20.4,
          end_s: 21.2,
          p_align: 0
        },
        {
          word: "Mirrored",
          success: true,
          start_s: 24.0,
          end_s: 24.6,
          p_align: 0
        },
        {
          word: "dreams,",
          success: true,
          start_s: 24.6,
          end_s: 25.2,
          p_align: 0
        },
        {
          word: "where",
          success: true,
          start_s: 25.2,
          end_s: 25.5,
          p_align: 0
        },
        {
          word: "do",
          success: true,
          start_s: 25.5,
          end_s: 25.7,
          p_align: 0
        },
        {
          word: "you",
          success: true,
          start_s: 25.7,
          end_s: 25.9,
          p_align: 0
        },
        {
          word: "go?",
          success: true,
          start_s: 25.9,
          end_s: 26.6,
          p_align: 0
        },
        {
          word: "Shadows",
          success: true,
          start_s: 27.5,
          end_s: 28.1,
          p_align: 0
        },
        {
          word: "flicker,",
          success: true,
          start_s: 28.1,
          end_s: 28.7,
          p_align: 0
        },
        {
          word: "soft",
          success: true,
          start_s: 28.7,
          end_s: 29.0,
          p_align: 0
        },
        {
          word: "and",
          success: true,
          start_s: 29.0,
          end_s: 29.2,
          p_align: 0
        },
        {
          word: "slow",
          success: true,
          start_s: 29.2,
          end_s: 30.0,
          p_align: 0
        },
        {
          word: "Lost",
          success: true,
          start_s: 31.0,
          end_s: 31.4,
          p_align: 0
        },
        {
          word: "between",
          success: true,
          start_s: 31.4,
          end_s: 31.9,
          p_align: 0
        },
        {
          word: "the",
          success: true,
          start_s: 31.9,
          end_s: 32.1,
          p_align: 0
        },
        {
          word: "night",
          success: true,
          start_s: 32.1,
          end_s: 32.5,
          p_align: 0
        },
        {
          word: "and",
          success: true,
          start_s: 32.5,
          end_s: 32.7,
          p_align: 0
        },
        {
          word: "day",
          success: true,
          start_s: 32.7,
          end_s: 33.4,
          p_align: 0
        },
        {
          word: "I",
          success: true,
          start_s: 34.5,
          end_s: 34.7,
          p_align: 0
        },
        {
          word: "chase",
          success: true,
          start_s: 34.7,
          end_s: 35.1,
          p_align: 0
        },
        {
          word: "the",
          success: true,
          start_s: 35.1,
          end_s: 35.3,
          p_align: 0
        },
        {
          word: "light",
          success: true,
          start_s: 35.3,
          end_s: 35.7,
          p_align: 0
        },
        {
          word: "that",
          success: true,
          start_s: 35.7,
          end_s: 35.9,
          p_align: 0
        },
        {
          word: "fades",
          success: true,
          start_s: 35.9,
          end_s: 36.4,
          p_align: 0
        },
        {
          word: "away",
          success: true,
          start_s: 36.4,
          end_s: 37.5,
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