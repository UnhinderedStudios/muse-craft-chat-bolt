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
    // Try both GEMINI_API_KEY and GOOGLE_API_KEY
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("GEMINI_API_KEY available:", !!Deno.env.get("GEMINI_API_KEY"));
    console.log("GOOGLE_API_KEY available:", !!Deno.env.get("GOOGLE_API_KEY"));
    console.log("Using API key:", !!geminiApiKey);
    console.log("SUPABASE_URL available:", !!supabaseUrl);
    console.log("SUPABASE_SERVICE_ROLE_KEY available:", !!supabaseServiceKey);

    const reqBody = await req.json().catch(() => ({}));
    
    // Health check endpoint
    if (reqBody.health) {
      return new Response(JSON.stringify({
        health: "ok",
        apiKey: !!geminiApiKey,
        geminiKey: !!Deno.env.get("GEMINI_API_KEY"),
        googleKey: !!Deno.env.get("GOOGLE_API_KEY"),
        supabaseUrl: !!supabaseUrl,
        serviceKey: !!supabaseServiceKey
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (!geminiApiKey) {
      console.error("Missing GEMINI_API_KEY and GOOGLE_API_KEY in environment");
      return new Response(JSON.stringify({ error: "Missing API key (tried GEMINI_API_KEY and GOOGLE_API_KEY)" }), { 
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

    const { prompt } = reqBody;
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
            sampleCount: 2, // Generate 2 images for album covers
            aspectRatio: "1:1", // Square aspect ratio for album covers
            personGeneration: "dont_allow", // Ensure no humans as requested
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error (Imagen 4 Fast):", response.status, errorText);
      console.error("Request details:", { prompt, method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': '***' } });
      return new Response(JSON.stringify({ error: `Gemini API error (${response.status}): ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    console.log("Raw Imagen response structure:", JSON.stringify(data, null, 2));

    // Extract both images from response
    const generatedImages = data?.generatedImages || data?.predictions || [];
    
    if (!generatedImages || generatedImages.length === 0) {
      console.error("No images generated or unexpected response shape:", data);
      return new Response(JSON.stringify({ error: "No images generated" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Successfully received ${generatedImages.length} images from Imagen API`);

    const coverUrls = [];
    
    // Process each generated image
    for (let i = 0; i < generatedImages.length; i++) {
      const imageItem = generatedImages[i];
      const imageData = 
        imageItem?.generatedImage?.imageBytes ||
        imageItem?.image?.imageBytes ||
        imageItem?.bytesBase64Encoded ||
        imageItem?.imageBytes;

      if (!imageData) {
        console.warn(`No image data found for image ${i + 1}`);
        continue;
      }

      try {
        // Convert base64 to bytes
        const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
        console.log(`Image ${i + 1}: Converted to bytes, size:`, imageBytes.length);

        // Generate unique filename with current date
        const now = new Date();
        const dateFolder = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const uuid = crypto.randomUUID();
        const filename = `album-covers/${dateFolder}/${uuid}-${i + 1}.png`;

        console.log(`Image ${i + 1}: Uploading to Supabase Storage, path:`, filename);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('songs')
          .upload(filename, imageBytes, {
            contentType: 'image/png',
            upsert: false
          });

        if (uploadError) {
          console.error(`Image ${i + 1}: Supabase Storage upload error:`, uploadError);
          continue;
        }

        console.log(`Image ${i + 1}: Successfully uploaded to storage:`, uploadData.path);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('songs')
          .getPublicUrl(filename);

        const imageUrl = urlData.publicUrl;
        console.log(`Image ${i + 1}: Generated public URL:`, imageUrl);
        
        coverUrls.push(imageUrl);
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
      }
    }

    if (coverUrls.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to upload any images" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Successfully generated ${coverUrls.length} album covers:`, coverUrls);

    return new Response(JSON.stringify({
      success: true,
      coverUrls // Array of public URLs to the stored images
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