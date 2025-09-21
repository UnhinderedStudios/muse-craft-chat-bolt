// supabase/functions/generate-artist-image/index.ts
// Edge function for generating artist images using Gemini 2.5 Flash
// deno-lint-ignore-file no-explicit-any

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json"
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) {
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
        { status: 500, headers: CORS }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let prompt = "";
    let imageData = "";

    // Handle multipart form data for image uploads
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      prompt = (formData.get("prompt") as string) || "";
      const imageFile = formData.get("image") as File;
      
      if (imageFile) {
        // Check file size (limit to 10MB)
        if (imageFile.size > 10 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: "Image file too large. Maximum size is 10MB." }),
            { status: 400, headers: CORS }
          );
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        
        // Convert to base64 using Deno's built-in encoding to avoid stack overflow
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = encodeBase64(uint8Array);
        
        const mimeType = imageFile.type || "image/jpeg";
        imageData = `data:${mimeType};base64,${base64}`;
      }
    } else {
      // Handle JSON body for text-only prompts
      const body = await req.json().catch(() => ({}));
      prompt = body?.prompt?.toString?.() || "";
      imageData = body?.imageData?.toString?.() || "";
    }

    if (!prompt.trim()) {
      prompt = "Professional musician portrait, studio lighting, artistic and cinematic";
    }

    console.log("🎯 Artist Generator Debug:");
    console.log("  📝 Prompt:", prompt);
    console.log("  🖼️ Has image:", !!imageData);

    // Use Gemini 2.5 Flash for both analysis and generation
    const model = "gemini-2.5-flash";
    
    let finalPrompt = prompt;

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
          text: `Analyze this reference image and create an enhanced prompt for generating a professional artist portrait. Use the visual style, lighting, composition, and mood from this image as inspiration. Original request: "${prompt}". Respond with just the enhanced prompt text for image generation, focusing on artistic style, lighting, pose, and atmosphere.`
        }
      ];

      const analysisRequestBody = {
        contents: [{
          parts: analysisParts
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      };

      console.log("  🔍 Analyzing reference image with Gemini 2.5 Flash");

      const analysisRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
        console.error("❌ Gemini analysis error:", analysisJson);
        // Fallback to original prompt if analysis fails
        console.log("  ⚠️ Using original prompt as fallback");
      } else {
        const analysisText = analysisJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (analysisText) {
          finalPrompt = analysisText;
          console.log("  ✅ Enhanced prompt from analysis:", finalPrompt);
        }
      }
    }

    // Now generate image using Gemini 2.5 Flash
    const generationParts = [
      {
        text: `Generate a high-quality professional artist portrait image. ${finalPrompt}. Style: cinematic, artistic, professional photography, studio lighting.`
      }
    ];

    const generationRequestBody = {
      contents: [{
        parts: generationParts
      }],
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    console.log("  🎨 Generating image with Gemini 2.5 Flash");

    const generationRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(generationRequestBody)
      }
    );

    const generationJson = await generationRes.json().catch(() => ({} as any));

    if (!generationRes.ok) {
      console.error("❌ Gemini generation error:", generationJson);
      return new Response(
        JSON.stringify({ error: generationJson?.error?.message || "Gemini generation error", raw: generationJson }),
        { status: generationRes.status, headers: CORS }
      );
    }

    // Extract generated images from Gemini 2.5 Flash response
    const candidate = generationJson?.candidates?.[0];
    if (!candidate) {
      return new Response(
        JSON.stringify({ error: "No content generated from Gemini", raw: generationJson }),
        { status: 502, headers: CORS }
      );
    }

    // Look for inline_data parts containing images
    const imageParts = candidate?.content?.parts?.filter((part: any) => part?.inline_data) || [];
    
    const images: string[] = imageParts
      .map((part: any) => {
        const mimeType = part.inline_data?.mime_type || "image/png";
        const base64Data = part.inline_data?.data;
        return base64Data ? `data:${mimeType};base64,${base64Data}` : null;
      })
      .filter(Boolean);

    if (!images.length) {
      return new Response(
        JSON.stringify({ error: "No images generated by Gemini 2.5 Flash", raw: generationJson }),
        { status: 502, headers: CORS }
      );
    }

    console.log("  ✅ Success! Generated", images.length, "artist image(s) with Gemini 2.5 Flash");
    
    return new Response(JSON.stringify({ 
      images,
      enhancedPrompt: finalPrompt,
      debug: {
        originalPrompt: prompt,
        hasReferenceImage: !!imageData,
        enhancedPrompt: finalPrompt,
        imageCount: images.length,
        model: model
      }
    }), { headers: CORS });

  } catch (err: any) {
    console.error("❌ Artist generator error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Unhandled error" }),
      { status: 500, headers: CORS }
    );
  }
});