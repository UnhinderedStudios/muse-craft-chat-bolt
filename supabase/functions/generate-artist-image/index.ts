// supabase/functions/generate-artist-image/index.ts
// Simplified Edge function for generating artist images using Gemini 2.5 Flash
// deno-lint-ignore-file no-explicit-any

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Request queue for spacing out Gemini calls
const requestQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;
let lastRequestTime = 0;

async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      // Ensure minimum 1.5 second spacing between requests
      const timeSinceLastRequest = Date.now() - lastRequestTime;
      if (timeSinceLastRequest < 1500) {
        await new Promise(resolve => setTimeout(resolve, 1500 - timeSinceLastRequest));
      }
      
      lastRequestTime = Date.now();
      await request();
    }
  }
  isProcessingQueue = false;
}

// Compressed reference image cache
const referenceImageCache = new Map<string, string>();

function compressReferenceImage(base64Data: string, requestId: string): string {
  const cacheKey = base64Data.substring(0, 100); // Use first 100 chars as cache key
  
  if (referenceImageCache.has(cacheKey)) {
    console.log(`📦 [${requestId}] Using cached reference image`);
    return referenceImageCache.get(cacheKey)!;
  }
  
  referenceImageCache.set(cacheKey, base64Data);
  
  // If cache gets too large, clear it
  if (referenceImageCache.size > 10) {
    referenceImageCache.clear();
  }
  
  return base64Data;
}

// Optimized transport layer helper with request queuing
async function callGeminiWithTransportRetries(
  url: string,
  body: any,
  headers: Record<string, string>,
  requestId: string,
  attemptNumber: number = 1
): Promise<Response> {
  const maxTransportRetries = 2;
  const baseDelay = 100;
  
  // Queue the request to prevent overwhelming Gemini
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        for (let retry = 0; retry < maxTransportRetries; retry++) {
          try {
            console.log(`🌐 [${requestId}] Gemini API call attempt ${retry + 1}/${maxTransportRetries}`);
            
            // Optimized headers for faster processing
            const optimizedHeaders = {
              ...headers,
              'Accept': 'application/json',
              'Connection': 'keep-alive',
              'User-Agent': 'Supabase-Edge-Function/1.0'
            };
            
            // Optimize reference image processing
            let processedBody = body;
            if (body.contents?.[0]?.parts?.[0]?.inline_data?.data) {
              const originalData = body.contents[0].parts[0].inline_data.data;
              const compressedData = compressReferenceImage(originalData, requestId);
              processedBody = {
                ...body,
                contents: [{
                  ...body.contents[0],
                  parts: [
                    {
                      ...body.contents[0].parts[0],
                      inline_data: {
                        ...body.contents[0].parts[0].inline_data,
                        data: compressedData
                      }
                    },
                    ...body.contents[0].parts.slice(1)
                  ]
                }]
              };
            }
            
            const response = await fetch(url, {
              method: 'POST',
              headers: optimizedHeaders,
              body: JSON.stringify(processedBody)
            });
            
            console.log(`📡 [${requestId}] Gemini response: ${response.status} ${response.statusText}`);
            
            resolve(response);
            return;
            
          } catch (error) {
            const isLastRetry = retry === maxTransportRetries - 1;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            console.error(`🔌 [${requestId}] Transport error attempt ${retry + 1}: ${errorMessage}`);
            
            if (isLastRetry) {
              reject(new Error(`Transport failed after ${maxTransportRetries} attempts: ${errorMessage}`));
              return;
            }
            
            const delay = baseDelay * Math.pow(2, retry);
            console.log(`⏳ [${requestId}] Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      } catch (error) {
        reject(error);
      }
    });
    
    processQueue();
  });
}

// Safe response reader that handles 502s and non-JSON responses
async function readResponseSafely(response: Response, requestId: string): Promise<{
  success: boolean;
  data?: any;
  error?: {
    status: number;
    statusText: string;
    contentType: string;
    headers: Record<string, string>;
    bodySnippet: string;
    isHtml502: boolean;
  };
}> {
  const status = response.status;
  const statusText = response.statusText;
  const contentType = response.headers.get('content-type') || '';
  const headers = Object.fromEntries(response.headers.entries());
  
  try {
    const text = await response.text();
    const bodySnippet = text.substring(0, 500);
    
    const isHtml502 = status === 502 && contentType.includes('text/html');
    if (isHtml502) {
      console.error(`🚫 [${requestId}] HTML 502 detected - proxy/gateway error`);
    }
    
    if (response.ok && contentType.includes('application/json')) {
      const data = JSON.parse(text);
      return { success: true, data };
    }
    
    return {
      success: false,
      error: {
        status,
        statusText,
        contentType,
        headers,
        bodySnippet,
        isHtml502
      }
    };
    
  } catch (parseError) {
    console.error(`🔍 [${requestId}] Failed to read response: ${parseError}`);
    return {
      success: false,
      error: {
        status,
        statusText,
        contentType,
        headers,
        bodySnippet: `Parse error: ${parseError}`,
        isHtml502: false
      }
    };
  }
}

// Generate unique request ID for tracking
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Simple direct prompt construction
function buildPrompt(userInput: string, backgroundHex?: string, characterCount?: number): string {
  const baseInstructions = "Match reference image framing, lighting, camera angle. Keep background identical.";
  const characterInstruction = ` ${characterCount || 1} character${(characterCount || 1) > 1 ? 's' : ''}.`;
  const styleGuide = " Generate new original character, use reference only for style guide.";
  const objectRestrictions = " NO objects, props, instruments, tools. Empty hands. Clean background.";
  const backgroundInstruction = backgroundHex ? ` Background color: ${backgroundHex}.` : '';
  
  return `${userInput}. ${baseInstructions}${backgroundInstruction}${characterInstruction}${styleGuide}${objectRestrictions}`;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Main Edge Function
Deno.serve(async (req: Request) => {
  const requestId = generateRequestId();
  console.log(`🆔 [${requestId}] Artist Generator request started`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] CORS preflight handled`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      console.error(`❌ [${requestId}] Missing GEMINI_API_KEY`);
      return new Response(
        JSON.stringify({ error: 'Missing required API keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [${requestId}] Environment validation passed`);

    // Parse request data
    let prompt: string;
    let backgroundHex: string | undefined;
    let characterCount: number;
    let imageData: string | undefined;

    const contentType = req.headers.get('content-type') || '';
    console.log(`📥 [${requestId}] Content-Type: ${contentType}`);

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data
      console.log(`📤 [${requestId}] Processing multipart form data`);
      const formData = await req.formData();
      
      const promptField = formData.get('prompt') as string;
      backgroundHex = (formData.get('backgroundHex') as string) || undefined;
      characterCount = parseInt(formData.get('characterCount') as string) || 1;
      
      const imageFile = formData.get('image') as File;
      
      if (imageFile) {
        console.log(`🖼️ [${requestId}] Image file - name: ${imageFile.name}, size: ${imageFile.size}, type: ${imageFile.type}`);
        const arrayBuffer = await imageFile.arrayBuffer();
        imageData = encodeBase64(new Uint8Array(arrayBuffer));
        console.log(`✅ [${requestId}] Image converted to base64, length: ${imageData.length}`);
      }
      
      // Extract user prompt from full prompt (remove any existing prefix)
      if (promptField.includes('Generate a new character:')) {
        prompt = promptField.split('Generate a new character:')[1]?.trim() || promptField;
      } else {
        prompt = promptField;
      }
      
      console.log(`📝 [${requestId}] Form data - prompt: "${prompt}", backgroundHex: "${backgroundHex}", characterCount: ${characterCount}, hasImage: ${!!imageData}`);
    } else {
      // Handle JSON data
      console.log(`📤 [${requestId}] Processing JSON data`);
      const body = await req.json();
      prompt = body.prompt;
      backgroundHex = body.backgroundHex;
      characterCount = body.characterCount || 1;
      imageData = body.imageData;
      
      console.log(`📝 [${requestId}] JSON data - prompt: "${prompt}", backgroundHex: "${backgroundHex}", characterCount: ${characterCount}, hasImage: ${!!imageData}`);
    }

    if (!prompt) {
      console.error(`❌ [${requestId}] Missing prompt`);
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [${requestId}] Initial request validation passed`);
    console.log(`📝 [${requestId}] User input: "${prompt}"`);

    // Build the final prompt directly
    const finalPrompt = buildPrompt(prompt, backgroundHex, characterCount);
    console.log(`🎯 [${requestId}] Final prompt: "${finalPrompt}"`);

    // Generate with Gemini
    console.log(`🎨 [${requestId}] Generating with Gemini...`);
    console.log(`🎭 [${requestId}] CHARACTER COUNT: ${characterCount}, BACKGROUND: ${backgroundHex || 'default'}`);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`;

    // Build request body
    const requestBody: any = {
      contents: [{
        parts: []
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            images: {
              type: "array",
              items: {
                type: "string"
              }
            }
          },
          required: ["images"]
        }
      }
    };

    // Add reference image if provided
    if (imageData) {
      requestBody.contents[0].parts.push({
        inline_data: {
          mime_type: "image/png",
          data: imageData
        }
      });
    }

    // Add text prompt
    requestBody.contents[0].parts.push({
      text: finalPrompt
    });

    console.log(`📋 [${requestId}] Complete prompt to Gemini: "${finalPrompt}"`);

    // Make the request to Gemini
    const response = await callGeminiWithTransportRetries(
      geminiUrl,
      requestBody,
      { 'Content-Type': 'application/json' },
      requestId
    );

    const result = await readResponseSafely(response, requestId);

    if (!result.success) {
      console.error(`❌ [${requestId}] Gemini API error:`, result.error);
      return new Response(
        JSON.stringify({ 
          error: 'Generation failed',
          debug: result.error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract images from response
    const images = result.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!images) {
      console.error(`❌ [${requestId}] No images in response`);
      return new Response(
        JSON.stringify({ 
          error: 'No images generated',
          debug: result.data
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedImages;
    try {
      parsedImages = JSON.parse(images);
    } catch (parseError) {
      console.error(`❌ [${requestId}] Failed to parse images JSON:`, parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response format',
          debug: { images, parseError: parseError.message }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parsedImages.images || !Array.isArray(parsedImages.images) || parsedImages.images.length === 0) {
      console.error(`❌ [${requestId}] No valid images in parsed response`);
      return new Response(
        JSON.stringify({ 
          error: 'No valid images in response',
          debug: parsedImages
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [${requestId}] Generated ${parsedImages.images.length} images successfully`);
    console.log(`📦 [${requestId}] Response size: ${JSON.stringify(parsedImages).length} characters`);

    // Debug info
    console.log(`🔍 [${requestId}] TRANSFORMATION DEBUG:`);
    console.log(`  📝 Original input: "${prompt}"`);
    console.log(`  🔧 Final prompt: "${finalPrompt}"`);
    console.log(`  ✅ [${requestId}] SUCCESS! Generated ${parsedImages.images.length} artist image(s) with Gemini 2.0 Flash`);

    return new Response(
      JSON.stringify({
        images: parsedImages.images,
        enhancedPrompt: finalPrompt
      }),
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