// supabase/functions/analyze-face/index.ts
// Face detection and validation using GPT-4 Vision API

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRequestId(): string {
  return `face_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

Deno.serve(async (req: Request) => {
  const requestId = generateRequestId();
  console.log(`🆔 [${requestId}] Face analysis request started`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight handled`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.error(`❌ [${requestId}] Missing OPENAI_API_KEY`);
      return new Response(
        JSON.stringify({ error: 'Missing OpenAI API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [${requestId}] Environment validation passed`);

    // Parse multipart form data
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      console.error(`❌ [${requestId}] No image file provided`);
      return new Response(
        JSON.stringify({ error: 'No image file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🖼️ [${requestId}] Image file - name: ${imageFile.name}, size: ${imageFile.size}, type: ${imageFile.type}`);

    // Validate image size (max 20MB)
    if (imageFile.size > 20 * 1024 * 1024) {
      console.error(`❌ [${requestId}] Image too large: ${imageFile.size} bytes`);
      return new Response(
        JSON.stringify({ error: 'Image too large (max 20MB)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate image type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(imageFile.type)) {
      console.error(`❌ [${requestId}] Invalid image type: ${imageFile.type}`);
      return new Response(
        JSON.stringify({ error: 'Invalid image type. Please use JPEG, PNG, or WebP.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Data = encodeBase64(new Uint8Array(arrayBuffer));
    const dataUrl = `data:${imageFile.type};base64,${base64Data}`;

    console.log(`✅ [${requestId}] Image converted to base64, analyzing with GPT-4 Vision...`);

    // Analyze image with GPT-4 Vision
    const analysisPrompt = `Analyze this image for face detection. Respond with a JSON object containing:
{
  "faceCount": number (exact count of human or animal faces detected),
  "isQualityGood": boolean (true if faces are clear and well-defined, false if blurry/unclear),
  "hasFace": boolean (true if at least one face is detected),
  "isAnimalFace": boolean (true if any detected faces are animals),
  "isHumanFace": boolean (true if any detected faces are human),
  "reasoning": "brief explanation of the analysis"
}

Requirements:
- Detect both human and animal faces
- Count EXACTLY how many faces are visible
- Assess image quality - faces should be clear and well-defined
- Be strict about quality - reject if faces are too blurry, pixelated, or unclear`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [${requestId}] OpenAI API error: ${response.status} ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Face analysis failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const analysisText = result.choices[0]?.message?.content;

    if (!analysisText) {
      console.error(`❌ [${requestId}] No analysis result from OpenAI`);
      return new Response(
        JSON.stringify({ error: 'No analysis result received' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 [${requestId}] Raw analysis result: ${analysisText}`);

    // Parse the JSON response
    let analysis;
    try {
      // Extract JSON from the response (handle potential markdown formatting)
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : analysisText;
      analysis = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(`❌ [${requestId}] Failed to parse analysis result: ${parseError}`);
      return new Response(
        JSON.stringify({ error: 'Failed to parse analysis result', details: analysisText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 [${requestId}] Parsed analysis:`, analysis);

    // Validation logic
    let accepted = false;
    let rejectionReason = '';

    if (!analysis.hasFace) {
      rejectionReason = 'No face detected in the image';
    } else if (analysis.faceCount > 1) {
      rejectionReason = 'Multiple faces detected - only single face images are allowed';
    } else if (!analysis.isQualityGood) {
      rejectionReason = 'Image quality is too low - face is not clear enough';
    } else if (!analysis.isHumanFace && !analysis.isAnimalFace) {
      rejectionReason = 'No valid human or animal face detected';
    } else {
      accepted = true;
    }

    console.log(`✅ [${requestId}] Face analysis complete - Accepted: ${accepted}, Reason: ${rejectionReason || 'Valid'}`);

    // If accepted, we'll return the image data for use as reference
    const responseData: any = {
      accepted,
      analysis,
      rejectionReason: rejectionReason || null
    };

    if (accepted) {
      responseData.imageData = dataUrl;
      responseData.fileName = imageFile.name;
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`💥 [${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});