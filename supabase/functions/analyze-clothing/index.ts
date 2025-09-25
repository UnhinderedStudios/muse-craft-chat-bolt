import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🔍 [${requestId}] Starting clothing analysis request`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate OpenAI API key
    if (!openAIApiKey) {
      console.error(`❌ [${requestId}] OpenAI API key not configured`);
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      console.error(`❌ [${requestId}] No image file provided`);
      return new Response(
        JSON.stringify({ error: 'No image file provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📁 [${requestId}] Processing clothing image:`, {
      name: imageFile.name,
      type: imageFile.type,
      size: imageFile.size
    });

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      console.error(`❌ [${requestId}] File too large: ${imageFile.size} bytes`);
      return new Response(
        JSON.stringify({ error: 'File size too large (max 20MB)' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(imageFile.type)) {
      console.error(`❌ [${requestId}] Invalid file type: ${imageFile.type}`);
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Convert image to base64 data URL
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Data = encodeBase64(new Uint8Array(arrayBuffer));
    const imageData = `data:${imageFile.type};base64,${base64Data}`;

    console.log(`🔍 [${requestId}] Sending clothing analysis to GPT-4 Vision`);

    // Analyze the clothing with GPT-4 Vision
    const prompt = `Analyze this image for clothing validation. Return ONLY a valid JSON object with this exact structure:

{
  "hasClothing": boolean,
  "clothingCount": number,
  "isClothingClear": boolean,
  "primaryClothingType": string,
  "isValidClothing": boolean
}

Validation criteria:
1. hasClothing: Must contain at least one clothing item (shirts, pants, dresses, jackets, etc.)
2. clothingCount: Count of prominent clothing items (1 is ideal, 2+ may be acceptable if one is clearly primary)
3. isClothingClear: The clothing item must be clear, well-lit, and in focus (not blurry or obscured)
4. primaryClothingType: Name the main clothing item (e.g., "t-shirt", "dress", "jacket")
5. isValidClothing: True only if: hasClothing=true, isClothingClear=true, and clothingCount is reasonable (1-2)

Reject if:
- No clothing items visible
- Image is too blurry/unclear to see clothing details
- Multiple unrelated clothing items without a clear primary focus
- Image shows accessories only (jewelry, bags, shoes without clothing)
- Image shows people wearing clothes but clothes aren't the focus

RESPOND ONLY WITH THE JSON OBJECT, NO OTHER TEXT.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: imageData,
                  detail: 'high'
                } 
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      console.error(`❌ [${requestId}] OpenAI API error:`, openaiResponse.status, errorData);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${openaiResponse.status}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const openaiData = await openaiResponse.json();
    const analysisText = openaiData.choices[0]?.message?.content;
    console.log(`🔍 [${requestId}] Raw analysis result: ${analysisText}`);

    // Parse the JSON response (handle potential markdown formatting)
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

    console.log(`🔍 [${requestId}] Parsed clothing analysis:`, analysis);

    // Validate the analysis structure
    const requiredFields = ['hasClothing', 'clothingCount', 'isClothingClear', 'primaryClothingType', 'isValidClothing'];
    for (const field of requiredFields) {
      if (!(field in analysis)) {
        console.error(`❌ [${requestId}] Missing required field in analysis: ${field}`);
        return new Response(
          JSON.stringify({ error: `Invalid analysis response: missing ${field}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Determine if the clothing is accepted
    const accepted = analysis.isValidClothing === true;
    
    // Generate rejection reason if not accepted
    let rejectionReason = '';
    if (!accepted) {
      if (!analysis.hasClothing) {
        rejectionReason = 'No clothing items detected in the image.';
      } else if (!analysis.isClothingClear) {
        rejectionReason = 'The clothing item is not clear enough or too blurry.';
      } else if (analysis.clothingCount > 2) {
        rejectionReason = 'Too many clothing items detected. Please focus on one main clothing item.';
      } else {
        rejectionReason = 'The image does not meet the clothing validation criteria.';
      }
    }

    console.log(`✅ [${requestId}] Clothing analysis complete:`, {
      accepted,
      rejectionReason,
      primaryClothingType: analysis.primaryClothingType
    });

    // Prepare response
    const response = {
      accepted,
      analysis,
      rejectionReason: rejectionReason || undefined,
      // Include image data only if accepted
      ...(accepted && {
        imageData,
        fileName: imageFile.name
      })
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Unexpected error in clothing analysis:`, error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});