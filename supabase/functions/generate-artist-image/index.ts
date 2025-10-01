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
function buildPrompt(userInput: string, characterCount?: number, hasFacialReference?: boolean): string {
  const facialReferencePrefix = hasFacialReference 
    ? "Character's face must match the image titled (Facial Reference), this is the only thing that this image must be used for and nothing else. " 
    : "";
  const baseInstructions = "Match reference image framing, lighting, camera angle. Keep background identical but totally replace the character in the reference image, no reference to it should exist in the final image unless instructed in .";
  const characterInstruction = ` ${characterCount || 1} character${(characterCount || 1) > 1 ? 's' : ''}. All characters must match the gender specified, if 1 gender is specified then all characters must be that gender unless properly defined.`;
  const objectRestrictions = " NO objects, props, instruments, tools. Empty hands. Clean background.";
  
  return `${facialReferencePrefix}${userInput}. ${baseInstructions}${characterInstruction}${objectRestrictions}`;
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
    let characterCount: number;
    let imageData: string | undefined;
    let imageMimeType: string | undefined;
    let facialReferenceData: string | undefined;
    let facialReferenceMimeType: string | undefined;
    let clothingReferenceData: string | undefined;
    let clothingReferenceMimeType: string | undefined;
    let primaryClothingType: string | undefined;

    const contentType = req.headers.get('content-type') || '';
    console.log(`📥 [${requestId}] Content-Type: ${contentType}`);

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data
      console.log(`📤 [${requestId}] Processing multipart form data`);
      const formData = await req.formData();
      
      const promptField = formData.get('prompt') as string;
      characterCount = parseInt(formData.get('characterCount') as string) || 1;
      
      const imageFile = formData.get('image') as File;
      const facialReferenceFile = formData.get('facialReference') as File;
      const clothingReferenceFile = formData.get('clothingReference') as File;
      const primaryClothingType = formData.get('primaryClothingType') as string;
      
      if (imageFile) {
        console.log(`🖼️ [${requestId}] Image file - name: ${imageFile.name}, size: ${imageFile.size}, type: ${imageFile.type}`);
        const arrayBuffer = await imageFile.arrayBuffer();
        imageData = encodeBase64(new Uint8Array(arrayBuffer));
        imageMimeType = imageFile.type || 'image/png';
        console.log(`✅ [${requestId}] Image converted to base64, length: ${imageData.length}`);
      }
      
      if (facialReferenceFile) {
        console.log(`👤 [${requestId}] Facial reference file - name: ${facialReferenceFile.name}, size: ${facialReferenceFile.size}, type: ${facialReferenceFile.type}`);
        const facialArrayBuffer = await facialReferenceFile.arrayBuffer();
        facialReferenceData = encodeBase64(new Uint8Array(facialArrayBuffer));
        facialReferenceMimeType = facialReferenceFile.type || 'image/jpeg';
        console.log(`✅ [${requestId}] Facial reference converted to base64, length: ${facialReferenceData.length}`);
      }
      
      if (clothingReferenceFile) {
        console.log(`👕 [${requestId}] Clothing reference file - name: ${clothingReferenceFile.name}, size: ${clothingReferenceFile.size}, type: ${clothingReferenceFile.type}`);
        const clothingArrayBuffer = await clothingReferenceFile.arrayBuffer();
        clothingReferenceData = encodeBase64(new Uint8Array(clothingArrayBuffer));
        clothingReferenceMimeType = clothingReferenceFile.type || 'image/jpeg';
        console.log(`✅ [${requestId}] Clothing reference converted to base64, length: ${clothingReferenceData.length}`);
      }
      
      if (primaryClothingType) {
        console.log(`🏷️ [${requestId}] Primary clothing type: ${primaryClothingType}`);
      }
      
      // Extract user prompt from full prompt (remove any existing prefix)
      if (promptField.includes('Generate a new character:')) {
        prompt = promptField.split('Generate a new character:')[1]?.trim() || promptField;
      } else {
        prompt = promptField;
      }
      
      console.log(`📝 [${requestId}] Form data - prompt: "${prompt}", characterCount: ${characterCount}, hasImage: ${!!imageData}, hasClothingRef: ${!!clothingReferenceData}`);
    } else {
      // Handle JSON data
      console.log(`📤 [${requestId}] Processing JSON data`);
      const body = await req.json();
      prompt = body.prompt;
      characterCount = body.characterCount || 1;
      imageData = body.imageData;
      clothingReferenceData = body.clothingReferenceData;
      clothingReferenceMimeType = body.clothingReferenceMimeType;
      primaryClothingType = body.primaryClothingType;
      
      console.log(`📝 [${requestId}] JSON data - prompt: "${prompt}", characterCount: ${characterCount}, hasImage: ${!!imageData}, hasClothingRef: ${!!clothingReferenceData}`);
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

    // Check if we need two-stage clothing swap process
    if (clothingReferenceData) {
      console.log(`👕 [${requestId}] CLOTHING SWAP PROCESS: Starting two-stage generation`);
      
      // STAGE 1: Generate base image using existing flow
      console.log(`🎭 [${requestId}] STAGE 1: Generating base image with existing flow`);
      const stage1Prompt = buildPrompt(prompt, characterCount, !!facialReferenceData);
      console.log(`🎯 [${requestId}] Stage 1 prompt: "${stage1Prompt}"`);

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${geminiKey}`;

      // Build Stage 1 request body
      const stage1RequestBody: any = {
        contents: [{
          role: "user",
          parts: []
        }],
        generationConfig: {
          temperature: 0.7
        }
      };

      // Add reference image if provided
      if (imageData) {
        stage1RequestBody.contents[0].parts.push({
          inline_data: {
            mime_type: imageMimeType || "image/png",
            data: imageData
          }
        });
      }

      // Add facial reference image if provided
      if (facialReferenceData) {
        stage1RequestBody.contents[0].parts.push({
          inline_data: {
            mime_type: facialReferenceMimeType || "image/jpeg",
            data: facialReferenceData
          }
        });
      }

      // Add text prompt for Stage 1
      stage1RequestBody.contents[0].parts.push({
        text: stage1Prompt
      });

      // Execute Stage 1
      const stage1Response = await callGeminiWithTransportRetries(
        geminiUrl,
        stage1RequestBody,
        { 'Content-Type': 'application/json' },
        requestId
      );

      const stage1Result = await readResponseSafely(stage1Response, requestId);

      if (!stage1Result.success) {
        console.error(`❌ [${requestId}] Stage 1 failed:`, stage1Result.error);
        return new Response(
          JSON.stringify({ 
            error: 'Stage 1 generation failed',
            debug: stage1Result.error
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract Stage 1 image
      const stage1Candidates = stage1Result.data?.candidates;
      if (!stage1Candidates || stage1Candidates.length === 0) {
        console.error(`❌ [${requestId}] No Stage 1 candidates`);
        return new Response(
          JSON.stringify({ error: 'No Stage 1 candidates generated' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const stage1Parts = stage1Candidates[0]?.content?.parts;
      if (!stage1Parts || stage1Parts.length === 0) {
        console.error(`❌ [${requestId}] No Stage 1 parts`);
        return new Response(
          JSON.stringify({ error: 'No Stage 1 content parts' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract Stage 1 image data
      let stage1ImageData: string | undefined;
      for (const part of stage1Parts) {
        const inline = part.inline_data || part.inlineData;
        if (inline && inline.data) {
          stage1ImageData = inline.data as string;
          break;
        }
      }

      if (!stage1ImageData) {
        console.error(`❌ [${requestId}] No Stage 1 image data found`);
        return new Response(
          JSON.stringify({ error: 'No Stage 1 image data' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ [${requestId}] Stage 1 completed, extracted image data length: ${stage1ImageData.length}`);

      // STAGE 2: Clothing swap with both images
      console.log(`👕 [${requestId}] STAGE 2: Starting clothing swap process`);
      
      const clothingTypeText = primaryClothingType ? primaryClothingType.toUpperCase() : "clothing or accessory item";
      const stage2Prompt = `Image named "SPACEK" is the main image, the other image named "CLOTHESIMAGE" is a ${clothingTypeText} that need to be SWAPPED in accordance with the appropriate item that relates to it in the "SPACEK" image.`;
      console.log(`🎯 [${requestId}] Stage 2 prompt: "${stage2Prompt}"`);

      // Build Stage 2 request body with both images
      const stage2RequestBody: any = {
        contents: [{
          role: "user",
          parts: [
            {
              inline_data: {
                mime_type: "image/png",
                data: stage1ImageData
              }
            },
            {
              inline_data: {
                mime_type: clothingReferenceMimeType || "image/jpeg",
                data: clothingReferenceData
              }
            },
            {
              text: stage2Prompt
            }
          ]
        }],
        generationConfig: {
          temperature: 0.7
        }
      };

      // Execute Stage 2
      const stage2Response = await callGeminiWithTransportRetries(
        geminiUrl,
        stage2RequestBody,
        { 'Content-Type': 'application/json' },
        requestId
      );

      const stage2Result = await readResponseSafely(stage2Response, requestId);

      if (!stage2Result.success) {
        console.error(`❌ [${requestId}] Stage 2 failed:`, stage2Result.error);
        return new Response(
          JSON.stringify({ 
            error: 'Stage 2 clothing swap failed',
            debug: stage2Result.error
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract Stage 2 images
      const stage2Candidates = stage2Result.data?.candidates;
      if (!stage2Candidates || stage2Candidates.length === 0) {
        console.error(`❌ [${requestId}] No Stage 2 candidates`);
        return new Response(
          JSON.stringify({ error: 'No Stage 2 candidates generated' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const stage2Parts = stage2Candidates[0]?.content?.parts;
      if (!stage2Parts || stage2Parts.length === 0) {
        console.error(`❌ [${requestId}] No Stage 2 parts`);
        return new Response(
          JSON.stringify({ error: 'No Stage 2 content parts' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract final images from Stage 2
      const finalImages: string[] = [];
      for (const part of stage2Parts) {
        const inline = part.inline_data || part.inlineData;
        if (inline && inline.data) {
          const mime = inline.mime_type || inline.mimeType || 'image/png';
          const b64 = inline.data as string;
          const dataUrl = `data:${mime};base64,${b64}`;
          finalImages.push(dataUrl);
        }
      }

      if (finalImages.length === 0) {
        console.error(`❌ [${requestId}] No final images from Stage 2`);
        return new Response(
          JSON.stringify({ error: 'No final images from clothing swap' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ [${requestId}] Two-stage clothing swap completed successfully! Generated ${finalImages.length} final images`);

      return new Response(
        JSON.stringify({ 
          images: finalImages, 
          enhancedPrompt: stage2Prompt,
          clothingSwap: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // REGULAR FLOW: No clothing reference - continue with existing logic
    console.log(`🎨 [${requestId}] REGULAR FLOW: No clothing reference, using standard generation`);
    
    // Build the final prompt directly
    const finalPrompt = buildPrompt(prompt, characterCount, !!facialReferenceData);
    console.log(`🎯 [${requestId}] Final prompt: "${finalPrompt}"`);

    // Generate with Gemini
    console.log(`🎨 [${requestId}] Generating with Gemini...`);
    console.log(`🎭 [${requestId}] CHARACTER COUNT: ${characterCount}`);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${geminiKey}`;

    // Build request body for Gemini
    const requestBody: any = {
      contents: [{
        role: "user",
        parts: []
      }],
      generationConfig: {
        temperature: 0.7
      }
    };

    // Add reference image if provided
    if (imageData) {
      requestBody.contents[0].parts.push({
        inline_data: {
          mime_type: imageMimeType || "image/png",
          data: imageData
        }
      });
    }

    // Add facial reference image if provided (labeled as "Facial Reference")
    if (facialReferenceData) {
      requestBody.contents[0].parts.push({
        inline_data: {
          mime_type: facialReferenceMimeType || "image/jpeg",
          data: facialReferenceData
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

    // Extract images from Gemini response
    console.log(`🔍 [${requestId}] Full Gemini response:`, JSON.stringify(result.data, null, 2));
    
    const candidates = result.data?.candidates;
    if (!candidates || candidates.length === 0) {
      console.error(`❌ [${requestId}] No candidates in response`);
      return new Response(
        JSON.stringify({ 
          error: 'No candidates generated',
          debug: result.data
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const candidate = candidates[0];
    console.log(`🔍 [${requestId}] First candidate:`, JSON.stringify(candidate, null, 2));
    
    const parts = candidate?.content?.parts;
    
    if (!parts || parts.length === 0) {
      console.error(`❌ [${requestId}] No parts in candidate response`);
      return new Response(
        JSON.stringify({ 
          error: 'No content parts in response',
          debug: candidate
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 [${requestId}] Parts:`, JSON.stringify(parts, null, 2));

    // Look for inline data (images) in the parts
    const extractedImages: string[] = [];
    for (const part of parts) {
      const inline = part.inline_data || part.inlineData;
      if (inline && inline.data) {
        const mime = inline.mime_type || inline.mimeType || 'image/png';
        const b64 = inline.data as string;
        const dataUrl = `data:${mime};base64,${b64}`;
        extractedImages.push(dataUrl);
      }
    }

    if (extractedImages.length === 0) {
      console.error(`❌ [${requestId}] No image data found in parts`);
      console.log(`📋 [${requestId}] Parts structure:`, JSON.stringify(parts, null, 2));

      // Fallback: check if model returned JSON text with images
      for (const part of parts) {
        if (part.text) {
          try {
            const parsed = JSON.parse(part.text);
            const imgs = parsed?.images;
            if (Array.isArray(imgs) && imgs.length > 0) {
              const normalized = imgs.map((s: string) => {
                if (s.startsWith('data:')) return s;
                // Heuristic: if looks like base64, wrap as data URL
                return `data:image/png;base64,${s}`;
              });
              console.log(`✅ [${requestId}] Fallback parsed ${normalized.length} images from JSON text`);
              return new Response(
                JSON.stringify({ images: normalized, enhancedPrompt: finalPrompt }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } catch (_) {
            // ignore parse errors
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          error: 'No image data in response',
          debug: { parts, candidate, fullResponse: result.data }
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [${requestId}] Generated ${extractedImages.length} images successfully`);

    // Debug info
    console.log(`🔍 [${requestId}] TRANSFORMATION DEBUG:`);
    console.log(`  📝 Original input: "${prompt}"`);
    console.log(`  🔧 Final prompt: "${finalPrompt}"`);
    console.log(`  ✅ [${requestId}] SUCCESS! Generated ${extractedImages.length} artist image(s) with Gemini 2.5 Flash Image Preview`);

    return new Response(
      JSON.stringify({
        images: extractedImages,
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