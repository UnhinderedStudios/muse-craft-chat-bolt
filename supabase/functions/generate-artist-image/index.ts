// supabase/functions/generate-artist-image/index.ts
// Edge function for generating artist images using Gemini 2.5 Flash
// deno-lint-ignore-file no-explicit-any

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
        const arrayBuffer = await imageFile.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
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

    // Build Gemini request
    const model = "gemini-2.0-flash-exp";
    const parts = [];

    // Add image if provided
    if (imageData) {
      const [mimeTypePart, base64Data] = imageData.split(",");
      const mimeType = mimeTypePart.replace("data:", "").replace(";base64", "");
      
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
      
      // Enhanced prompt for image analysis + generation
      parts.push({
        text: `Analyze this image and create a professional artist portrait based on the visual style, lighting, and composition you see. ${prompt}. Generate a high-quality, artistic portrait suitable for a musician or artist.`
      });
    } else {
      // Text-only prompt
      parts.push({
        text: `Generate a professional artist portrait image. ${prompt}. Make it cinematic, high-quality, and suitable for a musician or artist.`
      });
    }

    const requestBody = {
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    };

    console.log("  📡 Sending to Gemini 2.5 Flash");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(requestBody)
      }
    );

    const geminiJson = await geminiRes.json().catch(() => ({} as any));

    if (!geminiRes.ok) {
      console.error("❌ Gemini error:", geminiJson);
      return new Response(
        JSON.stringify({ error: geminiJson?.error?.message || "Gemini API error", raw: geminiJson }),
        { status: geminiRes.status, headers: CORS }
      );
    }

    // Extract generated text for image generation prompt
    const generatedText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      return new Response(
        JSON.stringify({ error: "No text generated from Gemini", raw: geminiJson }),
        { status: 502, headers: CORS }
      );
    }

    console.log("  🤖 Gemini generated prompt:", generatedText);

    // Now use the generated prompt with Imagen for actual image generation
    const imagenModel = "imagen-4.0-generate-001";
    const imagenRequestBody = {
      instances: [{ prompt: generatedText }],
      parameters: { sampleCount: 1, aspectRatio: "1:1" }
    };

    console.log("  🎨 Generating image with Imagen");

    const imagenRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${imagenModel}:predict`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(imagenRequestBody)
      }
    );

    const imagenJson = await imagenRes.json().catch(() => ({} as any));

    if (!imagenRes.ok) {
      console.error("❌ Imagen error:", imagenJson);
      return new Response(
        JSON.stringify({ error: imagenJson?.error?.message || "Imagen error", raw: imagenJson }),
        { status: imagenRes.status, headers: CORS }
      );
    }

    const images: string[] = (imagenJson?.predictions || [])
      .map((p: any) => p?.bytesBase64Encoded)
      .filter(Boolean)
      .map((b64: string) => `data:image/png;base64,${b64}`);

    if (!images.length) {
      return new Response(
        JSON.stringify({ error: "No images generated", raw: imagenJson }),
        { status: 502, headers: CORS }
      );
    }

    console.log("  ✅ Success! Generated", images.length, "artist image(s)");
    
    return new Response(JSON.stringify({ 
      images,
      enhancedPrompt: generatedText,
      debug: {
        originalPrompt: prompt,
        hasReferenceImage: !!imageData,
        enhancedPrompt: generatedText,
        imageCount: images.length
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