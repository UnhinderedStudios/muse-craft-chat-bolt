// supabase/functions/generate-artist-image/index.ts
// Edge function for generating artist images using Gemini 2.5 Flash
// deno-lint-ignore-file no-explicit-any

import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Generate unique request ID for tracking
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to get analysis instruction based on object constraints
function getAnalysisInstruction(finalPrompt: string, prefix: string, requestId: string): string {
  const hasObjectConstraints = prefix.toLowerCase().includes('no objects') || 
                               prefix.toLowerCase().includes('cannot be present') ||
                               prefix.toLowerCase().includes('no props') ||
                               prefix.toLowerCase().includes('no items');
  
  if (hasObjectConstraints) {
    console.log(`🚫 [${requestId}] Object constraints detected - using object-removal analysis`);
    return `CRITICAL: Keep camera angle and lighting style identical, BUT remove all objects/props from the scene. Replace any objects with clean, neutral background where props were located. Hands should be empty. Only change the character/subject as requested: "${finalPrompt}". Preserve the pose style and overall composition but eliminate all objects, instruments, tools, furniture, or props. The character should fit naturally into a clean scene. Respond with an enhanced prompt that emphasizes preserving composition while removing all objects and only modifying the subject.`;
  } else {
    return `CRITICAL: Keep composition, lighting, background and structure of this image identical. Only change the character/subject as requested: "${finalPrompt}". Preserve the exact same pose, camera angle, lighting setup, background elements, and overall visual structure. The character should fit naturally into the existing scene without altering any other visual elements. Respond with an enhanced prompt that emphasizes preserving the original image's composition while only modifying the subject.`;
  }
}

// Helper function to get generation prompt with object constraints
function getGenerationPrompt(finalPrompt: string, hasObjectConstraints: boolean, requestId: string): string {
  const preservation = `\nPRESERVE COMPOSITION & BACKGROUND:\n- Keep camera angle, lighting setup, background elements, and overall structure IDENTICAL to the reference image\n- DO NOT change the environment, backdrop, or scene in any way`; 
  if (hasObjectConstraints) {
    console.log(`🚫 [${requestId}] Adding object removal + preservation instructions to generation prompt`);
    return `GENERATE AN IMAGE: ${finalPrompt}${preservation}\n\nHARD RULES FOR GENERATION:\n- NO OBJECTS/PROPS: Absolutely no lamp posts, microphones, guitars, chairs, stands, instruments, tools, furniture, or any physical objects\n- EMPTY HANDS: Character's hands must be completely empty\n- CLEAN BACKGROUND: If reference contains props, erase them in-painting to seamlessly match the existing background\n- FOCUS: Only the character/person, their pose, expression, and clothing\n\nNEGATIVE PROMPT: different background, new environment, alternate scene, outdoors, landscape, room switch, lamp post, microphone, guitar, chair, stand, instrument, tool, furniture, object, prop, holding, carrying, gripping\n\nIMPORTANT: You must generate and return an actual image, not text. Create a visual representation of the described scene.`;
  } else {
    return `GENERATE AN IMAGE: ${finalPrompt}${preservation}\n\nNEGATIVE PROMPT: different background, new environment, alternate scene, outdoors, landscape, room switch\n\nIMPORTANT: You must generate and return an actual image, not text. Create a visual representation of the described scene.`;
  }
}

// Comprehensive GPT sanitization function that respects all prefix constraints
async function modifyPromptWithChatGPT(
  characterDescription: string, 
  attempt: number, 
  openaiKey: string, 
  requestId: string
): Promise<string> {
  if (!openaiKey) {
    console.log(`⚠️ [${requestId}] No OpenAI key available for prompt modification`);
    return characterDescription;
  }

  const conservativeness = ["moderately", "significantly", "extremely"][Math.min(attempt - 1, 2)];
  
  const systemPrompt = `You are an intelligent character description sanitizer for AI image generation with CRITICAL PREFIX CONSTRAINTS. The final prompt will be: "Keep composition, structure, lighting and character position identical, character must be entirely different to the reference image, in other words not a single thing must resemble from the character in the image, this should be erased, pose must be entirely different but very cool to the current image, it should be clear that the person is a music artist. No objects such as guitars, mics, chairs or anything else at all can be present in the image. Character must be entirely replaced with: [YOUR OUTPUT]"

CRITICAL RULES (${conservativeness} enforcement):
1. ABSOLUTELY NO OBJECTS: Remove ALL objects, props, instruments, furniture, tools, accessories that characters hold or interact with
2. MUSIC ARTIST THEME: Character must clearly be a music artist through pose, expression, style, or attire
3. CONVERT OBJECTS TO APPEARANCE: Transform object references into visual traits or poses
4. CONTENT SAFETY: Remove all rudeness, offensive language, inappropriate content
5. SINGLE WORD EXPANSION: Expand single words into fuller character descriptions
6. BIZARRE RATIONALIZATION: Convert bizarre concepts into realistic visual descriptions

OBJECT → APPEARANCE CONVERSION EXAMPLES:
"Woman holding a lamp post" → "Woman with tall, statuesque posture and confident stance"
"Person wearing cheese costume" → "Person with warm golden-yellow color palette and textured clothing"
"Man with guitar" → "Man in confident performer stance with expressive hands"
"Girl holding microphone" → "Girl in expressive vocal pose with dynamic hand gestures"

CONTENT SAFETY EXAMPLES:
"Stupid idiot whore woman" → "Normal female character"
"Crazy psycho man" → "Energetic male performer"
"Ugly fat person" → "Character with unique features"

SINGLE WORD EXPANSION EXAMPLES:
"Cheese" → "Person with warm golden appearance and cheerful expression"
"Rock" → "Rock musician with edgy style and confident attitude"
"Jazz" → "Jazz artist with sophisticated style and smooth expression"

BIZARRE RATIONALIZATION EXAMPLES:
"Cheesy person who's super cheesy" → "Person with bright, cheerful expression and warm golden tones"
"Flying rainbow unicorn person" → "Performer with colorful, fantastical stage makeup and dynamic pose"

Return ONLY the sanitized character description that will work with the prefix constraints. Focus on visual appearance, pose, expression, clothing style, and artistic elements. NO OBJECTS WHATSOEVER.`;

  try {
    console.log(`🔄 [${requestId}] Sanitizing character description with ChatGPT (attempt ${attempt}, ${conservativeness} safer)`);
    console.log(`📝 [${requestId}] Character to sanitize: "${characterDescription}"`);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`ChatGPT sanitization timeout after 20s`)), 20000);
    });
    
    const response = await Promise.race([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: characterDescription }
          ],
          max_tokens: 100,
          temperature: 0.3
        }),
      }),
      timeoutPromise
    ]);

    if (!response.ok) {
      console.error(`❌ [${requestId}] ChatGPT API failed:`, await response.text());
      return characterDescription;
    }

    const data = await response.json();
    const sanitizedDescription = data.choices?.[0]?.message?.content?.trim();
    
    if (sanitizedDescription) {
      console.log(`✅ [${requestId}] Sanitized character: "${sanitizedDescription}"`);
      return sanitizedDescription;
    } else {
      console.error(`❌ [${requestId}] No sanitized description returned from ChatGPT`);
      return characterDescription;
    }
  } catch (error) {
    console.error(`❌ [${requestId}] ChatGPT sanitization failed:`, error);
    return characterDescription;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
  "Content-Type": "application/json"
};

Deno.serve(async (req: Request) => {
  // Generate unique request ID for tracking outside try-catch for global access
  let requestId: string;
  let FINAL_GENERATION_PROMPT: string | undefined;
  let CURRENT_CHARACTER: string | undefined;
  
  try {
    requestId = generateRequestId();
    console.log(`🆔 [${requestId}] Artist Generator request started - Function entry`);
    
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      console.log(`✅ [${requestId}] CORS preflight handled`);
      return new Response(null, { headers: CORS });
    }

    // Early validation
    if (!req) {
      console.error(`❌ [${requestId}] No request object received`);
      return new Response(
        JSON.stringify({ error: "Invalid request", requestId }),
        { status: 400, headers: CORS }
      );
    }

    console.log(`✅ [${requestId}] Initial request validation passed`);
    
    // Timeout wrapper for critical operations
    const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs);
      });
      return Promise.race([promise, timeoutPromise]);
    };

    console.log(`🔍 [${requestId}] Validating environment variables`);
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!geminiKey) {
      console.error(`❌ [${requestId}] Missing GEMINI_API_KEY`);
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY", requestId }),
        { status: 500, headers: CORS }
      );
    }
    
    console.log(`✅ [${requestId}] Environment validation passed, keys available: GEMINI=${!!geminiKey}, OPENAI=${!!openaiKey}`);

    const contentType = req.headers.get("content-type") || "";
    let prompt = "";
    let imageData = "";
    
    console.log(`📥 [${requestId}] Content-Type: ${contentType}`);

    // Handle multipart form data for image uploads
    if (contentType.includes("multipart/form-data")) {
      console.log(`📤 [${requestId}] Processing multipart form data`);
      try {
        const formData = await withTimeout(req.formData(), 10000, "FormData parsing");
        prompt = (formData.get("prompt") as string) || "";
        const imageFile = formData.get("image") as File;
        
        console.log(`📝 [${requestId}] Form data - prompt: "${prompt}", hasImage: ${!!imageFile}`);
        
        if (imageFile) {
          console.log(`🖼️ [${requestId}] Image file - name: ${imageFile.name}, size: ${imageFile.size}, type: ${imageFile.type}`);
          
          // Check file size (limit to 5MB to prevent memory issues)
          if (imageFile.size > 5 * 1024 * 1024) {
            console.error(`❌ [${requestId}] File too large: ${imageFile.size} bytes (max 5MB)`);
            return new Response(
              JSON.stringify({ error: "Image file too large. Maximum size is 5MB for optimal processing.", requestId }),
              { status: 400, headers: CORS }
            );
          }
          
          // Memory check - ensure we have enough memory for processing
          const memoryEstimate = imageFile.size * 2; // Rough estimate for base64 conversion
          if (memoryEstimate > 15 * 1024 * 1024) {
            console.error(`❌ [${requestId}] Estimated memory usage too high: ${memoryEstimate} bytes`);
            return new Response(
              JSON.stringify({ error: "Image too large for processing. Please use a smaller image.", requestId }),
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
        const body = await withTimeout(req.json(), 5000, "JSON parsing").catch(() => ({}));
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

    // Standard prefix template with object removal constraints
    const STANDARD_PREFIX = "Keep composition, structure, lighting and character position identical, character must be entirely different to the reference image, in other words not a single thing must resemble from the character in the image, this should be erased, pose must be entirely different but very cool to the current image, it should be clear that the person is a music artist. No objects such as guitars, mics, chairs or anything else at all can be present in the image. Character must be entirely replaced with:";

    // Extract or establish the immutable prefix and character parts
    let FULL_PREFIX = "";
    let CHARACTER = "";
    
    if (prompt.includes("Character must be entirely replaced with:")) {
      // User provided full prompt with prefix
      const prefixMatch = prompt.match(/^(.*?Character must be entirely replaced with:)\s*(.*)$/s);
      FULL_PREFIX = prefixMatch?.[1] || STANDARD_PREFIX;
      CHARACTER = prefixMatch?.[2]?.trim() || "";
      console.log(`✅ [${requestId}] User provided full prompt - prefix extracted`);
    } else {
      // User provided only character description - auto-prepend standard prefix
      FULL_PREFIX = STANDARD_PREFIX;
      CHARACTER = prompt.trim();
      console.log(`🔧 [${requestId}] Auto-prepending standard prefix to user input: "${CHARACTER}"`);
    }
    
    console.log(`🎯 [${requestId}] Immutable Prefix System Debug:`);
    console.log(`  🔒 [${requestId}] FULL_PREFIX: "${FULL_PREFIX}"`);
    console.log(`  🎭 [${requestId}] CHARACTER: "${CHARACTER}"`);
    console.log(`  🖼️ [${requestId}] Has reference image: ${!!imageData}`);
    console.log(`  🛡️ [${requestId}] Prefix protection: ENABLED - prefix will never be modified`);
    console.log(`  🔄 [${requestId}] Request independent - no state persistence`);

    // ALWAYS use Gemini 2.5 Flash Image Preview for BOTH analysis and generation - matching Nano Banana UI
    const analysisModel = "gemini-2.5-flash-image-preview";
    const generationModel = "gemini-2.5-flash-image-preview";
    
    console.log(`🔧 [${requestId}] Using models: analysis=${analysisModel}, generation=${generationModel}`);
    
    // Initialize working character - FULL_PREFIX stays immutable 
    CURRENT_CHARACTER = CHARACTER;
    let analysisSuccessful = false;
    let promptModificationAttempts = 0;
    
    console.log(`🔧 [${requestId}] Character initialization - INPUT: "${CHARACTER}", WORKING: "${CURRENT_CHARACTER}"`);

    // Pre-sanitize character description to prevent content policy violations during analysis
    if (CURRENT_CHARACTER && openaiKey) {
      console.log(`🧹 [${requestId}] Pre-sanitizing character description: "${CURRENT_CHARACTER}"`);
      
      const sanitizedCharacter = await modifyPromptWithChatGPT(
        CURRENT_CHARACTER,  // Only modify the character part
        1,                  // First attempt at sanitization
        openaiKey, 
        requestId
      );
      
      if (sanitizedCharacter !== CURRENT_CHARACTER) {
        CURRENT_CHARACTER = sanitizedCharacter;
        console.log(`✅ [${requestId}] Pre-sanitized character: "${CURRENT_CHARACTER}"`);
      } else {
        console.log(`⚠️ [${requestId}] Character sanitization unchanged, proceeding with original`);
      }
    }

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
          text: getAnalysisInstruction(`${FULL_PREFIX} ${CURRENT_CHARACTER}`, FULL_PREFIX, requestId)
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

      const analysisRes = await withTimeout(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${analysisModel}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            body: JSON.stringify(analysisRequestBody)
          }
        ),
        30000,
        "Gemini analysis API call"
      );

      const analysisJson = await analysisRes.json().catch(() => ({} as any));

      if (!analysisRes.ok) {
        console.error(`❌ [${requestId}] Gemini analysis FAILED:`, analysisJson);
        
        // Check if this is a content policy violation during analysis
        const isContentBlock = analysisJson?.error?.message?.includes?.("PROHIBITED_CONTENT") || 
                               analysisJson?.error?.message?.includes?.("content policy") ||
                               analysisRes.status === 400;
        
        if (isContentBlock && openaiKey && promptModificationAttempts < 3) {
          promptModificationAttempts++;
          console.log(`🚫 [${requestId}] Content policy violation during analysis, attempting ChatGPT character modification (${promptModificationAttempts}/3)`);
          
          console.log(`📝 [${requestId}] Character to modify: "${CURRENT_CHARACTER}"`);
          console.log(`📏 [${requestId}] Character limit: ${CURRENT_CHARACTER.length} chars (original: "${CURRENT_CHARACTER}")`);
          
          const modifiedCharacter = await modifyPromptWithChatGPT(
            CURRENT_CHARACTER,  // Only modify the character part
            promptModificationAttempts, 
            openaiKey, 
            requestId
          );
          
          if (modifiedCharacter !== CURRENT_CHARACTER) {
            // Update only the character part - FULL_PREFIX remains immutable
            CURRENT_CHARACTER = modifiedCharacter;
            analysisSuccessful = false; // Mark as unsuccessful so we use original prompt structure
            console.log(`✅ [${requestId}] ChatGPT modified character within limits: "${CURRENT_CHARACTER}"`);
            console.log(`🔍 [${requestId}] Modified character: "${CURRENT_CHARACTER}" (${CURRENT_CHARACTER.length} chars)`);
          } else {
            console.log(`  🔄 [${requestId}] Character modification unchanged, proceeding with current`);
            analysisSuccessful = false;
          }
        } else {
          console.log(`  🔄 [${requestId}] Using current character as fallback`);
          analysisSuccessful = false;
          analysisSuccessful = false;
        }
      } else {
        const analysisText = analysisJson?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (analysisText) {
          // Check if the analysis returned a refusal message instead of actual analysis
          const isRefusal = analysisText.includes("I cannot") || 
                           analysisText.includes("harmful") || 
                           analysisText.includes("inappropriate") ||
                           analysisText.includes("content policy");
          
          if (isRefusal && openaiKey && promptModificationAttempts < 3) {
            promptModificationAttempts++;
            console.log(`🚫 [${requestId}] Analysis returned refusal, attempting ChatGPT character modification (${promptModificationAttempts}/3)`);
            
            console.log(`📝 [${requestId}] Character to modify: "${CURRENT_CHARACTER}"`);
            console.log(`📏 [${requestId}] Character limit: ${CURRENT_CHARACTER.length} chars (original: "${CURRENT_CHARACTER}")`);
            
            const modifiedCharacter = await modifyPromptWithChatGPT(
              CURRENT_CHARACTER,  // Only modify the character part
              promptModificationAttempts, 
              openaiKey, 
              requestId
            );
            
            if (modifiedCharacter !== CURRENT_CHARACTER) {
              // Update only the character part - FULL_PREFIX remains immutable
              CURRENT_CHARACTER = modifiedCharacter;
              analysisSuccessful = false; // Use immutable prefix system
              console.log(`✅ [${requestId}] ChatGPT modified character within limits: "${CURRENT_CHARACTER}"`);
              console.log(`🔍 [${requestId}] Modified character: "${CURRENT_CHARACTER}" (${CURRENT_CHARACTER.length} chars)`);
            } else {
              analysisSuccessful = false;
            }
          } else {
            // 🚨 CRITICAL: Analysis is for diagnostics only - never use as final prompt
            // Always use immutable prefix system for generation
            analysisSuccessful = false; // Force use of immutable prefix system
            console.log(`  ✅ [${requestId}] Analysis complete (diagnostics only): "${analysisText.substring(0, 100)}..."`);
            console.log(`  🔒 [${requestId}] Using immutable prefix system for generation`);
          }
        } else {
          console.error(`❌ [${requestId}] No analysis text returned`);
          console.log(`  🔄 [${requestId}] Using immutable prefix system as fallback`);
          analysisSuccessful = false;
        }
      }
    }

    // Extract object constraints for generation using immutable prefix
    const hasObjectConstraints = FULL_PREFIX.toLowerCase().includes('no objects') || 
                                 FULL_PREFIX.toLowerCase().includes('cannot be present') ||
                                 FULL_PREFIX.toLowerCase().includes('no props') ||
                                 FULL_PREFIX.toLowerCase().includes('no items');
    
    console.log(`🎯 [${requestId}] hasObjectConstraints: ${hasObjectConstraints} (from immutable prefix)`);
    
    // 🔒 IMMUTABLE FINAL PROMPT ASSEMBLY: Always use FULL_PREFIX + CURRENT_CHARACTER
    FINAL_GENERATION_PROMPT = `${FULL_PREFIX} ${CURRENT_CHARACTER}`;
    console.log(`🔒 [${requestId}] Final immutable prompt: "${FINAL_GENERATION_PROMPT}"`);
    console.log(`🔒 [${requestId}] Prefix intact: ${FINAL_GENERATION_PROMPT.includes(FULL_PREFIX)}`);
    console.log(`🔒 [${requestId}] System guarantee: PREFIX is immutable, only CHARACTER can be modified`);
    
    // Enhanced retry logic with ChatGPT prompt modification fallback
    let generationAttempts = 0;
    const maxGenerationAttempts = 3;
    let generationJson: any;
    let images: string[] = [];

    while (generationAttempts < maxGenerationAttempts && images.length === 0) {
      generationAttempts++;

      // Update generation parts with current prompt using immutable prefix system
      let currentGenerationParts = [];
      
      // Always use the reference image on every attempt to preserve background
      const useReferenceImage = !!imageData;
      if (useReferenceImage) {
        const [mimeTypePart, base64Data] = imageData.split(",");
        const mimeType = mimeTypePart.replace("data:", "").replace(";base64", "");
        currentGenerationParts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data
          }
        });
        console.log(`🖼️ [${requestId}] Using reference image for generation attempt ${generationAttempts}`);
      }
      
      // 🔒 CRITICAL: Always reassemble from immutable components before each generation
      const currentGenerationPrompt = `${FULL_PREFIX} ${CURRENT_CHARACTER}`;
      console.log(`🔒 [${requestId}] Generation attempt ${generationAttempts} using: "${currentGenerationPrompt.substring(0, 100)}..."`);
      
      currentGenerationParts.push({
        text: getGenerationPrompt(currentGenerationPrompt, hasObjectConstraints, requestId)
      });

      const generationRequestBody = {
        contents: [{
          parts: currentGenerationParts
        }],
        generationConfig: {
          temperature: 0.85,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      };

      console.log(`  🎨 [${requestId}] Generation attempt ${generationAttempts}/${maxGenerationAttempts} with Gemini 2.5 Flash Image Preview`);

      const generationRes = await withTimeout(
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${generationModel}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": geminiKey,
            },
            body: JSON.stringify(generationRequestBody)
          }
        ),
        45000,
        `Gemini generation attempt ${generationAttempts}`
      );

      generationJson = await withTimeout(
        generationRes.json().catch(() => ({} as any)),
        5000,
        "Generation response parsing"
      );

      if (!generationRes.ok) {
        console.error(`❌ [${requestId}] Gemini generation attempt ${generationAttempts} FAILED:`, generationJson);
        
        // Check if it's a content policy violation and we have ChatGPT available
        const isContentBlock = generationJson?.error?.message?.includes?.("PROHIBITED_CONTENT") || 
                              generationJson?.error?.message?.includes?.("content policy") ||
                              generationRes.status === 400;
        
        if (isContentBlock && openaiKey && promptModificationAttempts < 3) {
          promptModificationAttempts++;
          console.log(`🤖 [${requestId}] Content policy violation detected, attempting ChatGPT character modification (${promptModificationAttempts}/3)`);
          
          const modifiedCharacter = await modifyPromptWithChatGPT(
            CURRENT_CHARACTER, // Only modify the character part
            promptModificationAttempts, 
            openaiKey, 
            requestId
          );
          if (modifiedCharacter !== CURRENT_CHARACTER) {
            CURRENT_CHARACTER = modifiedCharacter; // Update character while keeping prefix immutable
            console.log(`🔄 [${requestId}] Retrying with modified character: "${CURRENT_CHARACTER}"`);
            generationAttempts--; // Don't count this as a failed generation attempt
            continue;
          }
        }
        
        if (generationAttempts === maxGenerationAttempts) {
          return new Response(
            JSON.stringify({ 
              error: generationJson?.error?.message || "Gemini generation error", 
              raw: generationJson,
              requestId,
              promptModificationAttempts
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
        
        // Check if empty results might be due to content blocking - trigger ChatGPT fallback
        if (openaiKey && promptModificationAttempts < 3) {
          promptModificationAttempts++;
          console.log(`🚫 [${requestId}] Empty results detected (potential content block), attempting ChatGPT prompt modification (${promptModificationAttempts}/3)`);
          
          const modifiedCharacter = await modifyPromptWithChatGPT(
            CURRENT_CHARACTER, // Only sanitize the character part
            promptModificationAttempts, 
            openaiKey, 
            requestId
          );
          if (modifiedCharacter !== CURRENT_CHARACTER) {
            CURRENT_CHARACTER = modifiedCharacter;
            console.log(`🔄 [${requestId}] Retrying with sanitized character after empty results: "${CURRENT_CHARACTER}"`);
            generationAttempts--; // Don't count this as a failed generation attempt
            continue;
          }
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
    
    // Validate critical variables before response construction
    const safeFinalPrompt = FINAL_GENERATION_PROMPT || 'generation_prompt_undefined';
    const safeCurrentCharacter = CURRENT_CHARACTER || 'character_undefined';
    
    console.log(`✅ [${requestId}] Successful generation - returning ${images.length} images`);
    console.log(`🔍 [${requestId}] Final response validation - prompt: ${!!safeFinalPrompt}, character: ${!!safeCurrentCharacter}`);
    
    // Final validation before response construction
    if (!images || images.length === 0) {
      console.error(`❌ [${requestId}] No images generated despite success flag`);
      return new Response(
        JSON.stringify({ 
          error: "No images were generated", 
          requestId,
          debug: {
            finalPrompt: safeFinalPrompt,
            character: safeCurrentCharacter,
            errorPhase: "validation"
          }
        }),
        { status: 500, headers: CORS }
      );
    }
    
    // Construct response with additional validation
    try {
      const responseData = { 
        images,
        enhancedPrompt: safeFinalPrompt,
        debug: {
          requestId,
          originalPrompt: prompt || 'undefined',
          hasReferenceImage: !!imageData,
          finalPrompt: safeFinalPrompt,
          character: safeCurrentCharacter,
          imageCount: images.length,
          analysisModel: analysisModel || 'undefined',
          generationModel: generationModel || 'undefined',
          analysisSuccessful: analysisSuccessful ?? false,
          promptModificationAttempts: promptModificationAttempts || 0,
          timestamp: new Date().toISOString(),
          guaranteedGemini: true // Confirm no fallback to other services
        }
      };
      
      const responseJson = JSON.stringify(responseData);
      console.log(`📦 [${requestId}] Response size: ${responseJson.length} characters`);
      
      return new Response(responseJson, { headers: CORS });
    } catch (responseError: any) {
      console.error(`❌ [${requestId}] Response construction failed:`, responseError);
      return new Response(
        JSON.stringify({ 
          error: "Response construction failed", 
          requestId,
          details: responseError.message 
        }),
        { status: 500, headers: CORS }
      );
    }

  } catch (err: any) {
    // Defensive error handling to prevent 502
    let errorRequestId: string;
    let safeFinalPrompt: string;
    let safeCurrentCharacter: string;
    
    try {
      errorRequestId = typeof requestId !== 'undefined' ? requestId : generateRequestId();
      safeFinalPrompt = typeof FINAL_GENERATION_PROMPT !== 'undefined' ? FINAL_GENERATION_PROMPT : 'undefined';
      safeCurrentCharacter = typeof CURRENT_CHARACTER !== 'undefined' ? CURRENT_CHARACTER : 'undefined';
      
      console.error(`❌ [${errorRequestId}] Artist generator unhandled error:`, err?.message || 'unknown error');
      if (err?.stack) {
        console.error(`❌ [${errorRequestId}] Error stack:`, err.stack);
      }
    } catch (loggingError) {
      // Even logging failed, use absolute fallbacks
      errorRequestId = 'error_' + Date.now();
      safeFinalPrompt = 'undefined';
      safeCurrentCharacter = 'undefined';
      console.error(`❌ [${errorRequestId}] Critical error in error handling:`, loggingError);
    }
    
    try {
      const errorResponse = {
        error: (err?.message || "Unhandled error").toString(),
        requestId: errorRequestId,
        debug: {
          finalPrompt: safeFinalPrompt,
          character: safeCurrentCharacter,
          errorPhase: "execution",
          timestamp: new Date().toISOString(),
          errorType: err?.name || 'UnknownError'
        }
      };
      
      return new Response(JSON.stringify(errorResponse), { status: 500, headers: CORS });
    } catch (responseError) {
      // Last resort fallback
      console.error(`❌ Critical: Cannot construct error response:`, responseError);
      return new Response(
        JSON.stringify({ error: "Critical system error", requestId: errorRequestId || 'unknown' }),
        { status: 500, headers: CORS }
      );
    }
  }
});