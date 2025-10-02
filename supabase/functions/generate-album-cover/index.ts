// supabase/functions/generate-album-cover/index.ts
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

  const url = new URL(req.url);

  // Health check endpoint
  if (url.pathname.endsWith("/health")) {
    const key = Deno.env.get("GEMINI_API_KEY") ?? "";
    const model = Deno.env.get("IMAGEN_MODEL") || "imagen-4.0-generate-001";
    const jwtRequired = Deno.env.get("SUPABASE_VERIFY_JWT") !== "false";
    return new Response(
      JSON.stringify({
        ok: true,
        geminiKey: !!key,
        keyLength: key.length,
        model,
        jwtRequired
      }),
      { headers: CORS }
    );
  }

  try {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) {
      console.error("❌ GEMINI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error: GEMINI_API_KEY not set. Please contact support." }),
        { status: 500, headers: CORS }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Accept either { prompt, ... } or { lyrics: "..." }
    const prompt =
      body?.prompt?.toString?.() ||
      body?.lyrics?.toString?.() ||
      "Album cover, abstract geometry, high contrast, clean composition";

    const aspectRatio = (body?.aspectRatio || "1:1") as string;
    const n = Math.min(Number(body?.n || 2), 4);

    const model = Deno.env.get("IMAGEN_MODEL") || "imagen-4.0-generate-001";

    // Debug logging
    const timestamp = new Date().toISOString();
    console.log(`🎯 [${timestamp}] Imagen Edge Function Debug:`);
    console.log("  📝 Received prompt:", prompt);
    console.log("  📐 Aspect ratio:", aspectRatio);
    console.log("  🔢 Number of images:", n);
    console.log("  🤖 Model:", model);

    const requestBody = {
      instances: [{ prompt }],
      parameters: { sampleCount: n, aspectRatio }
    };
    console.log("  📡 Full request to Google:", JSON.stringify(requestBody, null, 2));

    // Add timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 second timeout

    try {
      const googleRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      const json = await googleRes.json().catch((parseErr) => {
        console.error("❌ Failed to parse Google API response:", parseErr);
        return {} as any;
      });

      if (!googleRes.ok) {
        console.error(`❌ Google API error (${googleRes.status}):`, json);
        // Bubble up the real Google error with more context
        const errorMessage = json?.error?.message || json?.error || "Imagen API error";
        return new Response(
          JSON.stringify({
            error: `Image generation failed: ${errorMessage}`,
            details: json,
            status: googleRes.status
          }),
          { status: googleRes.status, headers: CORS }
        );
      }

      const images: string[] = (json?.predictions || [])
        .map((p: any) => p?.bytesBase64Encoded)
        .filter(Boolean)
        .map((b64: string) => `data:image/png;base64,${b64}`);

      if (!images.length) {
        console.error("❌ No images in Google API response:", json);
        return new Response(
          JSON.stringify({
            error: "No images generated. The prompt may have been filtered or the API returned an empty response.",
            details: json
          }),
          { status: 502, headers: CORS }
        );
      }

      console.log(`  ✅ [${timestamp}] Success! Generated ${images.length} images`);

      return new Response(JSON.stringify({
        images,
        debug: {
          prompt,
          aspectRatio,
          n,
          model,
          imageCount: images.length,
          timestamp
        }
      }), { headers: CORS });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);

      if (fetchErr.name === 'AbortError') {
        console.error("❌ Request timeout after 55 seconds");
        return new Response(
          JSON.stringify({ error: "Image generation timed out. Please try again with a simpler prompt." }),
          { status: 504, headers: CORS }
        );
      }

      throw fetchErr;
    }
  } catch (err: any) {
    console.error("❌ Unhandled error in generate-album-cover:", err);
    return new Response(
      JSON.stringify({
        error: err?.message || "Unexpected error occurred",
        type: err?.name || "UnknownError"
      }),
      { status: 500, headers: CORS }
    );
  }
});
