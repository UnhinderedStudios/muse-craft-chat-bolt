// supabase/functions/generate-artist-image/index.ts
// Edge function for generating artist images using Gemini 2.5 Flash
// deno-lint-ignore-file no-explicit-any

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Generate unique request ID for tracking
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json"
};

Deno.serve(async (req: Request) => {
  // Generate unique request ID for tracking
  const requestId = generateRequestId();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    console.log(`🆔 [${requestId}] Artist Generator request started`);
    
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) {
      console.error(`❌ [${requestId}] Missing GEMINI_API_KEY`);
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY", requestId }),
        { status: 500, headers: CORS }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let prompt = "";
    let imageData = "";
    
    console.log(`📥 [${requestId}] Content-Type: ${contentType}`);

    // Handle multipart form data for image uploads
    if (contentType.includes("multipart/form-data")) {
      console.log(`📤 [${requestId}] Processing multipart form data`);
      try {
        const formData = await req.formData();
        prompt = (formData.get("prompt") as string) || "";
        const imageFile = formData.get("image") as File;
        
        console.log(`📝 [${requestId}] Form data - prompt: "${prompt}", hasImage: ${!!imageFile}`);
        
        if (imageFile) {
          console.log(`🖼️ [${requestId}] Image file - name: ${imageFile.name}, size: ${imageFile.size}, type: ${imageFile.type}`);
          
          // Check file size (limit to 10MB)
          if (imageFile.size > 10 * 1024 * 1024) {
            console.error(`❌ [${requestId}] File too large: ${imageFile.size} bytes`);
            return new Response(
              JSON.stringify({ error: "Image file too large. Maximum size is 10MB.", requestId }),
              { status: 400, headers: CORS }
            );
          }

          const arrayBuffer = await imageFile.arrayBuffer();
          
          // Convert to base64 using Deno's built-in encoding to avoid stack overflow
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64 = encodeBase64(uint8Array);
          
          const mimeType = imageFile.type || "image/jpeg";
          imageData = `data:${mimeType};base64,${base64}`;
          console.log(`✅ [${requestId}] Image converted to base64, length: ${base64.length}`);
        }
      } catch (formError: any) {
        console.error(`❌ [${requestId}] FormData parsing error:`, formError);
        return new Response(
          JSON.stringify({ 
            error: "Failed to parse form data", 
            details: formError.message,
            requestId 
          }),
          { status: 400, headers: CORS }
        );
      }
    } else {
      console.log(`📤 [${requestId}] Processing JSON body`);
      try {
        // Handle JSON body for text-only prompts
        const body = await req.json().catch(() => ({}));
        prompt = body?.prompt?.toString?.() || "";
        imageData = body?.imageData?.toString?.() || "";
        console.log(`📝 [${requestId}] JSON body - prompt: "${prompt}", hasImageData: ${!!imageData}`);
      } catch (jsonError: any) {
        console.error(`❌ [${requestId}] JSON parsing error:`, jsonError);
        return new Response(
          JSON.stringify({ 
            error: "Failed to parse JSON body", 
            details: jsonError.message,
            requestId 
          }),
          { status: 400, headers: CORS }
        );
      }
    }

    if (!prompt.trim()) {
      prompt = "Professional musician portrait, studio lighting, artistic and cinematic";
    }

    console.log(`🎯 [${requestId}] Artist Generator Debug:`);
    console.log(`  📝 [${requestId}] Prompt: "${prompt}"`);
    console.log(`  🖼️ [${requestId}] Has reference image: ${!!imageData}`);
    console.log(`  🔄 [${requestId}] Request independent - no state persistence`);

    // ALWAYS use Gemini 2.5 Flash Image Preview for BOTH analysis and generation - matching Nano Banana UI
    const analysisModel = "gemini-2.5-flash-image-preview";
    const generationModel = "gemini-2.5-flash-image-preview";
    
    console.log(`🔧 [${requestId}] Using models: analysis=${analysisModel}, generation=${generationModel}`);
    
    let finalPrompt = prompt;
    let analysisSuccessful = false;

    // If image is provided, first analyze it to enhance the prompt
    if (imageData) {
      const [mimeTypePart, base64Data] = imageData.split(",");
      const mimeType = mimeTypePart.replace("data:", "").replace(";base64", "");
      
      const analysisParts = [
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        },
        {
          text: `CRITICAL: Keep composition, lighting, background and structure of this image identical. Only change the character/subject as requested: "${prompt}". Preserve the exact same pose, camera angle, lighting setup, background elements, and overall visual structure. The character should fit naturally into the existing scene without altering any other visual elements. Respond with an enhanced prompt that emphasizes preserving the original image's composition while only modifying the subject.`
        }
      ];

      const analysisRequestBody = {
        contents: [{
          parts: analysisParts
        }],
        generationConfig: {
          temperature: 1.0,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      };

      console.log(`  🔍 [${requestId}] Analyzing reference image with Gemini 2.5 Flash Image Preview`);

      const analysisRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${analysisModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify(analysisRequestBody)
        }
      );

      const analysisJson = await analysisRes.json().catch(() => ({} as any));

      if (!analysisRes.ok) {
        console.error(`❌ [${requestId}] Gemini analysis FAILED:`, analysisJson);
        console.log(`  🔄 [${requestId}] Using original prompt as fallback`);
        finalPrompt = prompt;
        analysisSuccessful = false;
      } else {
        const analysisText = analysisJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (analysisText) {
          finalPrompt = analysisText;
          analysisSuccessful = true;
          console.log(`  ✅ [${requestId}] Enhanced prompt from analysis: "${finalPrompt.substring(0, 100)}..."`);
        } else {
          console.error(`❌ [${requestId}] No analysis text returned`);
          console.log(`  🔄 [${requestId}] Using original prompt as fallback for empty response`);
          finalPrompt = prompt;
          analysisSuccessful = false;
        }
      }
    }

    // Now generate image using Gemini 2.5 Flash Image Preview with reference image if available
    const generationParts = [];
    
    // Add reference image to generation if available (for better composition preservation)
    if (imageData) {
      const [mimeTypePart, base64Data] = imageData.split(",");
      const mimeType = mimeTypePart.replace("data:", "").replace(";base64", "");
      
      generationParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    }
    
    // Add the enhanced prompt with explicit image generation instruction
    const explicitPrompt = `GENERATE AN IMAGE: ${finalPrompt}

IMPORTANT: You must generate and return an actual image, not text. Create a visual representation of the described scene.`;
    
    generationParts.push({
      text: explicitPrompt
    });

    // Retry logic for image generation
    let generationAttempts = 0;
    const maxGenerationAttempts = 3;
    let generationJson: any;
    let images: string[] = [];

    while (generationAttempts < maxGenerationAttempts && images.length === 0) {
      generationAttempts++;

      const generationRequestBody = {
        contents: [{
          parts: generationParts
        }],
        generationConfig: {
          temperature: 0.85,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      };

      console.log(`  🎨 [${requestId}] Generation attempt ${generationAttempts}/${maxGenerationAttempts} with Gemini 2.5 Flash Image Preview`);

      const generationRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${generationModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify(generationRequestBody)
        }
      );

      generationJson = await generationRes.json().catch(() => ({} as any));

      if (!generationRes.ok) {
        console.error(`❌ [${requestId}] Gemini generation attempt ${generationAttempts} FAILED:`, generationJson);
        if (generationAttempts === maxGenerationAttempts) {
          return new Response(
            JSON.stringify({ 
              error: generationJson?.error?.message || "Gemini generation error", 
              raw: generationJson,
              requestId 
            }),
            { status: generationRes.status, headers: CORS }
          );
        }
        continue;
      }

      // Extract generated images from Gemini 2.5 Flash response
      const candidate = generationJson?.candidates?.[0];
      if (!candidate) {
        console.log(`⚠️ [${requestId}] No candidate returned from Gemini on attempt ${generationAttempts}`);
        continue;
      }

      // Look for inline_data or inlineData parts containing images (API variants)
      const parts = candidate?.content?.parts ?? [];
      const imageParts = parts.filter((part: any) => part?.inline_data || part?.inlineData);
      
      console.log(`  🔍 [${requestId}] Found ${imageParts.length} image parts in attempt ${generationAttempts}`);
      
      images = imageParts
        .map((part: any) => {
          const mimeType = part.inline_data?.mime_type || part.inlineData?.mimeType || "image/png";
          const base64Data = part.inline_data?.data || part.inlineData?.data;
          return base64Data ? `data:${mimeType};base64,${base64Data}` : null;
        })
        .filter(Boolean);

      if (images.length === 0) {
        const textParts = parts.filter((part: any) => part.text);
        if (textParts.length > 0) {
          console.log(`⚠️ [${requestId}] Attempt ${generationAttempts} returned text instead of image, retrying...`);
        }
      }
    }

    if (!images.length) {
      console.error(`❌ [${requestId}] No images extracted from Gemini response after ${maxGenerationAttempts} attempts`);
      return new Response(
        JSON.stringify({ 
          error: "No images generated by Gemini 2.5 Flash Image Preview after multiple attempts",
          raw: generationJson,
          requestId,
          attempts: generationAttempts
        }),
        { status: 502, headers: CORS }
      );
    }

    console.log(`  ✅ [${requestId}] SUCCESS! Generated ${images.length} artist image(s) with Gemini 2.5 Flash Image Preview`);
    
    return new Response(JSON.stringify({ 
      images,
      enhancedPrompt: finalPrompt,
      debug: {
        requestId,
        originalPrompt: prompt,
        hasReferenceImage: !!imageData,
        enhancedPrompt: finalPrompt,
        imageCount: images.length,
        analysisModel: analysisModel,
        generationModel: generationModel,
        analysisSuccessful,
        timestamp: new Date().toISOString(),
        guaranteedGemini: true // Confirm no fallback to other services
      }
    }), { headers: CORS });

  } catch (err: any) {
    const requestId = generateRequestId(); // Generate ID even for errors
    console.error(`❌ [${requestId}] Artist generator unhandled error:`, err);
    return new Response(
      JSON.stringify({ 
        error: err?.message || "Unhandled error",
        requestId 
      }),
      { status: 500, headers: CORS }
    );
  }
});