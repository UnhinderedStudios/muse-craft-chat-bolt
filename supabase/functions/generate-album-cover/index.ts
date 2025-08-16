import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("GEMINI_API_KEY available:", !!geminiApiKey);
    console.log("SUPABASE_URL available:", !!supabaseUrl);
    console.log("SUPABASE_SERVICE_ROLE_KEY available:", !!supabaseServiceKey);
    
    if (!geminiApiKey) {
      console.error("Missing GEMINI_API_KEY in environment");
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase credentials in environment");
      return new Response(JSON.stringify({ error: "Missing Supabase credentials" }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Initialize Supabase client with service role key for storage access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("Generating album cover with prompt:", prompt);

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict",
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1", // Square aspect ratio for album covers
            personGeneration: "dont_allow", // Ensure no humans as requested
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error (Imagen 4 Fast):", response.status, errorText);
      return new Response(JSON.stringify({ error: `Gemini API error (${response.status}): ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    // Support multiple possible response shapes
    const imageData =
      data?.generatedImages?.[0]?.generatedImage?.imageBytes ||
      data?.generatedImages?.[0]?.image?.imageBytes ||
      data?.predictions?.[0]?.bytesBase64Encoded ||
      data?.predictions?.[0]?.image?.imageBytes;

    if (!imageData) {
      console.error("No images generated or unexpected response shape:", data);
      return new Response(JSON.stringify({ error: "No images generated" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("Successfully received image data from Imagen API");

    // Convert base64 to bytes
    const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    console.log("Converted image data to bytes, size:", imageBytes.length);

    // Generate unique filename with current date
    const now = new Date();
    const dateFolder = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const uuid = crypto.randomUUID();
    const filename = `album-covers/${dateFolder}/${uuid}.png`;

    console.log("Uploading to Supabase Storage, path:", filename);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('songs')
      .upload(filename, imageBytes, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error("Supabase Storage upload error:", uploadError);
      return new Response(JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("Successfully uploaded to storage:", uploadData.path);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('songs')
      .getPublicUrl(filename);

    const imageUrl = urlData.publicUrl;
    console.log("Generated public URL:", imageUrl);

    return new Response(JSON.stringify({
      success: true,
      imageUrl // Public URL to the stored image
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Error in generate-album-cover function:", error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});