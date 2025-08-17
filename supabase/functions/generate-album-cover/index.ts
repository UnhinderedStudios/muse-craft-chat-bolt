// supabase/functions/generate-album-cover/index.ts
// deno-lint-ignore-file no-explicit-any
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY" }),
        { status: 500, headers: CORS }
      );
    }

    // If your function enforces JWT, uncomment this to check presence
    // const auth = req.headers.get("authorization");
    // if (!auth) return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: CORS });

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
    console.log("🎯 Imagen Edge Function Debug:");
    console.log("  📝 Received prompt:", prompt);
    console.log("  📐 Aspect ratio:", aspectRatio);
    console.log("  🔢 Number of images:", n);
    console.log("  🤖 Model:", model);

    const requestBody = {
      instances: [{ prompt }],
      parameters: { sampleCount: n, aspectRatio }
    };
    console.log("  📡 Full request to Google:", JSON.stringify(requestBody, null, 2));

    const googleRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(requestBody)
      }
    );

    const json = await googleRes.json().catch(() => ({} as any));

    if (!googleRes.ok) {
      // Bubble up the real Google error
      return new Response(
        JSON.stringify({ error: json?.error?.message || "Imagen error", raw: json }),
        { status: googleRes.status, headers: CORS }
      );
    }

    const images: string[] = (json?.predictions || [])
      .map((p: any) => p?.bytesBase64Encoded)
      .filter(Boolean)
      .map((b64: string) => `data:image/png;base64,${b64}`);

    if (!images.length) {
      return new Response(
        JSON.stringify({ error: "No images in response", raw: json }),
        { status: 502, headers: CORS }
      );
    }

    console.log("  ✅ Success! Generated", images.length, "images");
    
    return new Response(JSON.stringify({ 
      images,
      debug: {
        prompt,
        aspectRatio,
        n,
        model,
        imageCount: images.length
      }
    }), { headers: CORS });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Unhandled error" }),
      { status: 500, headers: CORS }
    );
  }
});
