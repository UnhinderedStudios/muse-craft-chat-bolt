import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, voice } = await req.json()

    if (!text) {
      throw new Error('Text is required')
    }

    console.log('Converting text to speech:', text.substring(0, 100) + '...')

    // Generate speech from text
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice || 'alloy',
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      let errBody: any = null;
      try {
        errBody = await response.json();
      } catch (_) {
        try {
          errBody = await response.text();
        } catch (_) {
          errBody = null;
        }
      }

      console.error('OpenAI TTS API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errBody,
      });

      const message =
        (errBody && (errBody.error?.message || errBody.message)) ||
        `Failed to generate speech (status ${response.status})`;
      throw new Error(message);
    }

    // Convert audio buffer to base64 safely
    const arrayBuffer = await response.arrayBuffer()
    const base64Audio = base64Encode(new Uint8Array(arrayBuffer))

    console.log('Text-to-speech conversion successful')

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in text-to-speech function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})