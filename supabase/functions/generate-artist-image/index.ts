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

// Simplified function to sanitize character description using ChatGPT
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
  
  const systemPrompt = `You are a content safety assistant. Rephrase the character description to be ${conservativeness} more family-friendly and appropriate while keeping the core visual concept intact.

RULES:
- Remove problematic words but keep the essential visual elements
- Preserve gender (man/woman/boy/girl) exactly as specified
- Keep clothing styles, poses, expressions, and artistic elements
- Make it sound more professional/artistic
- Focus on style, expression, and artistic elements
- Replace offensive terms with neutral equivalents

EXAMPLES:
"Idiot wearing cheese hat" → "Person wearing cheese hat"
"Crazy man jumping" → "Energetic man in dynamic pose"
"Stupid gothic woman" → "Alternative style woman"

Return ONLY the cleaned character description, nothing else.`;

  try {
    console.log(`🔄 [${requestId}] Sanitizing character description with ChatGPT (attempt ${attempt}, ${conservativeness} safer)`);
    console.log(`📝 [${requestId}] Character to sanitize: "${characterDescription}"`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
    });

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
  // Generate unique request ID for tracking
  const requestId = generateRequestId();
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    console.log(`🆔 [${requestId}] Artist Generator request started`);
    
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!geminiKey) {
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
    let CURRENT_CHARACTER = CHARACTER;
    let analysisSuccessful = false;
    let promptModificationAttempts = 0;

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

      const analysisRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${analysisModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify(analysisRequestBody)
        }
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
    const FINAL_GENERATION_PROMPT = `${FULL_PREFIX} ${CURRENT_CHARACTER}`;
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

      const generationRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${generationModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify(generationRequestBody)
        }
      );

      generationJson = await generationRes.json().catch(() => ({} as any));

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
    
    return new Response(JSON.stringify({ 
      images,
      enhancedPrompt: FINAL_GENERATION_PROMPT,
      debug: {
        requestId,
        originalPrompt: prompt,
        hasReferenceImage: !!imageData,
        finalPrompt: FINAL_GENERATION_PROMPT,
        character: CURRENT_CHARACTER,
        imageCount: images.length,
        analysisModel: analysisModel,
        generationModel: generationModel,
        analysisSuccessful,
        promptModificationAttempts,
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