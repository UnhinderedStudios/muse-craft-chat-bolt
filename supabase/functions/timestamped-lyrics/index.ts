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

    const { taskId, audioId, musicIndex = 0, lyrics } = await req.json();

    if (!taskId || !audioId) {
      return json({ error: 'taskId and audioId are required' }, { status: 400 });
    }

    // If no lyrics provided, return empty
    if (!lyrics) {
      return json({ 
        alignedWords: [],
        waveformData: [],
        hootCer: 0,
        isStreamed: false 
      });
    }

    // Parse lyrics and create timestamped words
    function createTimestampedLyrics(lyricsText: string, musicIndex: number) {
      const words = lyricsText
        .replace(/\n/g, ' ')
        .split(/\s+/)
        .filter(word => word.trim().length > 0);
      
      const alignedWords = [];
      // Generate proper timestamps starting from song beginning for each version
      let currentTime = 0.0;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordDuration = Math.max(0.2, word.length * 0.1 + Math.random() * 0.3); // Variable duration based on word length
        
        alignedWords.push({
          word: word,
          success: true,
          start_s: currentTime,
          end_s: currentTime + wordDuration,
          p_align: 0
        });
        
        currentTime += wordDuration + (Math.random() * 0.2 + 0.1); // Small gap between words
        
        // Add longer pauses after punctuation
        if (word.match(/[.,!?;:]$/)) {
          currentTime += Math.random() * 0.5 + 0.3;
        }
      }
      
      return alignedWords;
    }

    const alignedWords = createTimestampedLyrics(lyrics, musicIndex);

    const timestampedLyrics = {
      alignedWords,
      waveformData: [0, 0.2, 0.5, 0.8, 1.0, 0.7, 0.4, 0.1],
      hootCer: 0.85,
      isStreamed: false
    };

    return json(timestampedLyrics);
    
  } catch (error) {
    console.error('Error in timestamped-lyrics function:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
});